// ljingleContrastTargetedR3
// ljingleSemanticAliveR21Exact:book-filter-physics
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AeroAtmosphere } from '../components/AeroAtmosphere';

import { BookCard } from '../components/BookCard';
import { CollectionFilterRail } from '../components/CollectionFilterRail';
import { FeedbackView } from '../components/FeedbackView';
import { bookApi } from '../services/bookApi';
import { collectionApi } from '../services/collectionApi';
import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import { useCatalogueDisplayMode } from '../theme/catalogueDisplayMode';
import { registerUndo } from '../utils/undoManager';
import { semanticFeedback } from '../utils/semanticFeedback';
import {
  catalogueStateKey,
  mergeScreenState,
  readScreenState,
} from '../utils/screenStateCache';
import { readingStatusLabels, readingStatuses, type BookResponse, type ReadingStatus } from '../types/book';
import type { RootStackParamList } from '../types/navigation';
import type { CollectionFilterChip } from '../types/collection';
import { JingleBellIcon } from '../components/JingleBellIcon';

import { CelestialAtmosphere } from '../components/CelestialAtmosphere';
import { celestial, celestialAlpha } from '../theme/celestial';
import { CelestialMotionLayer } from '../components/CelestialMotionLayer';
import { updateCelestialParallax } from '../motion/celestialParallax';
import { AnimatedPressable } from '../components/AnimatedPressable';
type Props = NativeStackScreenProps<RootStackParamList, 'BookList'>;

const celestialMode = (activeVisualSkinId === 'classic' || activeVisualSkinId === 'classic-ljingle');
const classicLjingleMode = activeVisualSkinId === 'classic-ljingle';

// bookStatePreservationV1
type CatalogueView = 'LIST' | 'COVERS';
type BookStatusFilter = ReadingStatus | 'ALL' | 'JINGLE';
const bookStatusFilters: BookStatusFilter[] = ['ALL', ...readingStatuses, 'JINGLE'];

type BookListPreservedState = {
  jingleOnly?: boolean;
  bookFilter?: BookStatusFilter;
  view?: CatalogueView;
  scrollOffset: number;
}; // catalogueFinalPolishV1

const BOOK_STATE_KEY =
  catalogueStateKey('books');

export function BookListScreen({ navigation, route }: Props) {
  const initialScreenState = useRef(
    readScreenState<BookListPreservedState>(
      BOOK_STATE_KEY,
    ),
  ).current;

  const listRef =
    useRef<FlatList<BookResponse>>(null);

  const scrollOffsetRef = useRef(
    initialScreenState?.scrollOffset ?? 0,
  );

  const restoreScrollRef = useRef(
    (initialScreenState?.scrollOffset ?? 0) > 0,
  );

  const [books, setBooks] =
    useState<BookResponse[]>([]);
  const [collectionFilters, setCollectionFilters] = useState<CollectionFilterChip[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    route.params?.collectionId ?? null,
  );

  // jingleBooksV1
  const [bookFilter, setBookFilter] = useState<BookStatusFilter>(
    initialScreenState?.bookFilter ?? (initialScreenState?.jingleOnly ? 'JINGLE' : 'ALL'),
  );
  const [view, setView] = useState<CatalogueView>(initialScreenState?.view ?? 'LIST');
  const [quickHeaderVisible, setQuickHeaderVisible] = useState(false);
  const previousScrollY = useRef(0);
  const catalogueMode = useCatalogueDisplayMode();
  const coverGrid = view === 'COVERS' && catalogueMode !== 'compact';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectBookView = (value: CatalogueView) => {
    setView(value);
    setQuickHeaderVisible(false);
    mergeScreenState<BookListPreservedState>(BOOK_STATE_KEY, { view: value });
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const selectBookFilter = (value: BookStatusFilter) => {
    scrollOffsetRef.current = 0;
    restoreScrollRef.current = false;
    mergeScreenState<BookListPreservedState>(BOOK_STATE_KEY, {
      bookFilter: value,
      view,
      jingleOnly: value === 'JINGLE',
      scrollOffset: 0,
    });
    setBookFilter(value);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const rememberBookScroll = (
    offset: number,
  ) => {
    scrollOffsetRef.current = offset;

    mergeScreenState<BookListPreservedState>(
      BOOK_STATE_KEY,
      {
        bookFilter,
        view,
        jingleOnly: bookFilter === 'JINGLE',
        scrollOffset: offset,
      },
    );
  };

  const restoreBookScroll = () => {
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

  const loadBooks = useCallback(async (asRefresh = false) => {
    asRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [nextBooks, nextCollectionFilters] = await Promise.all([
        bookApi.getAll(),
        collectionApi.getFilterChips('BOOK').catch(() => [] as CollectionFilterChip[]),
      ]);
      setBooks(nextBooks);
      setCollectionFilters(nextCollectionFilters);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Dohvat knjiga nije uspio.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadBooks();
    }, [loadBooks]),
  );

  const visibleBooks = books.filter((book) => {
    if (bookFilter === 'JINGLE' && !book.favourite) return false;
    if (bookFilter !== 'ALL' && bookFilter !== 'JINGLE' && book.readingStatus !== bookFilter) return false;
    const activeCollection = collectionFilters.find(
      (chip) => chip.collectionId === activeCollectionId,
    );
    return !activeCollection || activeCollection.itemIds.includes(book.bookId);
  });

  // ljingleCollectionChipsR1: collection item taps reveal the exact catalogue row.
  const requestedCollectionId = route.params?.collectionId?.trim() || null;
  const focusBookId = route.params?.focusBookId?.trim() || null;
  useEffect(() => {
    if (requestedCollectionId && activeCollectionId !== requestedCollectionId) {
      setActiveCollectionId(requestedCollectionId);
      return;
    }
    if (!focusBookId || visibleBooks.length === 0) return;
    if (bookFilter !== 'ALL') { selectBookFilter('ALL'); return; }
    if (view !== 'LIST') { selectBookView('LIST'); return; }
    const index = visibleBooks.findIndex((book) => book.bookId === focusBookId);
    if (index < 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.12 });
      navigation.setParams({ focusBookId: undefined, collectionId: undefined });
    }, 100);
    return () => clearTimeout(timer);
  }, [activeCollectionId, bookFilter, focusBookId, requestedCollectionId, view, visibleBooks]);

  const toggleBookJingle = useCallback(async (book: BookResponse) => {
    const next = !book.favourite;

    try {
      const payload = { ...book, favourite: next } as Record<string, unknown>;
      delete payload.bookId;
      delete payload.createdAt;
      delete payload.modifiedAt;

      await bookApi.update(book.bookId, payload as any);
      // semanticJingleFeedbackV1
      void semanticFeedback.jingle(next);

      setBooks((current) =>
        current.map((row) =>
          row.bookId === book.bookId
            ? { ...row, favourite: next }
            : row
        )
      );

      // jingleUniversalUndoV1
      registerUndo({
        label: next
          ? `Dodano u Jingle: ${book.title}`
          : `Maknuto iz Jingle: ${book.title}`,

        undo: async () => {
          const undoPayload = {
            ...book,
            favourite: book.favourite,
          } as Record<string, unknown>;

          delete undoPayload.bookId;
          delete undoPayload.createdAt;
          delete undoPayload.modifiedAt;

          const reverted = await bookApi.update(
            book.bookId,
            undoPayload as any,
          );

          setBooks((current) =>
            current.map((row) =>
              row.bookId === book.bookId
                ? reverted
                : row,
            ),
          );
        },
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Jingle nije spremljen.'
      );
    }
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <FlatList
        ref={listRef}
        key={coverGrid ? 'book-covers' : 'book-list'}
        data={visibleBooks}
        numColumns={coverGrid ? 3 : 1}
        ListHeaderComponent={
          <View style={styles.scrollHeader}>
            <View style={[styles.hero, celestialMode && styles.celestialHero]}>
              {/* ljingleCelestialMotionLanguageR1:books */}
              <CelestialMotionLayer preset="books" />
              {(celestialMode || classicLjingleMode) ? <CelestialAtmosphere variant="books" /> : null}
              <Text style={styles.eyebrow}>Katalog · Knjige</Text>
              <Text style={styles.heading}>Moje knjige</Text>
              {!loading && !error ? <Text style={styles.count}>{visibleBooks.length === 1 ? '1 knjiga u zbirci' : `${visibleBooks.length} knjiga u zbirci`}</Text> : null}
              <View style={styles.quickActions}>
                <Pressable accessibilityRole="button" onPress={() => navigation.navigate('BookMetadataImport')} style={({ pressed }) => [styles.quickAction, celestialMode && styles.celestialAction, pressed && styles.quickActionPressed]}><Text style={styles.quickActionIcon}>⌕</Text><Text style={styles.quickActionLabel}>Online pretraga</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => navigation.navigate('BookForm')} style={({ pressed }) => [styles.quickAction, celestialMode && styles.celestialAction, pressed && styles.quickActionPressed]}><Text style={styles.quickActionIcon}>+</Text><Text style={styles.quickActionLabel}>Ručno dodaj</Text></Pressable>
              </View>
              
              
            </View>
<CollectionFilterRail
                leftInset={22}
                topGap={6}
                bottomGap={0}
                activeCollectionId={activeCollectionId}
                chips={collectionFilters}
                onSelect={(collectionId) => {
                  setActiveCollectionId(collectionId);
                  selectBookFilter('ALL');
                }}
              />
<View style={styles.controlLine}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.jingleFilters}>
                  {bookStatusFilters.map((value) => { const active = bookFilter === value; const label = value === 'ALL' ? 'Sve' : value === 'JINGLE' ? 'Jingle' : readingStatusLabels[value]; return <AnimatedPressable cue="tap" key={value} accessibilityRole="button" onPress={() => selectBookFilter(value)} style={[styles.jingleFilter, active && styles.jingleFilterSelected]}><Text style={[styles.jingleFilterText, active && styles.jingleFilterTextSelected]}>{label}</Text></AnimatedPressable>; })}
                </ScrollView>
                {catalogueMode !== 'compact' ? <Pressable accessibilityRole="button" onPress={() => selectBookView(coverGrid ? 'LIST' : 'COVERS')} style={styles.viewToggle}><Text style={styles.viewToggleText}>{coverGrid ? '☰' : '▦'}</Text></Pressable> : null}
              </View>

          </View>
        }
        onScroll={(event) => {
          const y = event.nativeEvent.contentOffset.y;
          rememberBookScroll(y);
          // ljingleSemanticAliveR21Exact:parallax-books
          updateCelestialParallax(y);
          if (y <= 8) setQuickHeaderVisible(false);
          else if (y < previousScrollY.current - 4) setQuickHeaderVisible(true);
          else if (y > previousScrollY.current + 8) setQuickHeaderVisible(false);
          previousScrollY.current = y;
        }}
        scrollEventThrottle={16}
        onContentSizeChange={restoreBookScroll}
        keyExtractor={(item) => item.bookId}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({ offset: Math.max(0, index * Math.max(1, averageItemLength)), animated: false });
          setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.12 }), 140);
        }}
        columnWrapperStyle={coverGrid ? styles.coverGridRow : undefined}
        renderItem={({ item }) => coverGrid ? (
          <View style={styles.coverGridItem}><BookCard book={item} coverOnly onPress={() => navigation.navigate('BookDetails', { bookId: item.bookId })} /></View>
        ) : (
          <View style={styles.jingleRow}><BookCard book={item} onPress={() => navigation.navigate('BookDetails', { bookId: item.bookId })} /><Pressable accessibilityRole="button" accessibilityLabel={item.favourite ? 'Makni iz Jingle' : 'Dodaj u Jingle'} onPress={() => void toggleBookJingle(item)} style={({ pressed }) => [styles.jingleButton, pressed && styles.jinglePressed]}><JingleBellIcon active={item.favourite} inactiveOpacity={0.5} style={styles.jingleIcon} /></Pressable></View>
        )}
        contentContainerStyle={[styles.list, coverGrid && styles.coverGridList]}
        ListEmptyComponent={loading ? <FeedbackView type="loading" /> : error ? <FeedbackView type="error" message={error} onRetry={() => void loadBooks()} /> : <FeedbackView type="empty" />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadBooks(true)} tintColor={colors.black} colors={[colors.black]} />}
      />
      {quickHeaderVisible ? <View style={styles.floatingHeader}><Text style={styles.floatingTitle}>Moje knjige</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.floatingFilters}>{bookStatusFilters.map((value) => { const active = bookFilter === value; const label = value === 'ALL' ? 'Sve' : value === 'JINGLE' ? 'Jingle' : readingStatusLabels[value]; return <AnimatedPressable cue="tap" key={value} onPress={() => selectBookFilter(value)} style={[styles.jingleFilter, active && styles.jingleFilterSelected]}><Text style={[styles.jingleFilterText, active && styles.jingleFilterTextSelected]}>{label}</Text></AnimatedPressable>; })}</ScrollView></View> : null}
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
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hero: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
  },
  eyebrow: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 15,
  },
  heading: {
    marginTop: 3,
    color: colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  count: {
    marginTop: 7,
    color: colors.textMuted,
    fontSize: 14,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  quickAction: {
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
  quickActionPressed: {
    opacity: 0.65,
  },
  quickActionIcon: {
    color: colors.black,
    fontSize: 21,
    marginRight: 7,
  },
  quickActionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 22,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.black,
    borderRadius: 27,
    paddingHorizontal: 20,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  fabPlus: {
    color: colors.onAccent,
    fontSize: 24,
    lineHeight: 25,
    fontWeight: '400',
    marginRight: 8,
  },
  fabLabel: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '700',
  },
  jingleFilters: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingRight: 12,
  },
  jingleFilter: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  jingleFilterSelected: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  jingleFilterText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  jingleFilterTextSelected: {
    color: colors.onAccent,
  },
  jingleRow: {
    position: 'relative',
  },
  jingleButton: {
    position: 'absolute',
    top: 1,
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
