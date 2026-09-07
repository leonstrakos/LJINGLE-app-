import { useCallback, useEffect, useRef, useState } from 'react';
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
import { AeroAtmosphere } from '../components/AeroAtmosphere';

import { MediaCard } from '../components/MediaCard';
import { CollectionFilterRail } from '../components/CollectionFilterRail';
import { MediaFeedbackView } from '../components/MediaFeedbackView';
import { JingleBellIcon } from '../components/JingleBellIcon';
import { ParentBackButton } from '../components/ParentBackButton';
// ljingleMorningFixesV1:mediaGrid
import { mediaApi } from '../services/mediaApi';
import { mediaUpcomingApi, type MediaUpcomingRelease } from '../services/mediaUpcomingApi';
import { collectionApi } from '../services/collectionApi';
import { hydrateMovieMetadata } from '../services/movieMetadataHydrator';
// catalogueQuietModeV1
import { getCatalogueDisplayMode, useCatalogueDisplayMode } from '../theme/catalogueDisplayMode';
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
import type { CollectionFilterChip } from '../types/collection';

import { CelestialAtmosphere } from '../components/CelestialAtmosphere';
import { celestial, celestialAlpha } from '../theme/celestial';
import { CelestialMotionLayer } from '../components/CelestialMotionLayer';
import { updateCelestialParallax } from '../motion/celestialParallax';
import { AnimatedPressable } from '../components/AnimatedPressable';
type Props = NativeStackScreenProps<MediaStackParamList, 'MediaList'>;

const celestialMode = (activeVisualSkinId === 'classic' || activeVisualSkinId === 'classic-ljingle');
const classicLjingleMode = activeVisualSkinId === 'classic-ljingle';
type CatalogueView = 'LIST' | 'COVERS';
type TypeFilter = MediaType | 'ALL';
// catalogueNebitnoFilterV4
// jingleCatalogueV3
type StatusFilter = WatchStatus | 'ALL' | 'JINGLE' | 'NEBITNO' | 'USKORO';

const typeFilters: TypeFilter[] = ['ALL', 'MOVIE', 'SERIES'];
const statusFilters: StatusFilter[] = [
  'ALL',
  'WATCHLIST',
  'LATER',
  'WATCHING',
  'COMPLETED',
  'DROPPED',
  'USKORO',
  'JINGLE',
  'NEBITNO',
];

// mediaStatePreservationV1
type MediaListPreservedState = {
  typeFilter: TypeFilter;
  statusFilter: StatusFilter;
  view?: CatalogueView;
  scrollOffset: number;
};

const MEDIA_STATE_KEY =
  catalogueStateKey('media');

// mediaUpcomingEligibilityR4
function isUpcomingEligible(item: MediaResponse) {
  if (item.mediaType !== 'MOVIE') return true;

  if (item.watchStatus === 'COMPLETED') {
    return false;
  }

  const currentYear = new Date().getFullYear();

  if (
    item.releaseYear != null &&
    item.releaseYear < currentYear
  ) {
    return false;
  }

  return true;
}

export function MediaListScreen({ navigation, route }: Props) {
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
  const [collectionFilters, setCollectionFilters] = useState<CollectionFilterChip[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    route.params?.collectionId ?? null,
  );

  const [typeFilter, setTypeFilter] =
    useState<TypeFilter>(
      initialScreenState?.typeFilter ?? 'ALL',
    );

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>(
      initialScreenState?.statusFilter ?? 'ALL',
    );
  const [view, setView] = useState<CatalogueView>(initialScreenState?.view ?? 'LIST');
  const catalogueMode = useCatalogueDisplayMode();
  const coverGrid = view === 'COVERS' && catalogueMode !== 'compact';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jingleBusy, setJingleBusy] = useState<string | null>(null);

  // mediaUpcomingTvTimeR3:MediaList
  const [upcomingByMediaId, setUpcomingByMediaId] =
    useState<Record<string, MediaUpcomingRelease>>({});
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const upcomingRequestKeyRef = useRef('');
  const upcomingFetchedAtRef = useRef(0);

  // mediaStickyAeroProfileFixV1:media
  // Mirrors Games: the full catalogue header scrolls away, then a compact
  // filter header appears on the first deliberate upward scroll.
  const [quickHeaderVisible, setQuickHeaderVisible] = useState(false);
  const previousScrollY = useRef(initialScreenState?.scrollOffset ?? 0);

  const selectView = (next: CatalogueView) => {
    setQuickHeaderVisible(false);
    previousScrollY.current = 0;
    setView(next);
    mergeScreenState<MediaListPreservedState>(MEDIA_STATE_KEY, { typeFilter, statusFilter, view: next, scrollOffset: 0 });
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const selectTypeFilter = (
    value: TypeFilter,
  ) => {
    setQuickHeaderVisible(false);
    previousScrollY.current = 0;
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
    setQuickHeaderVisible(false);
    previousScrollY.current = 0;
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
    if (refresh) {
      upcomingRequestKeyRef.current = '';
      upcomingFetchedAtRef.current = 0;
    }
    try {
      const [nextItems, nextCollectionFilters] = await Promise.all([
        mediaApi.getAll({
          mediaType: typeFilter === 'ALL' ? undefined : typeFilter,
          status:
            statusFilter === 'ALL' || statusFilter === 'JINGLE' || statusFilter === 'NEBITNO' || statusFilter === 'USKORO'
              ? undefined
              : statusFilter,
          favourite: statusFilter === 'JINGLE' ? true : undefined,
          ignored: statusFilter === 'NEBITNO' ? 'NEBITNO' : undefined,
        }),
        collectionApi.getFilterChips('MEDIA').catch(() => [] as CollectionFilterChip[]),
      ]);
      setItems(nextItems);
      setCollectionFilters(nextCollectionFilters);
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

  const activeCollection = collectionFilters.find(
    (chip) => chip.collectionId === activeCollectionId,
  );
  const visibleItems = activeCollection
    ? items.filter((item) => activeCollection.itemIds.includes(item.mediaId))
    : items;

  // ljingleCollectionChipsR1: open the filtered list and scroll to the exact title.
  const requestedCollectionId = route.params?.collectionId?.trim() || null;
  const focusMediaId = route.params?.focusMediaId?.trim() || null;
  useEffect(() => {
    if (requestedCollectionId && activeCollectionId !== requestedCollectionId) {
      setActiveCollectionId(requestedCollectionId);
      return;
    }
    if (!focusMediaId || visibleItems.length === 0) return;
    if (typeFilter !== 'ALL') { selectTypeFilter('ALL'); return; }
    if (statusFilter !== 'ALL') { selectStatusFilter('ALL'); return; }
    if (view !== 'LIST') { selectView('LIST'); return; }
    const index = visibleItems.findIndex((item) => item.mediaId === focusMediaId);
    if (index < 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.12 });
      navigation.setParams({ focusMediaId: undefined, collectionId: undefined });
    }, 100);
    return () => clearTimeout(timer);
  }, [activeCollectionId, focusMediaId, requestedCollectionId, statusFilter, typeFilter, view, visibleItems]);


  useEffect(() => {
    const candidates = items.filter(
      (item) =>
        isUpcomingEligible(item) &&
        Number.isInteger(item.tmdbId) &&
        Number(item.tmdbId) > 0,
    );

    const key = candidates
      .map(
        (item) =>
          item.mediaId +
          ':' +
          item.mediaType +
          ':' +
          item.tmdbId,
      )
      .sort()
      .join('|');

    if (!key) {
      upcomingRequestKeyRef.current = '';
      upcomingFetchedAtRef.current = Date.now();
      setUpcomingByMediaId({});
      setUpcomingLoading(false);
      return;
    }

    if (
      key === upcomingRequestKeyRef.current &&
      Date.now() - upcomingFetchedAtRef.current <
        30 * 60 * 1000
    ) {
      return;
    }

    upcomingRequestKeyRef.current = key;
    upcomingFetchedAtRef.current = Date.now();
    setUpcomingLoading(true);

    let cancelled = false;

    void mediaUpcomingApi
      .getForItems(candidates)
      .then((releases) => {
        if (cancelled) return;

        const next: Record<
          string,
          MediaUpcomingRelease
        > = {};

        for (const release of releases) {
          next[release.mediaId] = release;
        }

        setUpcomingByMediaId(next);
      })
      .catch(() => {
        if (!cancelled) {
          // Upcoming metadata is optional. Never break the catalogue.
          setUpcomingByMediaId({});
        }
      })
      .finally(() => {
        if (!cancelled) setUpcomingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [items]);

  const upcomingVisibleItems =
    statusFilter === 'USKORO'
      ? visibleItems.filter(
          (item) =>
            isUpcomingEligible(item) &&
            Boolean(
              upcomingByMediaId[item.mediaId],
            ),
        )
      : visibleItems;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <AeroAtmosphere variant="media" />
      <FlatList
        ref={listRef}
        key={coverGrid ? 'media-covers' : 'media-list'}
        data={upcomingVisibleItems}
        numColumns={coverGrid ? 3 : 1}
        ListHeaderComponent={
          <View style={styles.scrollHeader}>
            <View style={styles.catalogueTopBar}>
              <ParentBackButton onPress={() => navigation.getParent()?.goBack()} />
              <Text style={styles.catalogueTopBarTitle}>Filmovi i serije</Text>
            </View>
            <View style={[styles.hero, celestialMode && styles.celestialHero]}>
              {/* ljingleCelestialMotionLanguageR1:media */}
              <CelestialMotionLayer preset="media" />
              {(celestialMode || classicLjingleMode) ? <CelestialAtmosphere variant="media" /> : null}
              <Text style={styles.eyebrow}>Katalog</Text>
              <Text style={styles.heading}>Filmovi i serije</Text>
              <Text style={styles.count}>
                {!loading && !error ? `${upcomingVisibleItems.length} naslova u prikazu` : 'Osobna povijest gledanja'}
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

            <CollectionFilterRail
              leftInset={30}
              activeCollectionId={activeCollectionId}
              chips={collectionFilters}
              onSelect={(collectionId) => {
                setActiveCollectionId(collectionId);
                selectTypeFilter('ALL');
                selectStatusFilter('ALL');
              }}
            />

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
              <View style={styles.statusControls}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterRow}
                  style={styles.statusScroll}
                >
                  {statusFilters.map((value) => (
                    <FilterChip
                      key={value}
                      active={statusFilter === value}
                      label={
                        value === 'ALL'
                          ? 'Svi statusi'
                          : value === 'USKORO'
                          ? 'Uskoro'
                          : value === 'JINGLE'
                            ? 'Jingle'
                            : value === 'NEBITNO'
                              ? 'Nebitno'
                              : watchStatusLabels[value as WatchStatus]
                      }
                      onPress={() => selectStatusFilter(value)}
                    />
                  ))}
                </ScrollView>
                {catalogueMode !== 'compact' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={coverGrid ? 'Prikaži popis' : 'Prikaži naslovnice'}
                    onPress={() => selectView(coverGrid ? 'LIST' : 'COVERS')}
                    style={styles.viewToggle}
                  >
                    <Text style={styles.viewToggleText}>{coverGrid ? '☰' : '▦'}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        }
        onScroll={(event) => {
          const y = Math.max(0, event.nativeEvent.contentOffset.y);
          rememberScroll(y);

          // ljingleSemanticAliveR21Exact:parallax-media
          updateCelestialParallax(y);

          if (y <= 8) {
            setQuickHeaderVisible(false);
          } else if (y < previousScrollY.current - 4) {
            setQuickHeaderVisible(true);
          } else if (y > previousScrollY.current + 8) {
            setQuickHeaderVisible(false);
          }

          previousScrollY.current = y;
        }}
        scrollEventThrottle={16}
        onContentSizeChange={restoreScroll}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={moviePosterViewability}
        keyExtractor={(item) => item.mediaId}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({ offset: Math.max(0, index * Math.max(1, averageItemLength)), animated: false });
          setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.12 }), 140);
        }}
        renderItem={({ item }) => coverGrid ? (
          <View style={styles.coverGridItem}>
            <MediaCard item={item} upcoming={isUpcomingEligible(item) ? (upcomingByMediaId[item.mediaId] ?? null) : null} coverOnly onPress={() => navigation.navigate('MediaDetails', { mediaId: item.mediaId })} />
          </View>
        ) : (
          <View style={styles.jingleRow}>
            <MediaCard
              item={item}
              upcoming={isUpcomingEligible(item) ? (upcomingByMediaId[item.mediaId] ?? null) : null}
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
        columnWrapperStyle={coverGrid ? styles.coverGridRow : undefined}
        contentContainerStyle={[styles.list, coverGrid && styles.coverGridList]}
        ListEmptyComponent={
          (loading || (statusFilter === 'USKORO' && upcomingLoading))
            ? <MediaFeedbackView type="loading" />
            : error
              ? <MediaFeedbackView type="error" message={error} onRetry={() => void load()} />
              : <MediaFeedbackView type="empty" message={
                  statusFilter === 'USKORO'
                    ? 'Ništa iz tvog kataloga zasad nema najavljen budući datum.'
                    : 'Nema naslova koji odgovaraju odabranim filtrima.'
                } />
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

      {quickHeaderVisible ? (
        <View style={styles.floatingHeader}>
          <View style={styles.floatingTopLine}>
            <ParentBackButton onPress={() => navigation.getParent()?.goBack()} />
            <Text style={styles.floatingTitle}>Filmovi i serije</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.floatingFilters}
          >
            {typeFilters.map((value) => (
              <FilterChip
                key={value}
                active={typeFilter === value}
                label={value === 'ALL' ? 'Sve vrste' : mediaTypeLabels[value]}
                onPress={() => selectTypeFilter(value)}
              />
            ))}
          </ScrollView>

          <View style={styles.floatingStatusLine}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.floatingFilters}
              style={styles.statusScroll}
            >
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
                          : watchStatusLabels[value as WatchStatus]
                  }
                  onPress={() => selectStatusFilter(value)}
                />
              ))}
            </ScrollView>
            {catalogueMode !== 'compact' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={coverGrid ? 'Prikaži popis' : 'Prikaži naslovnice'}
                onPress={() => selectView(coverGrid ? 'LIST' : 'COVERS')}
                style={styles.viewToggle}
              >
                <Text style={styles.viewToggleText}>{coverGrid ? '☰' : '▦'}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

type FilterChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

// ljingleSemanticAliveR21Exact:media-filter-physics
function FilterChip({ label, active, onPress }: FilterChipProps) {
  return (
    <AnimatedPressable
      cue="tap"
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </AnimatedPressable>
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
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 80,
    paddingBottom: 10,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 9,
    elevation: 8,
  },
  floatingTopLine: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
  },
  floatingTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  floatingFilters: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 7,
  },
  floatingStatusLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusControls: { flexDirection: 'row', alignItems: 'center' }, // mediaGridMatchGamesV4
  statusScroll: { flex: 1 },
  viewToggle: { width: 38, height: 38, marginLeft: 8, marginRight: 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fill, borderWidth: 1, borderColor: colors.separator },
  viewToggleText: { color: colors.text, fontSize: 18, fontWeight: '800' },
  coverGridList: { paddingHorizontal: 14, paddingTop: 10 },
  coverGridRow: { gap: 10, marginBottom: 10 },
  coverGridItem: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: '31.4%',
    maxWidth: '31.4%',
    minWidth: 0,
  },
  scrollHeader: { marginHorizontal: -16 },
  catalogueTopBar: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
    backgroundColor: colors.background,
  },
  catalogueTopBarTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  }, // catalogueFinalPolishV1
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
  chipTextActive: { color: colors.onAccent },
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

