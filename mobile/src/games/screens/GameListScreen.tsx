import { useCallback, useState, useRef } from 'react';
import {
  Image,
  FlatList,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import type { ViewToken } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedbackView } from '../../components/FeedbackView';
import { colors } from '../../theme/colors';
import { GameCard } from '../components/GameCard';
import { gameApi } from '../services/gameApi';
import { hydrateGameMetadata } from '../services/gameMetadataHydrator';
// catalogueQuietModeV1
import { getCatalogueDisplayMode } from '../../theme/catalogueDisplayMode';
import {
  gameStatusLabels,
  gameStatuses,
  type GameResponse,
  type GameStackParamList,
  type GameStatus,
} from '../types/game';

type Props = NativeStackScreenProps<GameStackParamList, 'GameList'>;

export function GameListScreen({ navigation }: Props) {
  const [games, setGames] = useState<GameResponse[]>([]);
  // jingleGamesV1
  const [status, setStatus] = useState<GameStatus | 'JINGLE' | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // lazyGameCoversV1
  const onGameViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (getCatalogueDisplayMode() === 'compact') return;

      for (const token of viewableItems.slice(0, 4)) {
        const item = token.item as GameResponse;
        if (item.coverUrl) continue;

        void hydrateGameMetadata(item).then((hydrated) => {
          if (!hydrated?.coverUrl) return;
          setGames((current) =>
            current.map((row) => row.gameId === hydrated.gameId ? hydrated : row),
          );
        });
      }
    },
  ).current;

  const gameCoverViewability = useRef({
    itemVisiblePercentThreshold: 55,
    minimumViewTime: 250,
  }).current;

  const loadGames = useCallback(async (asRefresh = false) => {
    asRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const loaded = await gameApi.getAll(
        status && status !== 'JINGLE' ? status : undefined
      );

      setGames(
        status === 'JINGLE'
          ? loaded.filter((game) => game.favourite)
          : loaded
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Dohvat igara nije uspio.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status]);

  useFocusEffect(
    useCallback(() => {
      void loadGames();
    }, [loadGames]),
  );

  const toggleGameJingle = useCallback(async (game: GameResponse) => {
    const next = !game.favourite;

    try {
      const payload = { ...game, favourite: next } as Record<string, unknown>;
      delete payload.gameId;
      delete payload.createdAt;
      delete payload.modifiedAt;

      await gameApi.update(game.gameId, payload as any);

      setGames((current) => {
        if (status === 'JINGLE' && !next) {
          return current.filter((row) => row.gameId !== game.gameId);
        }

        return current.map((row) =>
          row.gameId === game.gameId
            ? { ...row, favourite: next }
            : row
        );
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Jingle nije spremljen.'
      );
    }
  }, [status]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Katalog</Text>
        <Text style={styles.heading}>Moje igre</Text>
        {!loading && !error ? (
          <Text style={styles.count}>
            {games.length === 1 ? '1 igra u prikazu' : `${games.length} igara u prikazu`}
          </Text>
        ) : null}

        <View style={styles.quickActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('GameMetadataSearch')}
            style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
          >
            <Text style={styles.quickIcon}>⌕</Text>
            <Text style={styles.quickLabel}>Online pretraga</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('GameForm')}
            style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
          >
            <Text style={styles.quickIcon}>+</Text>
            <Text style={styles.quickLabel}>Ručno dodaj</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => setStatus(null)}
            style={[styles.filter, status === null && styles.filterSelected]}
          >
            <Text style={[styles.filterText, status === null && styles.filterTextSelected]}>Sve</Text>
          </Pressable>
          {gameStatuses.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              onPress={() => setStatus(option)}
              style={[styles.filter, status === option && styles.filterSelected]}
            >
              <Text style={[styles.filterText, status === option && styles.filterTextSelected]}>
                {gameStatusLabels[option]}
              </Text>
            </Pressable>
          ))}

          <Pressable
            accessibilityRole="button"
            onPress={() => setStatus('JINGLE')}
            style={[
              styles.filter,
              status === 'JINGLE' && styles.filterSelected,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                status === 'JINGLE' && styles.filterTextSelected,
              ]}
            >
              Jingle
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {loading && games.length === 0 ? (
        <FeedbackView type="loading" />
      ) : error && games.length === 0 ? (
        <FeedbackView type="error" message={error} onRetry={() => void loadGames()} />
      ) : (
        <FlatList
          data={games}
          onViewableItemsChanged={onGameViewableItemsChanged}
          viewabilityConfig={gameCoverViewability}
          keyExtractor={(item) => item.gameId}
          renderItem={({ item }) => (
            <View style={styles.jingleRow}>
              <GameCard
                game={item}
                onPress={() =>
                  navigation.navigate('GameDetails', { gameId: item.gameId })
                }
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  item.favourite ? 'Makni iz Jingle' : 'Dodaj u Jingle'
                }
                onPress={() => void toggleGameJingle(item)}
                style={({ pressed }) => [
                  styles.jingleButton,
                  pressed && styles.jinglePressed,
                ]}
              >
                <Image
                  source={require('../../assets/aero/fav.png')}
                  resizeMode="contain"
                  style={[
                    styles.jingleIcon,
                    { opacity: item.favourite ? 1 : 0.5 },
                  ]}
                />
              </Pressable>
            </View>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={(
            <FeedbackView
              type="empty"
              message={status ? 'Nema igara s odabranim statusom.' : 'Još nema igara u katalogu.'}
            />
          )}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadGames(true)}
              tintColor={colors.black}
              colors={[colors.black]}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  hero: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 },
  eyebrow: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  heading: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 3,
  },
  count: { color: colors.textMuted, fontSize: 14, marginTop: 7 },
  quickActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  quickAction: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 14,
  },
  quickIcon: { color: colors.black, fontSize: 21, marginRight: 7 },
  quickLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.65 },
  filters: { gap: 8, paddingTop: 16, paddingBottom: 6 },
  filter: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterSelected: { backgroundColor: colors.black, borderColor: colors.black },
  filterText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  filterTextSelected: { color: colors.white },
  list: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 34 },
  jingleRow: {
    position: 'relative',
  },
  jingleButton: {
    position: 'absolute',
    top: 2,
    right: 2,
    zIndex: 30,
    width: 76,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  jingleIcon: {
    width: 62,
    height: 74,
  },
  jinglePressed: {
    opacity: 0.72,
  },
});
