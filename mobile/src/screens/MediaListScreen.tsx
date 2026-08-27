import { useCallback, useRef, useState } from 'react';
import {
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

import { MediaCard } from '../components/MediaCard';
import { MediaFeedbackView } from '../components/MediaFeedbackView';
import { JingleBellIcon } from '../components/JingleBellIcon';
import { mediaApi } from '../services/mediaApi';
import { hydrateMovieMetadata } from '../services/movieMetadataHydrator';
// catalogueQuietModeV1
import { getCatalogueDisplayMode } from '../theme/catalogueDisplayMode';
import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import { registerUndo } from '../utils/undoManager';
import { semanticFeedback } from '../utils/semanticFeedback';
import {
  catalogueStateKey,
  mergeScreenState,
  readScreenState,
} from '../utils/screenStateCache';
import {
  mediaTypeLabels,
  watchStatusLabels,
  type MediaResponse,
  type MediaType,
  type WatchStatus,
} from '../types/media';
import type { MediaStackParamList } from '../types/mediaNavigation';

import { CelestialAtmosphere } from '../components/CelestialAtmosphere';
import { celestial, celestialAlpha } from '../theme/celestial';
type Props = NativeStackScreenProps<MediaStackParamList, 'MediaList'>;

const celestialMode = activeVisualSkinId === 'classic';
type TypeFilter = MediaType | 'ALL';
// catalogueNebitnoFilterV4
// jingleCatalogueV3
type StatusFilter = WatchStatus | 'ALL' | 'JINGLE' | 'NEBITNO';

const typeFilters: TypeFilter[] = ['ALL', 'MOVIE', 'SERIES'];
const statusFilters: StatusFilter[] = [
  'ALL',
  'WATCHLIST',
  'WATCHING',
  'COMPLETED',
  'DROPPED',
  'JINGLE',
  'NEBITNO',
];

// mediaStatePreservationV1
type MediaListPreservedState = {
  typeFilter: TypeFilter;
  statusFilter: StatusFilter;
  scrollOffset: number;
};

const MEDIA_STATE_KEY =
  catalogueStateKey('media');

export function MediaListScreen({ navigation }: Props) {
  const initialScreenState = useRef(
    readScreenState<MediaListPreservedState>(
      MEDIA_STATE_KEY,
    ),
  ).current;

  const listRef =
    useRef<FlatList<MediaResponse>>(null);

  const scrollOffsetRef = useRef(
    initialScreenState?.scrollOffset ?? 0,
  );

  const restoreScrollRef = useRef(
    (initialScreenState?.scrollOffset ?? 0) > 0,
  );

  const [items, setItems] =
    useState<MediaResponse[]>([]);

  const [typeFilter, setTypeFilter] =
    useState<TypeFilter>(
      initialScreenState?.typeFilter ?? 'ALL',
    );

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>(
      initialScreenState?.statusFilter ?? 'ALL',
    );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jingleBusy, setJingleBusy] = useState<string | null>(null);

  const selectTypeFilter = (
    value: TypeFilter,
  ) => {
    scrollOffsetRef.current = 0;
    restoreScrollRef.current = false;

    mergeScreenState<MediaListPreservedState>(
      MEDIA_STATE_KEY,
      {
        typeFilter: value,
        statusFilter,
        scrollOffset: 0,
      },
    );

    setTypeFilter(value);

    listRef.current?.scrollToOffset({
      offset: 0,
      animated: false,
    });
  };

  const selectStatusFilter = (
    value: StatusFilter,
  ) => {
    scrollOffsetRef.current = 0;
    restoreScrollRef.current = false;

    mergeScreenState<MediaListPreservedState>(
      MEDIA_STATE_KEY,
      {
        typeFilter,
        statusFilter: value,
        scrollOffset: 0,
      },
    );

    setStatusFilter(value);

    listRef.current?.scrollToOffset({
      offset: 0,
      animated: false,
    });
  };

  const rememberScroll = (offset: number) => {
    scrollOffsetRef.current = offset;

    mergeScreenState<MediaListPreservedState>(
      MEDIA_STATE_KEY,
      {
        typeFilter,
        statusFilter,
        scrollOffset: offset,
      },
    );
  };

  const restoreScroll = () => {
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
        // Content may still be measuring.
        // onContentSizeChange will retry.
      }
    });
  };

  const toggleJingle = async (item: MediaResponse) => {
    if (jingleBusy === item.mediaId) return;
    setJingleBusy(item.mediaId);
    try {
      const updated = await mediaApi.setFavourite(item.mediaId, !item.favourite);
      // semanticJingleFeedbackV1
      void semanticFeedback.jingle(updated.favourite);
      setItems((current) =>
        statusFilter === 'JINGLE' && !updated.favourite
          ? current.filter((row) => row.mediaId !== updated.mediaId)
          : current.map((row) => row.mediaId === updated.mediaId ? updated : row),
      );

      // jingleUniversalUndoV1
      registerUndo({
        label: updated.favourite
          ? `Dodano u Jingle: ${item.title}`
          : `Maknuto iz Jingle: ${item.title}`,

        undo: async () => {
          const reverted = await mediaApi.setFavourite(
            item.mediaId,
            item.favourite,
          );

          setItems((current) => {
            const exists = current.some(
              (row) => row.mediaId === reverted.mediaId,
            );

            if (
              statusFilter === 'JINGLE' &&
              reverted.favourite &&
              !exists
            ) {
              return [reverted, ...current];
            }

            if (
              statusFilter === 'JINGLE' &&
              !reverted.favourite
            ) {
              return current.filter(
                (row) => row.mediaId !== reverted.mediaId,
              );
            }

            return current.map((row) =>
              row.mediaId === reverted.mediaId
                ? reverted
                : row,
            );
          });
        },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Jingle se nije mogao promijeniti.');
    } finally {
      setJingleBusy(null);
    }
  };

  // lazyMoviePostersV5
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (getCatalogueDisplayMode() === 'compact') return;

      for (const token of viewableItems.slice(0, 4)) {
        const item = token.item as MediaResponse;
        if (item.mediaType !== 'MOVIE' || item.posterPath) continue;

        void hydrateMovieMetadata(item).then((hydrated) => {
          if (!hydrated?.posterPath) return;
          setItems((current) =>
            current.map((row) => row.mediaId === hydrated.mediaId ? hydrated : row),
          );
        });
      }
    },
  ).current;

  const moviePosterViewability = useRef({
    itemVisiblePercentThreshold: 55,
    minimumViewTime: 250,
  }).current;

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      setItems(await mediaApi.getAll({
        mediaType: typeFilter === 'ALL' ? undefined : typeFilter,
        status:
          statusFilter === 'ALL' || statusFilter === 'JINGLE' || statusFilter === 'NEBITNO'
            ? undefined
            : statusFilter,
        favourite: statusFilter === 'JINGLE' ? true : undefined,
        ignored: statusFilter === 'NEBITNO' ? 'NEBITNO' : undefined,
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Dohvat kataloga nije uspio.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, typeFilter]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <View style={[styles.hero, celestialMode && styles.celestialHero]}>
        {celestialMode ? <CelestialAtmosphere variant="media" /> : null}
        <Text style={styles.eyebrow}>Katalog</Text>
        <Text style={styles.heading}>Filmovi i serije</Text>
        <Text style={styles.count}>
          {!loading && !error ? `${items.length} naslova u prikazu` : 'Osobna povijest gledanja'}
        </Text>
<View style={styles.actions}>
          <Pressable
            onPress={() => navigation.navigate('MediaSearch')}
            style={({ pressed }) => [styles.action, celestialMode && styles.celestialAction, pressed && styles.pressed]}
          >
            <Text style={styles.actionIcon}>⌕</Text>
            <Text style={styles.actionLabel}>Online pretraga</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('MediaForm')}
            style={({ pressed }) => [styles.action, celestialMode && styles.celestialAction, pressed && styles.pressed]}
          >
            <Text style={styles.actionIcon}>+</Text>
            <Text style={styles.actionLabel}>Ručni unos</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {typeFilters.map((value) => (
            <FilterChip
              key={value}
              active={typeFilter === value}
              label={value === 'ALL' ? 'Sve vrste' : mediaTypeLabels[value]}
              onPress={() => selectTypeFilter(value)}
            />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {statusFilters.map((value) => (
            <FilterChip
              key={value}
              active={statusFilter === value}
              label={
                value === 'ALL'
                  ? 'Svi statusi'
                  : value === 'JINGLE'
                    ? 'Jingle'
                    : value === 'NEBITNO'
                      ? 'Nebitno'
                      : watchStatusLabels[value]
              }
              onPress={() => selectStatusFilter(value)}
            />
          ))}
        </ScrollView>
      </View>

      {loading && items.length === 0 ? (
        <MediaFeedbackView type="loading" />
      ) : error && items.length === 0 ? (
        <MediaFeedbackView type="error" message={error} onRetry={() => void load()} />
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          onScroll={(event) => {
            rememberScroll(
              event.nativeEvent.contentOffset.y,
            );
          }}
          scrollEventThrottle={100}
          onContentSizeChange={restoreScroll}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={moviePosterViewability}
          keyExtractor={(item) => item.mediaId}
          renderItem={({ item }) => (
            <View style={styles.jingleRow}>
              <MediaCard
                            item={item}
                            onPress={() => navigation.navigate('MediaDetails', { mediaId: item.mediaId })}
                          />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.favourite ? 'Makni iz Jingle' : 'Dodaj u Jingle'}
                hitSlop={8}
                disabled={jingleBusy === item.mediaId}
                onPress={() => void toggleJingle(item)}
                style={({ pressed }) => [styles.jingleButton, pressed && styles.jingleButtonPressed]}
              >
                <JingleBellIcon
                  active={item.favourite}
                  inactiveOpacity={0.5}
                  style={styles.jingleIcon}
                />
              </Pressable>
            </View>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <MediaFeedbackView
              type="empty"
              message="Nema naslova koji odgovaraju odabranim filtrima."
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={colors.black}
              colors={[colors.black]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

type FilterChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function FilterChip({ label, active, onPress }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // jingleCatalogueV3
  jingleRow: { position: 'relative' },
  jingleButton: {
    // mediaJingleMatchesGamesV1
    position: 'absolute',
    top: 2,
    right: 2,
    zIndex: 40,
    width: 76,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  jingleButtonPressed: { opacity: 0.72, transform: [{ scale: 0.95 }] },
  jingleIcon: {
    width: 62,
    height: 74,
  },
  jingleIconInactive: { opacity: 0.22 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  hero: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 17 },
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
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  action: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  actionIcon: { color: colors.text, fontSize: 20, marginRight: 6 },
  actionLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.65 },
  filters: { gap: 8, paddingBottom: 14 },
  filterRow: { gap: 8, paddingHorizontal: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  chipActive: { backgroundColor: colors.black, borderColor: colors.black },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: colors.white },
  list: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 35 },
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

