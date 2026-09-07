import { useCallback, useEffect, useState, useRef } from 'react';
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
import { AeroAtmosphere } from '../../components/AeroAtmosphere';

import { FeedbackView } from '../../components/FeedbackView';
import { CollectionFilterRail } from '../../components/CollectionFilterRail';
import { collectionApi } from '../../services/collectionApi';
import { colors } from '../../theme/colors';
import { activeVisualSkinId } from '../../theme/visualSkins';
import { registerUndo } from '../../utils/undoManager';
import { semanticFeedback } from '../../utils/semanticFeedback';
import {
  catalogueStateKey,
  mergeScreenState,
  readScreenState,
} from '../../utils/screenStateCache';
import { GameCard } from '../components/GameCard';
import { gameApi } from '../services/gameApi';
import { hydrateGameMetadata } from '../services/gameMetadataHydrator';
// catalogueQuietModeV1
import { getCatalogueDisplayMode, useCatalogueDisplayMode } from '../../theme/catalogueDisplayMode';
import { JingleBellIcon } from '../../components/JingleBellIcon';
import type { CollectionFilterChip } from '../../types/collection';
import {
  gameStatusLabels,
  gameStatuses,
  type GameResponse,
  type GameStackParamList,
  type GameStatus,
} from '../types/game';

import { CelestialAtmosphere } from '../../components/CelestialAtmosphere';
import { celestial, celestialAlpha } from '../../theme/celestial';
import { CelestialMotionLayer } from '../../components/CelestialMotionLayer';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { updateCelestialParallax } from '../../motion/celestialParallax';
type Props = NativeStackScreenProps<GameStackParamList, 'GameList'>;

const celestialMode = (activeVisualSkinId === 'classic' || activeVisualSkinId === 'classic-ljingle');
const classicLjingleMode = activeVisualSkinId === 'classic-ljingle';

// gameStatePreservationV1
type CatalogueView = 'LIST' | 'COVERS';

type GameListPreservedStatus =
  | GameStatus
  | 'JINGLE'
  | null;

type GameListPreservedState = {
  status: GameListPreservedStatus;
  view?: CatalogueView;
  scrollOffset: number;
};

const GAME_STATE_KEY =
  catalogueStateKey('games');

export function GameListScreen({ navigation, route }: Props) {
  const initialScreenState = useRef(
    readScreenState<GameListPreservedState>(
      GAME_STATE_KEY,
    ),
  ).current;

  const listRef =
    useRef<FlatList<GameResponse>>(null);

  const scrollOffsetRef = useRef(
    initialScreenState?.scrollOffset ?? 0,
  );

  const restoreScrollRef = useRef(
    (initialScreenState?.scrollOffset ?? 0) > 0,
  );

  const [games, setGames] =
    useState<GameResponse[]>([]);
  const [collectionFilters, setCollectionFilters] = useState<CollectionFilterChip[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    route.params?.collectionId ?? null,
  );

  // jingleGamesV1
  const [status, setStatus] =
    useState<GameListPreservedStatus>(
      initialScreenState?.status ?? null,
    );
  const [view, setView] = useState<CatalogueView>(initialScreenState?.view ?? 'LIST');
  const [quickHeaderVisible, setQuickHeaderVisible] = useState(false);
  const previousScrollY = useRef(0);
  const catalogueMode = useCatalogueDisplayMode();
  const coverGrid = view === 'COVERS' && catalogueMode !== 'compact';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectGameView = (value: CatalogueView) => {
    setView(value);
    setQuickHeaderVisible(false);
    mergeScreenState<GameListPreservedState>(GAME_STATE_KEY, { view: value });
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const selectGameStatus = (
    value: GameListPreservedStatus,
  ) => {
    scrollOffsetRef.current = 0;
    restoreScrollRef.current = false;

    mergeScreenState<GameListPreservedState>(
      GAME_STATE_KEY,
      {
        status: value,
        view,
        scrollOffset: 0,
      },
    );

    setStatus(value);

    listRef.current?.scrollToOffset({
      offset: 0,
      animated: false,
    });
  };

  const rememberGameScroll = (
    offset: number,
  ) => {
    scrollOffsetRef.current = offset;

    mergeScreenState<GameListPreservedState>(
      GAME_STATE_KEY,
      {
        status,
        view,
        scrollOffset: offset,
      },
    );
  };

  const restoreGameScroll = () => {
    if (!restoreScrollRef.current) {
      return;
    }

    const offset = scrollOffsetRef.current;

    if (offset <= 0) {
      restoreScrollRef.current = false;
      return;
    }

    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToOffset({
          offset,
          animated: false,
        });

        restoreScrollRef.current = false;
      } catch {
        // Content can still be measuring.
      }
    });
  };

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
      const [loaded, nextCollectionFilters] = await Promise.all([
        gameApi.getAll(status && status !== 'JINGLE' ? status : undefined),
        collectionApi.getFilterChips('GAME').catch(() => [] as CollectionFilterChip[]),
      ]);

      setGames(
        status === 'JINGLE'
          ? loaded.filter((game) => game.favourite)
          : loaded
      );
      setCollectionFilters(nextCollectionFilters);
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

  const activeCollection = collectionFilters.find(
    (chip) => chip.collectionId === activeCollectionId,
  );
  const visibleGames = activeCollection
    ? games.filter((game) => activeCollection.itemIds.includes(game.gameId))
    : games;

  // ljingleCollectionChipsR1: collection detail taps land on the exact game row.
  const requestedCollectionId = route.params?.collectionId?.trim() || null;
  const focusGameId = route.params?.focusGameId?.trim() || null;
  useEffect(() => {
    if (requestedCollectionId && activeCollectionId !== requestedCollectionId) {
      setActiveCollectionId(requestedCollectionId);
      return;
    }
    if (!focusGameId || visibleGames.length === 0) return;
    if (status !== null) { selectGameStatus(null); return; }
    if (view !== 'LIST') { selectGameView('LIST'); return; }
    const index = visibleGames.findIndex((game) => game.gameId === focusGameId);
    if (index < 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.12 });
      navigation.setParams({ focusGameId: undefined, collectionId: undefined });
    }, 100);
    return () => clearTimeout(timer);
  }, [activeCollectionId, focusGameId, requestedCollectionId, status, view, visibleGames]);

  const toggleGameJingle = useCallback(async (game: GameResponse) => {
    const next = !game.favourite;

    try {
      const payload = { ...game, favourite: next } as Record<string, unknown>;
      delete payload.gameId;
      delete payload.createdAt;
      delete payload.modifiedAt;

      await gameApi.update(game.gameId, payload as any);
      // semanticJingleFeedbackV1
      void semanticFeedback.jingle(next);

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

      // jingleUniversalUndoV1
      registerUndo({
        label: next
          ? `Dodano u Jingle: ${game.title}`
          : `Maknuto iz Jingle: ${game.title}`,

        undo: async () => {
          const undoPayload = {
            ...game,
            favourite: game.favourite,
          } as Record<string, unknown>;

          delete undoPayload.gameId;
          delete undoPayload.createdAt;
          delete undoPayload.modifiedAt;

          const reverted = await gameApi.update(
            game.gameId,
            undoPayload as any,
          );

          setGames((current) => {
            const exists = current.some(
              (row) => row.gameId === reverted.gameId,
            );

            if (
              status === 'JINGLE' &&
              reverted.favourite &&
              !exists
            ) {
              return [reverted, ...current];
            }

            if (
              status === 'JINGLE' &&
              !reverted.favourite
            ) {
              return current.filter(
                (row) => row.gameId !== reverted.gameId,
              );
            }

            return current.map((row) =>
              row.gameId === reverted.gameId
                ? reverted
                : row,
            );
          });
        },
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
      <FlatList
        ref={listRef}
        key={coverGrid ? 'game-covers' : 'game-list'}
        data={visibleGames}
        numColumns={coverGrid ? 3 : 1}
        ListHeaderComponent={<View style={styles.scrollHeader}><View style={[styles.hero, celestialMode && styles.celestialHero]}>
          {/* ljingleCelestialMotionLanguageR1:games */}
          <CelestialMotionLayer preset="games" />{(celestialMode || classicLjingleMode) ? <CelestialAtmosphere variant="games" /> : null}<Text style={styles.eyebrow}>Katalog</Text><Text style={styles.heading}>Moje igre</Text>{!loading && !error ? <Text style={styles.count}>{visibleGames.length === 1 ? '1 igra u prikazu' : `${visibleGames.length} igara u prikazu`}</Text> : null}<View style={styles.quickActions}><Pressable accessibilityRole="button" onPress={() => navigation.navigate('GameMetadataSearch')} style={({ pressed }) => [styles.quickAction, celestialMode && styles.celestialAction, pressed && styles.pressed]}><Text style={styles.quickIcon}>⌕</Text><Text style={styles.quickLabel}>Online pretraga</Text></Pressable><Pressable accessibilityRole="button" onPress={() => navigation.navigate('GameForm')} style={({ pressed }) => [styles.quickAction, celestialMode && styles.celestialAction, pressed && styles.pressed]}><Text style={styles.quickIcon}>+</Text><Text style={styles.quickLabel}>Ručno dodaj</Text></Pressable></View></View>
<CollectionFilterRail
          leftInset={22}
          topGap={6}
          bottomGap={0}
          activeCollectionId={activeCollectionId}
          chips={collectionFilters}
          onSelect={(collectionId) => {
            setActiveCollectionId(collectionId);
            selectGameStatus(null);
          }}
        />
<View style={styles.controlLine}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}><AnimatedPressable
      cue="tap" accessibilityRole="button" onPress={() => selectGameStatus(null)} style={[styles.filter, status === null && styles.filterSelected]}>
        {/* ljingleSemanticAliveR1:chips-games */}<Text style={[styles.filterText, status === null && styles.filterTextSelected]}>Sve</Text></AnimatedPressable>{gameStatuses.map((option) => <AnimatedPressable
      cue="tap" key={option} accessibilityRole="button" onPress={() => selectGameStatus(option)} style={[styles.filter, status === option && styles.filterSelected]}>
        {/* ljingleSemanticAliveR1:chips-games */}<Text style={[styles.filterText, status === option && styles.filterTextSelected]}>{gameStatusLabels[option]}</Text></AnimatedPressable>)}<AnimatedPressable
      cue="tap" accessibilityRole="button" onPress={() => selectGameStatus('JINGLE')} style={[styles.filter, status === 'JINGLE' && styles.filterSelected]}>
        {/* ljingleSemanticAliveR1:chips-games */}<Text style={[styles.filterText, status === 'JINGLE' && styles.filterTextSelected]}>Jingle</Text></AnimatedPressable></ScrollView>{catalogueMode !== 'compact' ? <Pressable accessibilityRole="button" onPress={() => selectGameView(coverGrid ? 'LIST' : 'COVERS')} style={styles.viewToggle}><Text style={styles.viewToggleText}>{coverGrid ? '☰' : '▦'}</Text></Pressable> : null}</View>
</View>}
        onScroll={(event) => {
          const y =
            event.nativeEvent
              .contentOffset.y;

          rememberGameScroll(y);

          // ljingleSemanticAliveR21Exact:parallax-games
          updateCelestialParallax(y);

          if (y <= 8) {
            setQuickHeaderVisible(false);
          } else if (
            y <
            previousScrollY.current - 4
          ) {
            setQuickHeaderVisible(true);
          } else if (
            y >
            previousScrollY.current + 8
          ) {
            setQuickHeaderVisible(false);
          }

          previousScrollY.current =
            y;
        }}
        scrollEventThrottle={16}
        onContentSizeChange={restoreGameScroll}
        onViewableItemsChanged={coverGrid ? undefined : onGameViewableItemsChanged}
        viewabilityConfig={gameCoverViewability}
        keyExtractor={(item) => item.gameId}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({ offset: Math.max(0, index * Math.max(1, averageItemLength)), animated: false });
          setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.12 }), 140);
        }}
        columnWrapperStyle={coverGrid ? styles.coverGridRow : undefined}
        renderItem={({ item }) => coverGrid ? <View style={styles.coverGridItem}><GameCard game={item} coverOnly onPress={() => navigation.navigate('GameDetails', { gameId: item.gameId })} /></View> : <View style={styles.jingleRow}><GameCard game={item} onPress={() => navigation.navigate('GameDetails', { gameId: item.gameId })} /><Pressable accessibilityRole="button" accessibilityLabel={item.favourite ? 'Makni iz Jingle' : 'Dodaj u Jingle'} onPress={() => void toggleGameJingle(item)} style={({ pressed }) => [styles.jingleButton, pressed && styles.jinglePressed]}><JingleBellIcon active={item.favourite} inactiveOpacity={0.5} style={styles.jingleIcon} /></Pressable></View>}
        contentContainerStyle={[styles.list, coverGrid && styles.coverGridList]}
        ListEmptyComponent={loading ? <FeedbackView type="loading" /> : error ? <FeedbackView type="error" message={error} onRetry={() => void loadGames()} /> : <FeedbackView type="empty" message={status ? 'Nema igara s odabranim statusom.' : 'Još nema igara u katalogu.'} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadGames(true)} tintColor={colors.black} colors={[colors.black]} />}
      />
      {quickHeaderVisible ? <View style={styles.floatingHeader}><Text style={styles.floatingTitle}>Moje igre</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.floatingFilters}><AnimatedPressable
      cue="tap" onPress={() => selectGameStatus(null)} style={[styles.filter, status === null && styles.filterSelected]}>
        {/* ljingleSemanticAliveR1:chips-games */}<Text style={[styles.filterText, status === null && styles.filterTextSelected]}>Sve</Text></AnimatedPressable>{gameStatuses.map((option) => <AnimatedPressable
      cue="tap" key={option} onPress={() => selectGameStatus(option)} style={[styles.filter, status === option && styles.filterSelected]}>
        {/* ljingleSemanticAliveR1:chips-games */}<Text style={[styles.filterText, status === option && styles.filterTextSelected]}>{gameStatusLabels[option]}</Text></AnimatedPressable>)}<AnimatedPressable
      cue="tap" onPress={() => selectGameStatus('JINGLE')} style={[styles.filter, status === 'JINGLE' && styles.filterSelected]}>
        {/* ljingleSemanticAliveR1:chips-games */}<Text style={[styles.filterText, status === 'JINGLE' && styles.filterTextSelected]}>Jingle</Text></AnimatedPressable></ScrollView></View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollHeader: {},
  coverGridList: { paddingHorizontal: 14 },
  coverGridRow: { gap: 10, marginBottom: 10 },
  coverGridItem: { flex: 1, maxWidth: '33.333%' },
  controlLine: {
    paddingHorizontal: 0,
    marginBottom: 12, flexDirection: 'row', alignItems: 'center', marginTop: 6},
  viewToggle: { width: 38, height: 38, marginLeft: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fill, borderWidth: 1, borderColor: colors.separator },
  viewToggleText: { color: colors.text, fontSize: 18, fontWeight: '800' },
  floatingHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 8, paddingHorizontal: 18, paddingTop: 9, paddingBottom: 10, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.separator },
  floatingTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 7 },
  floatingFilters: { gap: 8, paddingRight: 12 },
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
  filters: {
    paddingRight: 12, gap: 8, paddingTop: 16, paddingBottom: 6 },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterSelected: { backgroundColor: colors.black, borderColor: colors.black },
  filterText: { color: colors.text, fontSize: 13, fontWeight: '700'},
  filterTextSelected: { color: colors.onAccent },
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
  celestialHero: {
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: celestialAlpha(celestial.gold, 0.28),
  },
  celestialAction: {
    borderColor: celestialAlpha(celestial.gold, 0.34),
    shadowColor: celestial.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },

});
