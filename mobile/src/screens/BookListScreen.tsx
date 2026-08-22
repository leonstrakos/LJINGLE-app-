import { useCallback, useRef, useState } from 'react';
import {
  Image,
  FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookCard } from '../components/BookCard';
import { FeedbackView } from '../components/FeedbackView';
import { bookApi } from '../services/bookApi';
import { colors } from '../theme/colors';
import {
  catalogueStateKey,
  mergeScreenState,
  readScreenState,
} from '../utils/screenStateCache';
import type { BookResponse } from '../types/book';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'BookList'>;

// bookStatePreservationV1
type BookListPreservedState = {
  jingleOnly: boolean;
  scrollOffset: number;
};

const BOOK_STATE_KEY =
  catalogueStateKey('books');

export function BookListScreen({ navigation }: Props) {
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

  // jingleBooksV1
  const [jingleOnly, setJingleOnly] =
    useState(
      initialScreenState?.jingleOnly ?? false,
    );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectJingleOnly = (
    value: boolean,
  ) => {
    scrollOffsetRef.current = 0;
    restoreScrollRef.current = false;

    mergeScreenState<BookListPreservedState>(
      BOOK_STATE_KEY,
      {
        jingleOnly: value,
        scrollOffset: 0,
      },
    );

    setJingleOnly(value);

    listRef.current?.scrollToOffset({
      offset: 0,
      animated: false,
    });
  };

  const rememberBookScroll = (
    offset: number,
  ) => {
    scrollOffsetRef.current = offset;

    mergeScreenState<BookListPreservedState>(
      BOOK_STATE_KEY,
      {
        jingleOnly,
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
      setBooks(await bookApi.getAll());
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

  const visibleBooks = jingleOnly
    ? books.filter((book) => book.favourite)
    : books;

  const toggleBookJingle = useCallback(async (book: BookResponse) => {
    const next = !book.favourite;

    try {
      const payload = { ...book, favourite: next } as Record<string, unknown>;
      delete payload.bookId;
      delete payload.createdAt;
      delete payload.modifiedAt;

      await bookApi.update(book.bookId, payload as any);

      setBooks((current) =>
        current.map((row) =>
          row.bookId === book.bookId
            ? { ...row, favourite: next }
            : row
        )
      );
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
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Katalog · Knjige</Text>
        <Text style={styles.heading}>Moje knjige</Text>
        {!loading && !error ? (
          <Text style={styles.count}>
            {visibleBooks.length === 1 ? '1 knjiga u zbirci' : `${visibleBooks.length} knjiga u zbirci`}
          </Text>
        ) : null}

        <View style={styles.quickActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('BookMetadataImport')}
            style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
          >
            <Text style={styles.quickActionIcon}>⌕</Text>
            <Text style={styles.quickActionLabel}>Online pretraga</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('BookStats')}
            style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
          >
            <Text style={styles.quickActionIcon}>▥</Text>
            <Text style={styles.quickActionLabel}>Statistika</Text>
          </Pressable>
        </View>
        <View style={styles.jingleFilters}>
          <Pressable
            accessibilityRole="button"
            onPress={() => selectJingleOnly(false)}
            style={[
              styles.jingleFilter,
              !jingleOnly && styles.jingleFilterSelected,
            ]}
          >
            <Text
              style={[
                styles.jingleFilterText,
                !jingleOnly && styles.jingleFilterTextSelected,
              ]}
            >
              Sve
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => selectJingleOnly(true)}
            style={[
              styles.jingleFilter,
              jingleOnly && styles.jingleFilterSelected,
            ]}
          >
            <Text
              style={[
                styles.jingleFilterText,
                jingleOnly && styles.jingleFilterTextSelected,
              ]}
            >
              Jingle
            </Text>
          </Pressable>
        </View>
      </View>

      {loading && books.length === 0 ? (
        <FeedbackView type="loading" />
      ) : error && books.length === 0 ? (
        <FeedbackView type="error" message={error} onRetry={() => void loadBooks()} />
      ) : (
        <FlatList
          ref={listRef}
          data={visibleBooks}
          onScroll={(event) => {
            rememberBookScroll(
              event.nativeEvent.contentOffset.y,
            );
          }}
          scrollEventThrottle={100}
          onContentSizeChange={restoreBookScroll}
          keyExtractor={(item) => item.bookId}
          renderItem={({ item }) => (
            <View style={styles.jingleRow}>
              <BookCard
                book={item}
                onPress={() =>
                  navigation.navigate('BookDetails', { bookId: item.bookId })
                }
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  item.favourite ? 'Makni iz Jingle' : 'Dodaj u Jingle'
                }
                onPress={() => void toggleBookJingle(item)}
                style={({ pressed }) => [
                  styles.jingleButton,
                  pressed && styles.jinglePressed,
                ]}
              >
                <Image
                  source={require('../assets/aero/fav.png')}
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
          ListEmptyComponent={<FeedbackView type="empty" />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadBooks(true)}
              tintColor={colors.black}
              colors={[colors.black]}
            />
          }
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dodaj novu knjigu"
        onPress={() => navigation.navigate('BookForm')}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Text style={styles.fabPlus}>+</Text>
        <Text style={styles.fabLabel}>Nova knjiga</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    paddingBottom: 112,
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
    color: colors.white,
    fontSize: 24,
    lineHeight: 25,
    fontWeight: '400',
    marginRight: 8,
  },
  fabLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  jingleFilters: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  jingleFilter: {
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    fontSize: 12,
    fontWeight: '700',
  },
  jingleFilterTextSelected: {
    color: colors.white,
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
});
