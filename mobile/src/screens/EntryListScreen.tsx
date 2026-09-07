// ljingleContrastTargetedR3
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AeroAtmosphere } from '../components/AeroAtmosphere';

import { EntryCard } from '../components/EntryCard';
import {
  EntryGalleryTile,
  EntryGalleryViewer,
  EntryGalleryViewToggle,
  type EntryGalleryItem,
  type EntryGalleryMode,
} from '../components/EntryGallery';
import { EntryDeleteModal } from '../components/EntryDeleteModal';
import { CollectionFilterRail } from '../components/CollectionFilterRail';
import { entryApi } from '../services/entryApi';
import { collectionApi } from '../services/collectionApi';
import { getEntryImagePreviews } from '../services/entryImages';
import {
  emptyEntryLinkLabels,
  entryLinksApi,
} from '../services/entryLinksApi';
import { getReaderAnchorPreviews } from '../services/bookReaderRepository';
import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import { deletedFeedback } from '../utils/crudFeedback';
import {
  entryTypeLabels,
  entryTypes,
  type Entry,
  type EntryFormParams,
  type EntryLinkLabels,
  type EntryType,
} from '../types/entry';
import type { ReaderAnchorPreview } from '../types/reader';
import type { CollectionFilterChip } from '../types/collection';

import { CelestialAtmosphere } from '../components/CelestialAtmosphere';
import { celestial, celestialAlpha } from '../theme/celestial';
import { CelestialMotionLayer } from '../components/CelestialMotionLayer';
import { updateCelestialParallax } from '../motion/celestialParallax';
import { AnimatedPressable } from '../components/AnimatedPressable';
export type EntryListScreenProps = {
  navigation: {
    navigate: (
      screen: 'EntryForm' | 'BookDetails',
      params?: EntryFormParams | {
        bookId: string;
        openReader?: boolean;
        readerPage?: number | null;
        readerLocator?: string | null;
        readerSelectionRects?: Array<{ page: number; rect: string }> | null;
      },
    ) => void;
  };
  route?: {
    params?: { focusEntryId?: string; collectionId?: string };
  };
};

type Filter = EntryType | 'ALL';

const celestialMode = (activeVisualSkinId === 'classic' || activeVisualSkinId === 'classic-ljingle');

function normalizeEntrySearch(value: unknown) {
  return String(value ?? '')
    .toLocaleLowerCase('hr-HR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// brutusEntrySearchV1

export function EntryListScreen({ navigation, route }: EntryListScreenProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [customFilter, setCustomFilter] = useState<string | null>(null);
  const [collectionFilters, setCollectionFilters] = useState<CollectionFilterChip[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    route?.params?.collectionId ?? null,
  );
  const [query, setQuery] = useState('');
  const [linkLabels, setLinkLabels] = useState<EntryLinkLabels>(emptyEntryLinkLabels);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [imagePreviews, setImagePreviews] = useState<Record<string, string[]>>({});
  // ljingleEntriesGalleryMemoryBoxR2:screen
  const [entryViewMode, setEntryViewMode] =
    useState<EntryGalleryMode>('LIST');
  const [galleryViewerIndex, setGalleryViewerIndex] =
    useState<number | null>(null);
  const [readerAnchors, setReaderAnchors] = useState<
    Record<string, ReaderAnchorPreview>
  >({});
  const requestVersion = useRef(0);
  // ljingleReaderEntriesHighlightRadioR1: target card requested by the book reader
  const listRef = useRef<FlatList<Entry>>(null);

  // settingsApplyNotesSpeedV1: render the entry rows first; hydrate labels and images after.
  const loadEntries = useCallback(async (asRefresh = false) => {
    const version = ++requestVersion.current;
    asRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);

    try {
      // Filtering is local. One ordered SQLite read replaces the old pair of
      // filtered + unfiltered requests on every filter change.
      const [nextEntries, nextCollectionFilters] = await Promise.all([
        entryApi.getAll({}),
        collectionApi.getFilterChips('ENTRY').catch(() => [] as CollectionFilterChip[]),
      ]);

      if (version !== requestVersion.current) return;
      setEntries(nextEntries);
      setCollectionFilters(nextCollectionFilters);
      setLoading(false);
      setRefreshing(false);

      // Cards can already render now. Relationship labels and image previews
      // arrive together without blocking the first visible frame.
      const [nextLabels, nextImagePreviews, nextReaderAnchors] = await Promise.all([
        entryLinksApi
          .getAll(asRefresh)
          .then(entryLinksApi.toLabels)
          .catch(() => emptyEntryLinkLabels),
        getEntryImagePreviews(
          nextEntries.map((entry) => entry.entryId),
        ).catch(() => ({} as Record<string, string[]>)),
        getReaderAnchorPreviews(
          nextEntries.map((entry) => entry.entryId),
        ).catch(() => ({} as Record<string, ReaderAnchorPreview>)),
      ]);

      if (version !== requestVersion.current) return;
      setLinkLabels(nextLabels);
      setImagePreviews(nextImagePreviews);
      setReaderAnchors(nextReaderAnchors);
    } catch (caught) {
      if (version !== requestVersion.current) return;
      setError(
        caught instanceof Error
          ? caught.message
          : 'Zapisi se nisu mogli učitati.',
      );
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadEntries();
      return () => {
        requestVersion.current += 1;
      };
    }, [loadEntries]),
  );

  const closeDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const deleteEntry = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await entryApi.remove(deleteTarget.entryId);
      deletedFeedback();
      setEntries((current) =>
        current.filter((entry) => entry.entryId !== deleteTarget.entryId),
      );
      setImagePreviews((current) => {
        const next = { ...current };
        delete next[deleteTarget.entryId];
        return next;
      });
      setDeleteTarget(null);
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : 'Brisanje nije uspjelo.');
    } finally {
      setDeleting(false);
    }
  };

  const openReference = (title: string) => {
    const wanted = title.trim().toLocaleLowerCase('hr-HR');
    const target = entries.find(
      (entry) => entry.title?.trim().toLocaleLowerCase('hr-HR') === wanted,
    );
    if (target) navigation.navigate('EntryForm', { entryId: target.entryId });
  };

  const openReaderAnchor = (anchor: ReaderAnchorPreview) => {
    navigation.navigate('BookDetails', {
      bookId: anchor.bookId,
      openReader: true,
      readerPage: anchor.page,
      readerLocator: anchor.epubLocator,
      readerSelectionRects: anchor.selectionRects,
    });
  };

  const normalizedQuery =
    normalizeEntrySearch(query.trim());

  // ljingleZapisiVaultR1: custom chip collection and combined filtering.
  const customLabels = (() => {
    const labels = new Map<string, string>();
    for (const entry of entries) {
      const label = entry.customLabel?.trim();
      if (label) labels.set(normalizeEntrySearch(label), label);
    }
    return [...labels.values()].sort((left, right) => left.localeCompare(right, 'hr-HR'));
  })();

  const filteredEntries = entries.filter((entry) => {
    if (filter !== 'ALL' && entry.type !== filter) return false;
    if (customFilter && normalizeEntrySearch(entry.customLabel) !== normalizeEntrySearch(customFilter)) {
      return false;
    }
    const activeCollection = collectionFilters.find(
      (chip) => chip.collectionId === activeCollectionId,
    );
    if (activeCollection && !activeCollection.itemIds.includes(entry.entryId)) return false;
    return true;
  });

  const visibleEntries = filteredEntries.filter((entry) => {
    if (!normalizedQuery) return true;

    const haystack = normalizeEntrySearch(
      [
        entry.title,
        entry.content,
        entryTypeLabels[entry.type],
        entry.customLabel,
      ]
        .filter(Boolean)
        .join(' '),
    );

    return haystack.includes(normalizedQuery);
  });

  // ljingleCollectionChipsR1: Reader and Memory Box deep-links reveal the exact filtered card.
  const focusEntryId = route?.params?.focusEntryId?.trim() || null;
  const requestedCollectionId = route?.params?.collectionId?.trim() || null;
  useEffect(() => {
    if (requestedCollectionId && activeCollectionId !== requestedCollectionId) {
      setActiveCollectionId(requestedCollectionId);
      return;
    }
    if (!focusEntryId || visibleEntries.length === 0) return;
    if (entryViewMode !== 'LIST') {
      setEntryViewMode('LIST');
      return;
    }
    if (filter !== 'ALL') {
      setFilter('ALL');
      return;
    }
    if (customFilter) {
      setCustomFilter(null);
      return;
    }
    if (query) {
      setQuery('');
      return;
    }
    const index = visibleEntries.findIndex((entry) => entry.entryId === focusEntryId);
    if (index < 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.12 });
      (navigation as unknown as { setParams?: (params: { focusEntryId?: string; collectionId?: string }) => void })
        .setParams?.({ focusEntryId: undefined, collectionId: undefined });
    }, 90);
    return () => clearTimeout(timer);
  }, [
    activeCollectionId,
    customFilter,
    entryViewMode,
    filter,
    focusEntryId,
    query,
    requestedCollectionId,
    visibleEntries,
  ]);


  const galleryItems: EntryGalleryItem[] =
    visibleEntries.flatMap((entry) => {
      const title =
        entry.title?.trim() ||
        entry.content.replace(/\s+/g, ' ').trim().slice(0, 86) ||
        entryTypeLabels[entry.type];

      return (imagePreviews[entry.entryId] ?? []).map(
        (uri, imageIndex) => {
          const readerAnchor =
            readerAnchors[entry.entryId] ?? null;

          const sourceLabel =
            readerAnchor
              ? linkLabels.books[readerAnchor.bookId] ??
                'Povezana knjiga'
              : null;

          const sourceLocation =
            readerAnchor?.format === 'PDF' && readerAnchor.page
              ? 'str. ' + readerAnchor.page
              : readerAnchor?.format === 'EPUB'
                ? 'EPUB'
                : null;

          return {
            key: entry.entryId + ':' + imageIndex + ':' + uri,
            entryId: entry.entryId,
            uri,
            title,
            typeLabel: entryTypeLabels[entry.type],
            // ljingleReaderGalleryCrossoverR2:screen
            sourceLabel,
            sourceLocation,
          };
        },
      );
    });

  const header = (
    <>
      <View style={[styles.hero, celestialMode && styles.celestialHero]}>
        {/* ljingleCelestialMotionLanguageR1:entries */}
        <CelestialMotionLayer preset="entries" />
        {celestialMode ? <CelestialAtmosphere variant="entries" /> : null}
        <Text style={styles.eyebrow}>Misli, citati i tragovi</Text>
        <Text style={styles.heading}>Zapisi</Text>
        <Text style={styles.intro}>
          Jedno mjesto za sve što želiš zapamtiti uz knjige, teme i aktivnosti.
        </Text>
<View style={styles.summaryRow}>
          <Text style={styles.summaryValue}>{visibleEntries.length}</Text>
          <Text style={styles.summaryLabel}>
            {customFilter ? 'u odabranoj oznaci' : filter === 'ALL' ? 'prikazanih zapisa' : entryTypeLabels[filter].toLowerCase()}
          </Text>
          {loading && entries.length > 0 ? (
            <ActivityIndicator color={colors.black} size="small" style={styles.syncSpinner} />
          ) : null}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('EntryForm')}
        style={({ pressed }) => [styles.addCard, celestialMode && styles.celestialPrimaryCard, pressed && styles.addCardPressed]}
      >
        <View style={styles.addIcon}>
          <Text style={styles.addIconText}>+</Text>
        </View>
        <View style={styles.addCopy}>
          <Text style={styles.addTitle}>Novi zapis</Text>
          <Text style={styles.addSubtitle}>Zapiši misao, citat, opažanje ili osvrt</Text>
        </View>
        <Text style={styles.addArrow}>›</Text>
      </Pressable>

      <View style={styles.entrySearchWrap}>
        <TextInput
          accessibilityLabel="Pretraži zapise"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Pretraži zapise..."
          placeholderTextColor={colors.textMuted}
          style={[styles.entrySearchInput, celestialMode && styles.celestialInput]}
          value={query}
        />
      </View>

      <View style={styles.filterHeading}>
        <Text style={styles.sectionTitle}>Vrsta zapisa</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.filters}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <FilterChip
          active={filter === 'ALL'}
          label="Sve"
          onPress={() => {
            setFilter('ALL');
            setCustomFilter(null);
          }}
        />
        {entryTypes.map((type) => (
          <FilterChip
            active={filter === type}
            key={type}
            label={entryTypeLabels[type]}
            onPress={() => {
              setFilter(type);
              setCustomFilter(null);
            }}
          />
        ))}
      </ScrollView>

      {customLabels.length > 0 ? (
        <>
          <View style={styles.customFilterHeading}>
            <Text style={styles.customFilterTitle}>Oznake</Text>
            <Text style={styles.customFilterHint}>tvoje niti kroz zapise</Text>
          </View>
          <ScrollView
            contentContainerStyle={styles.filters}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {customLabels.map((label) => (
              <FilterChip
                active={normalizeEntrySearch(customFilter) === normalizeEntrySearch(label)}
                key={label}
                label={`✦  ${label}`}
                onPress={() => {
                  setFilter('ALL');
                  setCustomFilter((current) =>
                    normalizeEntrySearch(current) === normalizeEntrySearch(label) ? null : label,
                  );
                }}
              />
            ))}
          </ScrollView>
        </>
      ) : null}
      {/* ljingleZapisiVaultR1: labels become first-class filters */}

      <EntryGalleryViewToggle
        value={entryViewMode}
        onChange={(nextMode) => {
          setGalleryViewerIndex(null);
          setEntryViewMode(nextMode);
        }}
      />

      <CollectionFilterRail
        activeCollectionId={activeCollectionId}
        chips={collectionFilters}
        onSelect={(collectionId) => {
          setActiveCollectionId(collectionId);
          setFilter('ALL');
          setCustomFilter(null);
          setQuery('');
        }}
      />

      {error && entries.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void loadEntries(true)}
          style={styles.errorBanner}
        >
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorRetry}>Ponovi</Text>
        </Pressable>
      ) : null}

      <View style={styles.listHeading}>
        <Text style={styles.sectionTitle}>
          {customFilter ? `✦  ${customFilter}` : filter === 'ALL' ? 'Svi zapisi' : entryTypeLabels[filter]}
        </Text>
      </View>
    </>
  );

  if (loading && entries.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
      <AeroAtmosphere variant="entries" />
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.black} size="large" />
          <Text style={styles.stateCopy}>Slažemo tvoje zapise…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && entries.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
      <AeroAtmosphere variant="entries" />
        <View style={styles.centerState}>
          <Text style={styles.errorMark}>!</Text>
          <Text style={styles.stateTitle}>Zapisi se nisu učitali</Text>
          <Text style={styles.stateCopy}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void loadEntries()}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Text style={styles.retryText}>Pokušaj ponovno</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <AeroAtmosphere variant="entries" />
      {entryViewMode === 'GALLERY' ? (
        <FlatList
          key="gallery"
          columnWrapperStyle={styles.galleryColumnRow}
          contentContainerStyle={styles.content}
          data={galleryItems}
          keyExtractor={(item) => item.key}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyMark}>▦</Text>
              <Text style={styles.emptyTitle}>Još nema slika</Text>
              <Text style={styles.emptyCopy}>
                Slike iz zapisa pojavit će se ovdje. Odaberi Memory Box iznad i Gallery postaje njegov album.
              </Text>
            </View>
          }
          numColumns={2}
          refreshControl={
            <RefreshControl
              colors={[colors.black]}
              onRefresh={() => void loadEntries(true)}
              refreshing={refreshing}
              tintColor={colors.black}
            />
          }
          renderItem={({ item, index }) => (
            <EntryGalleryTile
              item={item}
              onPress={() => setGalleryViewerIndex(index)}
            />
          )}
          showsVerticalScrollIndicator={false}
        
          onScroll={(event) => {
            // ljingleSemanticAliveR1:scroll-entries
            updateCelestialParallax(event.nativeEvent.contentOffset.y);
          }}
          scrollEventThrottle={16}
        />
      ) : (
      <FlatList
        key="list"
        ref={listRef}
        contentContainerStyle={styles.content}
        data={visibleEntries}
        keyExtractor={(item) => item.entryId}
        ListHeaderComponent={header}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({
            offset: Math.max(0, index * Math.max(1, averageItemLength)),
            animated: false,
          });
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.12 });
          }, 140);
        }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyMark}>✎</Text>
            <Text style={styles.emptyTitle}>
              {customFilter ? 'Nema zapisa s ovom oznakom' : filter === 'ALL' ? 'Još nema zapisa' : 'Nema zapisa ove vrste'}
            </Text>
            <Text style={styles.emptyCopy}>
              {customFilter
                ? `Oznaka „${customFilter}” još nema odgovarajući zapis.`
                : filter === 'ALL'
                  ? 'Zabilježi prvu misao, citat ili opažanje i poveži ga sa svojim katalogom.'
                  : `Kad stvoriš prvi zapis vrste „${entryTypeLabels[filter]}”, pojavit će se ovdje.`}
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            colors={[colors.black]}
            onRefresh={() => void loadEntries(true)}
            refreshing={refreshing}
            tintColor={colors.black}
          />
        }
        renderItem={({ item }) => (
          <EntryCard
            entry={item}
            imageUris={imagePreviews[item.entryId] ?? []}
            linkLabels={linkLabels}
            onOpenReaderAnchor={
              readerAnchors[item.entryId]
                ? () => openReaderAnchor(readerAnchors[item.entryId]!)
                : undefined
            }
            onDelete={() => {
              setDeleteError(null);
              setDeleteTarget(item);
            }}
            onEdit={() => navigation.navigate('EntryForm', { entryId: item.entryId })}
            onOpenReference={openReference}
            readerAnchor={readerAnchors[item.entryId] ?? null}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
      )}

      <EntryGalleryViewer
        index={galleryViewerIndex}
        items={galleryItems}
        onClose={() => setGalleryViewerIndex(null)}
        onIndexChange={setGalleryViewerIndex}
        onOpenEntry={(entryId) => {
          setGalleryViewerIndex(null);
          navigation.navigate('EntryForm', { entryId });
        }}
        onOpenSource={(entryId) => {
          const anchor = readerAnchors[entryId] ?? null;
          if (!anchor) return;

          setGalleryViewerIndex(null);
          openReaderAnchor(anchor);
        }}
      />

      <EntryDeleteModal
        entry={deleteTarget}
        errorMessage={deleteError}
        loading={deleting}
        onCancel={closeDelete}
        onConfirm={() => void deleteEntry()}
      />
    </SafeAreaView>
  );
}

type FilterChipProps = {
  active: boolean;
  label: string;
  onPress: () => void;
};

function FilterChip({ active, label, onPress }: FilterChipProps) {
  return (
    <AnimatedPressable
      cue="tap"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active && styles.filterChipActive,
        pressed && styles.pressed,
      ]}
    >
        {/* ljingleSemanticAliveR1:chips-entries */}
      <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  galleryColumnRow: {
    paddingHorizontal: 4,
  },
  // ljingleZapisiVaultR1: second, quieter rail for user-created labels.
  customFilterHeading: {
    marginTop: 16,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  customFilterTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  customFilterHint: {
    marginLeft: 8,
    color: colors.textMuted,
    fontSize: 10,
  },
  entrySearchWrap: {
    marginTop: 18,
    marginBottom: 4,
  },
  entrySearchInput: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 15,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 32,
  },
  hero: {
    paddingTop: 24,
    paddingBottom: 20,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heading: {
    marginTop: 5,
    color: colors.text,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1.1,
  },
  intro: {
    maxWidth: 620,
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  summaryRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  summaryValue: {
    color: colors.black,
    fontSize: 27,
    fontWeight: '800',
  },
  summaryLabel: {
    marginLeft: 8,
    color: colors.textMuted,
    fontSize: 13,
  },
  syncSpinner: {
    marginLeft: 10,
  },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: colors.black,
    padding: 17,
  },
  addCardPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.995 }],
  },
  addIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: celestialMode ? 'transparent' : colors.white,
  },
  addIconText: {
    color: celestialMode ? colors.onAccent : colors.black,
    fontSize: 27,
    fontWeight: '400',
    lineHeight: 30,
  },
  addCopy: {
    flex: 1,
    marginLeft: 13,
  },
  addTitle: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '700',
  },
  addSubtitle: {
    marginTop: 3,
    color: colors.onAccent,
    fontSize: 12,
  },
  addArrow: {
    marginLeft: 10,
    color: colors.onAccent,
    fontSize: 28,
  },
  filterHeading: {
    marginTop: 25,
    marginBottom: 10,
  },
  filters: {
    paddingRight: 8,
    paddingBottom: 4,
  },
  filterChip: {
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  filterChipActive: {
    borderColor: colors.black,
    backgroundColor: colors.black,
  },
  filterLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  filterLabelActive: {
    color: colors.onAccent,
  },
  listHeading: {
    marginTop: 24,
    marginBottom: 11,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  errorBanner: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 13,
    backgroundColor: colors.dangerSoft,
    padding: 12,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
  },
  errorRetry: {
    marginLeft: 10,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: 30,
  },
  emptyMark: {
    color: colors.black,
    fontSize: 32,
  },
  emptyTitle: {
    marginTop: 12,
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyCopy: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorMark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
    fontSize: 27,
    fontWeight: '700',
    lineHeight: 52,
    textAlign: 'center',
  },
  stateTitle: {
    marginTop: 16,
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateCopy: {
    marginTop: 9,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: colors.black,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
  celestialHero: {
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: celestialAlpha(celestial.gold, 0.28),
    paddingHorizontal: 2,
  },
  celestialPrimaryCard: {
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.58),
    shadowColor: celestial.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 3,
  },
  celestialInput: {
    borderColor: celestialAlpha(celestial.gold, 0.34),
    shadowColor: celestial.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },

});
