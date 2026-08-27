import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  catalogueStateKey,
  mergeScreenState,
  readScreenState,
} from '../utils/screenStateCache';

import { gameApi } from '../games/services/gameApi';
import {
  gameStatusLabels,
  type GameResponse,
} from '../games/types/game';
import { bookApi } from '../services/bookApi';
import { collectionApi } from '../services/collectionApi';
import { mediaApi } from '../services/mediaApi';
import { activityAccents, colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import type { BookResponse } from '../types/book';
import type { MediaResponse } from '../types/media';
import type { RootStackParamList } from '../types/navigation';
import { semanticFeedback } from '../utils/semanticFeedback';

import { CelestialAtmosphere } from '../components/CelestialAtmosphere';
import { celestial, celestialAlpha } from '../theme/celestial';
import { CollectionMemoryBoxGlyph } from '../components/CollectionMemoryBoxGlyph';

// forkN5GlyphReorderV1

type Props = NativeStackScreenProps<RootStackParamList, 'Catalogue'>;

const celestialMode = activeVisualSkinId === 'classic';

type Counts = {
  books: number;
  media: number;
  games: number;
  collections: number;
};

type CatalogueResult = {
  key: string;
  kind: 'BOOK' | 'MEDIA' | 'GAME';
  id: string;
  title: string;
  typeLabel: string;
  meta: string;

  searchType: 'BOOK' | 'MOVIE' | 'SERIES' | 'GAME';
  searchStatus: string;
  searchYear?: number;
  favourite: boolean;
};

const initialCounts: Counts = {
  books: 0,
  media: 0,
  games: 0,
  collections: 0,
};

function normalize(value: unknown) {
  return String(value ?? '')
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// catalogueHomeDeepSearchV2
// catalogueSearchPolishV3
// catalogueSearchVisibilityV4
type CatalogueSearchQuery = {
  terms: string[];
  jingle: boolean;
  type?: 'BOOK' | 'MOVIE' | 'SERIES' | 'GAME';
  status?: string;
  year?: number;
};

function parseCatalogueSearch(
  input: string,
): CatalogueSearchQuery {
  const result: CatalogueSearchQuery = {
    terms: [],
    jingle: false,
  };

  const tokens = normalize(input)
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    if (
      token === 'jingle' ||
      token === 'favorite' ||
      token === 'favourite'
    ) {
      result.jingle = true;
      continue;
    }

    const colon = token.indexOf(':');

    if (colon > 0) {
      const key = token.slice(0, colon);
      const value = token.slice(colon + 1);

      if (key === 'type') {
        if (value === 'movie' || value === 'film') {
          result.type = 'MOVIE';
          continue;
        }

        if (
          value === 'series' ||
          value === 'serija' ||
          value === 'tv'
        ) {
          result.type = 'SERIES';
          continue;
        }

        if (value === 'book' || value === 'knjiga') {
          result.type = 'BOOK';
          continue;
        }

        if (value === 'game' || value === 'igra') {
          result.type = 'GAME';
          continue;
        }
      }

      if (key === 'status' && value) {
        result.status = value;
        continue;
      }

      if (key === 'year') {
        const year = Number(value);

        if (
          Number.isInteger(year) &&
          year >= 1800 &&
          year <= 2200
        ) {
          result.year = year;
          continue;
        }
      }
    }

    result.terms.push(token);
  }

  return result;
}

// catalogueSearchAutocompleteV1
type SearchSuggestion = {
  label: string;
  token: string;
};

function getCatalogueSearchSuggestions(
  input: string,
): SearchSuggestion[] {
  const trimmedLeft = input.replace(/^\s+/, '');

  const lastWhitespace =
    Math.max(
      trimmedLeft.lastIndexOf(' '),
      trimmedLeft.lastIndexOf('\n'),
      trimmedLeft.lastIndexOf('\t'),
    );

  const currentToken =
    trimmedLeft
      .slice(lastWhitespace + 1)
      .toLocaleLowerCase();

  if (
    currentToken === 't' ||
    currentToken === 'ty' ||
    currentToken === 'typ'
  ) {
    return [
      {
        label: 'type:',
        token: 'type:',
      },
    ];
  }

  if (
    currentToken === 's' ||
    currentToken === 'st' ||
    currentToken === 'sta' ||
    currentToken === 'stat' ||
    currentToken === 'statu'
  ) {
    return [
      {
        label: 'status:',
        token: 'status:',
      },
    ];
  }

  if (
    currentToken === 'y' ||
    currentToken === 'ye' ||
    currentToken === 'yea'
  ) {
    return [
      {
        label: 'year:',
        token: 'year:',
      },
    ];
  }

  if (
    currentToken === 'j' ||
    currentToken === 'ji' ||
    currentToken === 'jin' ||
    currentToken === 'jing' ||
    currentToken === 'jingl'
  ) {
    return [
      {
        label: 'Jingle',
        token: 'jingle ',
      },
    ];
  }

  if (
    currentToken === 'type:' ||
    currentToken.startsWith('type:')
  ) {
    const typedValue =
      currentToken.slice('type:'.length);

    return [
      {
        label: 'Film',
        token: 'type:movie ',
      },
      {
        label: 'Serija',
        token: 'type:series ',
      },
      {
        label: 'Knjiga',
        token: 'type:book ',
      },
      {
        label: 'Igra',
        token: 'type:game ',
      },
    ].filter((suggestion) =>
      typedValue.length === 0 ||
      suggestion.token
        .slice('type:'.length)
        .startsWith(typedValue)
    );
  }

  if (
    currentToken === 'status:' ||
    currentToken.startsWith('status:')
  ) {
    const typedValue =
      currentToken.slice('status:'.length);

    return [
      {
        label: 'Gledam',
        token: 'status:watching ',
      },
      {
        label: 'Čitam',
        token: 'status:reading ',
      },
      {
        label: 'Igram',
        token: 'status:playing ',
      },
      {
        label: 'Instalirano',
        token: 'status:installed ',
      },
      {
        label: 'Završeno',
        token: 'status:completed ',
      },
      {
        label: 'Za poslije',
        token: 'status:planned ',
      },
      {
        label: 'Odustao/la',
        token: 'status:dropped ',
      },
    ].filter((suggestion) =>
      typedValue.length === 0 ||
      suggestion.token
        .slice('status:'.length)
        .startsWith(typedValue)
    );
  }

  return [];
}

function applyCatalogueSearchSuggestion(
  input: string,
  suggestion: SearchSuggestion,
) {
  const lastWhitespace =
    Math.max(
      input.lastIndexOf(' '),
      input.lastIndexOf('\n'),
      input.lastIndexOf('\t'),
    );

  const prefix =
    lastWhitespace >= 0
      ? input.slice(0, lastWhitespace + 1)
      : '';

  return prefix + suggestion.token;
}

function statusMatches(
  actual: unknown,
  wantedRaw: string,
) {
  const actualStatus = normalize(actual)
    .replace(/[\s-]+/g, '_');

  const wanted = normalize(wantedRaw)
    .replace(/[\s-]+/g, '_');

  if (actualStatus === wanted) {
    return true;
  }

  const aliases: Record<string, string[]> = {
    watching: ['watching'],
    gledam: ['watching'],

    reading: ['in_progress', 'reading'],
    citam: ['in_progress', 'reading'],

    playing: ['playing'],
    igram: ['playing'],

    installed: ['installed'],
    instalirano: ['installed'],

    completed: ['completed'],
    finished: ['completed'],
    zavrseno: ['completed'],

    planned: ['watchlist', 'backlog', 'planned'],
    watchlist: ['watchlist'],
    backlog: ['backlog'],

    dropped: ['dropped', 'quit'],
    odustao: ['dropped', 'quit'],

    quit: ['quit'],
  };

  return (aliases[wanted] ?? []).includes(actualStatus);
}



// catalogueSearchRankingV1

function catalogueRankingText(raw: string) {
  const tokens = raw
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const plain = tokens.filter((token) => {
    const value = normalize(token);

    if (value === 'jingle') {
      return false;
    }

    if (
      /^type:(movie|series|book|game)$/.test(
        value,
      )
    ) {
      return false;
    }

    if (
      /^status:(watching|reading|playing|installed|completed|planned|dropped)$/.test(
        value,
      )
    ) {
      return false;
    }

    if (/^year:\d{4}$/.test(value)) {
      return false;
    }

    return true;
  });

  return normalize(plain.join(' '));
}

function catalogueResultRank(
  item: CatalogueResult,
  raw: string,
) {
  const query =
    catalogueRankingText(raw);

  // Pure token query:
  // preserve the existing filter/result order exactly.
  if (!query) {
    return 0;
  }

  const title =
    normalize(item.title);

  // 0 — exact title
  if (title === query) {
    return 0;
  }

  // 1 — title begins with the full query
  if (title.startsWith(query)) {
    return 1;
  }

  const words = title
    .split(
      /[\s\-–—:;,.!?()[\]{}'"\/\\]+/,
    )
    .filter(Boolean);

  // 2 — complete title word
  if (
    words.some(
      (word) => word === query,
    )
  ) {
    return 2;
  }

  // 3 — beginning of any title word
  if (
    words.some(
      (word) =>
        word.startsWith(query),
    )
  ) {
    return 3;
  }

  // 4 — arbitrary title substring
  if (title.includes(query)) {
    return 4;
  }

  // 5 — metadata substring.
  //
  // Deliberately excludes internal key/id/title so an UUID
  // can never accidentally improve relevance.
  const metadata = normalize(
    Object.entries(item)
      .filter(
        ([key, value]) =>
          key !== 'key' &&
          key !== 'id' &&
          key !== 'title' &&
          typeof value === 'string',
      )
      .map(([, value]) =>
        String(value),
      )
      .join(' '),
  );

  if (metadata.includes(query)) {
    return 5;
  }

  // Existing filter may have matched multiple free terms
  // independently. Keep such valid results last.
  return 6;
}

// catalogueHomeStatePreservationV1
type CatalogueHomePreservedState = {
  query: string;
  scrollOffset: number;
};

const CATALOGUE_HOME_STATE_KEY =
  catalogueStateKey('home');

export function CatalogueHomeScreen({ navigation }: Props) {
  // catalogueHomeStatePreservationV1
  const initialScreenState = useRef(
    readScreenState<CatalogueHomePreservedState>(
      CATALOGUE_HOME_STATE_KEY,
    ),
  ).current;

  const scrollRef =
    useRef<ScrollView>(null);

  const scrollOffsetRef = useRef(
    initialScreenState?.scrollOffset ?? 0,
  );

  const restoreScrollRef = useRef(
    (initialScreenState?.scrollOffset ?? 0) > 0,
  );

  // catalogueHomeDiscoveryV1
  const [counts, setCounts] = useState<Counts>(initialCounts);

  const [books, setBooks] = useState<BookResponse[]>([]);
  const [media, setMedia] = useState<MediaResponse[]>([]);
  const [games, setGames] = useState<GameResponse[]>([]);

  const [query, setQuery] = useState(
    initialScreenState?.query ?? '',
  );

  const [randomPick, setRandomPick] =
    useState<CatalogueResult | null>(null);

  const [seenRandomKeys, setSeenRandomKeys] =
    useState<string[]>([]);

  const [randomMessage, setRandomMessage] =
    useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // catalogueHomeStatePreservationV1
  useEffect(() => {
    mergeScreenState<CatalogueHomePreservedState>(
      CATALOGUE_HOME_STATE_KEY,
      {
        query,
        scrollOffset:
          scrollOffsetRef.current,
      },
    );
  }, [query]);

  const rememberCatalogueScroll = (
    offset: number,
  ) => {
    const safeOffset =
      Math.max(0, offset);

    scrollOffsetRef.current =
      safeOffset;

    mergeScreenState<CatalogueHomePreservedState>(
      CATALOGUE_HOME_STATE_KEY,
      {
        query,
        scrollOffset:
          safeOffset,
      },
    );
  };

  const restoreCatalogueScroll = () => {
    if (!restoreScrollRef.current) {
      return;
    }

    const offset =
      scrollOffsetRef.current;

    if (offset <= 0) {
      restoreScrollRef.current =
        false;

      return;
    }

    requestAnimationFrame(() => {
      try {
        scrollRef.current?.scrollTo({
          y: offset,
          animated: false,
        });

        restoreScrollRef.current =
          false;
      } catch {
        // Content may still be measuring.
        // onContentSizeChange can retry.
      }
    });
  };

  const loadCatalogue = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        loadedBooks,
        loadedMedia,
        loadedGames,
        collections,
      ] = await Promise.all([
        bookApi.getAll(),
        mediaApi.getAll(),
        gameApi.getAll(),
        collectionApi.getAll(),
      ]);

      setBooks(loadedBooks);
      setMedia(loadedMedia);
      setGames(loadedGames);

      setCounts({
        books: loadedBooks.length,
        media: loadedMedia.length,
        games: loadedGames.length,
        collections: collections.length,
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Katalog se nije potpuno učitao.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCatalogue();
    }, [loadCatalogue]),
  );

  const searchSuggestions = useMemo(
    () => getCatalogueSearchSuggestions(query),
    [query],
  );

  const searchResults = useMemo(() => {
    if (!query.trim()) {
      return [];
    }

    const parsed = parseCatalogueSearch(query);

    const all: CatalogueResult[] = [
      ...books.map((book): CatalogueResult => ({
        key: 'BOOK:' + book.bookId,
        kind: 'BOOK',
        id: book.bookId,
        title: book.title,
        typeLabel: 'Knjiga',
        meta: [
          book.author,
          book.publishedYear,
        ]
          .filter(Boolean)
          .join(' · '),

        searchType: 'BOOK',
        searchStatus: String(book.readingStatus ?? ''),
        searchYear: book.publishedYear,
        favourite: Boolean(book.favourite),
      })),

      ...media.map((item): CatalogueResult => ({
        key: 'MEDIA:' + item.mediaId,
        kind: 'MEDIA',
        id: item.mediaId,
        title: item.title,
        typeLabel:
          item.mediaType === 'MOVIE'
            ? 'Film'
            : 'Serija',
        meta: [
          item.originalTitle &&
          item.originalTitle !== item.title
            ? item.originalTitle
            : null,
          item.releaseYear,
        ]
          .filter(Boolean)
          .join(' · '),

        searchType:
          item.mediaType === 'MOVIE'
            ? 'MOVIE'
            : 'SERIES',
        searchStatus: String(item.watchStatus ?? ''),
        searchYear: item.releaseYear ?? undefined,
        favourite: Boolean(item.favourite),
      })),

      ...games.map((game): CatalogueResult => ({
        key: 'GAME:' + game.gameId,
        kind: 'GAME',
        id: game.gameId,
        title: game.title,
        typeLabel: 'Igra',
        meta: [
          game.developer,
          game.platform,
          game.releaseYear,
        ]
          .filter(Boolean)
          .join(' · '),

        searchType: 'GAME',
        searchStatus: String(game.gameStatus ?? ''),
        searchYear: game.releaseYear ?? undefined,
        favourite: Boolean(game.favourite),
      })),
    ];

    return all
      .filter((item) => {
        if (
          parsed.jingle &&
          !item.favourite
        ) {
          return false;
        }

        if (
          parsed.type &&
          item.searchType !== parsed.type
        ) {
          return false;
        }

        if (
          parsed.year !== undefined &&
          item.searchYear !== parsed.year
        ) {
          return false;
        }

        if (
          parsed.status &&
          !statusMatches(
            item.searchStatus,
            parsed.status,
          )
        ) {
          return false;
        }

        if (parsed.terms.length === 0) {
          return true;
        }

        const haystack = normalize(
          [
            item.title,
            item.typeLabel,
            item.meta,
          ].join(' ')
        );

        return parsed.terms.every(
          (term) => haystack.includes(term)
        );
      })
      .sort((a, b) =>
        a.title.localeCompare(b.title)
      )
      .slice(0, 18)
      // catalogueSearchRankingV1
      .sort((left, right) => {
        const leftRank =
          catalogueResultRank(
            left,
            query,
          );

        const rightRank =
          catalogueResultRank(
            right,
            query,
          );

        // Stable sort keeps the previous catalogue ordering
        // for equal relevance and for pure structured queries.
        return leftRank - rightRank;
      });
  }, [books, games, media, query]);

  const searchTerms = useMemo(
    () => parseCatalogueSearch(query).terms,
    [query],
  );

  const searchChips = useMemo(() => {
    if (!query.trim()) return [];

    const parsed = parseCatalogueSearch(query);
    const chips: string[] = [];

    if (parsed.jingle) {
      chips.push('Jingle');
    }

    if (parsed.type) {
      const typeLabels = {
        BOOK: 'Knjiga',
        MOVIE: 'Film',
        SERIES: 'Serija',
        GAME: 'Igra',
      } as const;

      chips.push(typeLabels[parsed.type]);
    }

    if (parsed.status) {
      const key = normalize(parsed.status)
        .replace(/[\s-]+/g, '_');

      const statusLabels: Record<string, string> = {
        watching: 'Gledam',
        gledam: 'Gledam',

        reading: 'Čitam',
        citam: 'Čitam',
        in_progress: 'Čitam',

        playing: 'Igram',
        igram: 'Igram',

        installed: 'Instalirano',
        instalirano: 'Instalirano',

        completed: 'Završeno',
        finished: 'Završeno',
        zavrseno: 'Završeno',

        planned: 'Za poslije',
        watchlist: 'Za pogledati',
        backlog: 'Za poslije',

        dropped: 'Odustao/la',
        odustao: 'Odustao/la',

        quit: 'Quit',
      };

      chips.push(
        statusLabels[key] ?? parsed.status
      );
    }

    if (parsed.year !== undefined) {
      chips.push(String(parsed.year));
    }

    return chips;
  }, [query]);

  const activeCandidates = useMemo(() => {
    const candidates: CatalogueResult[] = [];

    for (const book of books) {
      const status = normalize(book.readingStatus);

      if (
        status !== 'in_progress' &&
        status !== 'reading'
      ) {
        continue;
      }

      candidates.push({
        key: 'BOOK:' + book.bookId,
        kind: 'BOOK',
        id: book.bookId,
        title: book.title,
        typeLabel: 'Čitaš',
        meta: [
          book.author,
          book.publishedYear,
        ]
          .filter(Boolean)
          .join(' · '),

        searchType: 'BOOK',
        searchStatus: String(book.readingStatus ?? ''),
        searchYear: book.publishedYear,
        favourite: Boolean(book.favourite),
      });
    }

    for (const item of media) {
      if (normalize(item.watchStatus) !== 'watching') {
        continue;
      }

      candidates.push({
        key: 'MEDIA:' + item.mediaId,
        kind: 'MEDIA',
        id: item.mediaId,
        title: item.title,
        typeLabel:
          item.mediaType === 'MOVIE'
            ? 'Gledaš · Film'
            : 'Gledaš · Serija',
        meta: item.releaseYear
          ? String(item.releaseYear)
          : '',

        searchType:
          item.mediaType === 'MOVIE'
            ? 'MOVIE'
            : 'SERIES',
        searchStatus: String(item.watchStatus ?? ''),
        searchYear: item.releaseYear ?? undefined,
        favourite: Boolean(item.favourite),
      });
    }

    for (const game of games) {
      const rawStatus = normalize(game.gameStatus);
      const visibleStatus = normalize(
        gameStatusLabels[game.gameStatus]
      );

      const playing =
        rawStatus === 'playing' ||
        visibleStatus === 'igram';

      const installed =
        rawStatus === 'installed' ||
        visibleStatus === 'instalirano';

      if (!playing && !installed) {
        continue;
      }

      candidates.push({
        key: 'GAME:' + game.gameId,
        kind: 'GAME',
        id: game.gameId,
        title: game.title,
        typeLabel: playing
          ? 'Igraš'
          : 'Instalirano',
        meta: [
          game.platform,
          game.developer,
        ]
          .filter(Boolean)
          .join(' · '),

        searchType: 'GAME',
        searchStatus: String(game.gameStatus ?? ''),
        searchYear: game.releaseYear ?? undefined,
        favourite: Boolean(game.favourite),
      });
    }

    return candidates;
  }, [books, games, media]);

  const openResult = (result: CatalogueResult) => {
    if (result.kind === 'BOOK') {
      navigation.navigate(
        'BookDetails',
        { bookId: result.id },
      );
      return;
    }

    if (result.kind === 'MEDIA') {
      (navigation as any).navigate(
        'Media',
        {
          screen: 'MediaDetails',
          params: {
            mediaId: result.id,
          },
        },
      );
      return;
    }

    (navigation as any).navigate(
      'Games',
      {
        screen: 'GameDetails',
        params: {
          gameId: result.id,
        },
      },
    );
  };

  const pickSomething = () => {
    if (activeCandidates.length === 0) {
      setRandomPick(null);
      setRandomMessage(
        'Trenutno nema ničega u Čitam, Gledam, Igram ili Instalirano.'
      );
      return;
    }

    let remaining = activeCandidates.filter(
      (item) =>
        !seenRandomKeys.includes(item.key)
    );

    let nextSeen = seenRandomKeys;

    if (remaining.length === 0) {
      remaining = activeCandidates;
      nextSeen = [];
    }

    const picked =
      remaining[
        Math.floor(Math.random() * remaining.length)
      ];

    if (!picked) return;

    // semanticRandomPickFeedbackV1
    void semanticFeedback.randomPick();
    setRandomPick(picked);
    setRandomMessage('');
    setSeenRandomKeys([
      ...nextSeen,
      picked.key,
    ]);
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['left', 'right', 'bottom']}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          rememberCatalogueScroll(
            event.nativeEvent.contentOffset.y,
          );
        }}
        scrollEventThrottle={100}
        onContentSizeChange={
          restoreCatalogueScroll
        }
      >
        <View style={[styles.hero, celestialMode && styles.celestialHero]}>
        {celestialMode ? <CelestialAtmosphere variant="catalogue" /> : null}
          <Text style={styles.heading}>
            Katalog
          </Text>

          <Text style={styles.intro}>
            Sve što čitaš, gledaš i igraš na jednom mjestu.
            Odaberi zbirku za pregled, dodavanje ili nastavak aktivnosti.
          </Text>
</View>

        {error ? (
          <Pressable
            onPress={() => void loadCatalogue()}
            style={styles.errorBanner}
          >
            <Text style={styles.errorText}>
              {error}
            </Text>
            <Text style={styles.retryText}>
              Pokušaj ponovno
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.discovery}>
          <View style={[styles.searchShell, celestialMode && styles.celestialSearchShell]}>
            <Text style={styles.searchMark}>
              ⌕
            </Text>

            <TextInput
              accessibilityLabel="Pretraži cijeli katalog"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Naslov · type:movie · jingle · year:2024"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />

            {query.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Očisti pretragu"
                hitSlop={8}
                onPress={() => setQuery('')}
                style={({ pressed }) => [
                  styles.clearButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.clearText}>
                  ×
                </Text>
              </Pressable>
            ) : null}
          </View>

          {searchSuggestions.length > 0 ? (
            <View style={styles.autocompleteRow}>
              {searchSuggestions.map(
                (suggestion) => (
                  <Pressable
                    key={suggestion.token}
                    accessibilityRole="button"
                    accessibilityLabel={
                      'Dovrši pretragu: ' +
                      suggestion.label
                    }
                    onPress={() => {
                      setQuery(
                        applyCatalogueSearchSuggestion(
                          query,
                          suggestion,
                        ),
                      );
                    }}
                    style={({ pressed }) => [
                      styles.autocompleteChip,
                      pressed &&
                        styles.autocompleteChipPressed,
                    ]}
                  >
                    <Text
                      style={styles.autocompleteChipText}
                    >
                      {suggestion.label}
                    </Text>
                  </Pressable>
                ),
              )}
            </View>
          ) : null}

          {query.trim().length > 0 ? (
            <>
              {searchChips.length > 0 ? (
                <View style={styles.searchChips}>
                  {searchChips.map((chip) => (
                    <View
                      key={chip}
                      style={styles.searchChip}
                    >
                      <Text style={styles.searchChipText}>
                        {chip}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={[styles.resultsPanel, celestialMode && styles.celestialPanel]}>
              <View style={styles.resultsHeading}>
                <Text style={styles.resultsTitle}>
                  Rezultati
                </Text>
                <Text style={styles.resultsCount}>
                  {searchResults.length}
                </Text>
              </View>

              {searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <Pressable
                    key={result.key}
                    accessibilityRole="button"
                    onPress={() =>
                      openResult(result)
                    }
                    style={({ pressed }) => [
                      styles.resultRow,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.resultType}>
                      <Text style={styles.resultTypeText}>
                        {result.typeLabel.toLocaleUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.resultCopy}>
                      <HighlightedCatalogueTitle
                        title={result.title}
                        terms={searchTerms}
                      />

                      {result.meta ? (
                        <Text
                          numberOfLines={1}
                          style={styles.resultMeta}
                        >
                          {result.meta}
                        </Text>
                      ) : null}
                    </View>

                    {result.favourite ? (
                      <Image
                        accessibilityLabel="Jingle"
                        source={require('../assets/aero/fav.png')}
                        style={styles.resultJingleIcon}
                      />
                    ) : null}

                    <Text style={styles.resultArrow}>
                      ›
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.emptyResults}>
                  Nema spremljenih rezultata.
                </Text>
              )}
              </View>
            </>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={pickSomething}
            style={({ pressed }) => [
              styles.randomButton,
              celestialMode && styles.celestialPanel,
              pressed && styles.randomButtonPressed,
              loading && styles.randomButtonDisabled,
            ]}
          >
            <View style={styles.randomCopy}>
              <Text style={styles.randomTitle}>
                Odaberi mi nešto
              </Text>
              <Text style={styles.randomSubtitle}>
                Samo Čitam · Gledam · Igram · Instalirano
              </Text>
            </View>

            <Text style={styles.randomMark}>
              ↝
            </Text>
          </Pressable>

          {randomPick ? (
            <View style={[styles.randomResult, celestialMode && styles.celestialSoftPanel]}>
              <Text style={styles.randomEyebrow}>
                {randomPick.typeLabel}
              </Text>

              <Text style={styles.randomResultTitle}>
                {randomPick.title}
              </Text>

              {randomPick.meta ? (
                <Text style={styles.randomMeta}>
                  {randomPick.meta}
                </Text>
              ) : null}

              <View style={styles.randomActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={pickSomething}
                  style={({ pressed }) => [
                    styles.rerollButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.rerollText}>
                    Ponovno izvuci
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    openResult(randomPick)
                  }
                  style={({ pressed }) => [
                    styles.openButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.openButtonText}>
                    Otvori
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : randomMessage ? (
            <Text style={styles.randomMessage}>
              {randomMessage}
            </Text>
          ) : null}
        </View>

        <View style={styles.categories}>
          <CatalogueCard
            accent={activityAccents.READING.foreground}
            count={counts.books}
            detail="Čitanje, napredak, statistika i online pretraga"
            loading={loading}
            mark="≡"
            onPress={() =>
              navigation.navigate('BookList')
            }
            title="Knjige"
          />

          <CatalogueCard
            accent={activityAccents.WATCHING.foreground}
            count={counts.media}
            detail="Filmovi, serije, watchlist i vrijeme gledanja"
            loading={loading}
            mark="▶"
            onPress={() =>
              navigation.navigate('Media')
            }
            title="Filmovi i serije"
          />

          <CatalogueCard
            accent={activityAccents.PLAYING.foreground}
            count={counts.games}
            detail="Backlog, platforme, napredak i vrijeme igranja"
            loading={loading}
            mark="◇"
            onPress={() =>
              navigation.navigate('Games')
            }
            title="Igre"
          />

          <CatalogueCard
            accent={colors.navy}
            count={counts.collections}
            detail="Police i liste koje miješaju knjige, filmove, igre, teme i zapise"
            loading={loading}
            mark="⊞"
            onPress={() =>
              navigation.navigate('Collections')
            }
            title="Collections"
          />
        </View>

        <View style={[styles.note, celestialMode && styles.celestialSoftPanel]}>
          <Text style={styles.noteMark}>
            i
          </Text>

          <View style={styles.noteCopy}>
            <Text style={styles.noteTitle}>
              Dodavanje pripada svojoj zbirci
            </Text>

            <Text style={styles.noteText}>
              Svaka zbirka ima vlastitu online pretragu za dodavanje.
              Ovdje pretražuješ sve što je već spremljeno.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type CatalogueCardProps = {
  accent: string;
  count: number;
  detail: string;
  loading: boolean;
  mark: string;
  onPress: () => void;
  title: string;
};

function CatalogueCard({
  accent,
  count,
  detail,
  loading,
  mark,
  onPress,
  title,
}: CatalogueCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        celestialMode && styles.celestialCategoryCard,
        pressed && styles.cardPressed,
      ]}
    >
      <View
        style={[
          styles.cardMark,
          { backgroundColor: accent },
        ]}
      >
        {title === 'Knjige' ? (
          <View
            pointerEvents="none"
            style={styles.catalogueBookGlyphV2}
          >
            <View
              style={[
                styles.catalogueBookPageV2,
                styles.catalogueBookLeftV2,
              ]}
            />
            <View
              style={[
                styles.catalogueBookPageV2,
                styles.catalogueBookRightV2,
              ]}
            />
            <View
              style={styles.catalogueBookSpineV2}
            />
          </View>
        ) : title === 'Igre' ? (
          <View
            pointerEvents="none"
            style={styles.catalogueJoystickGlyphV2}
          >
            <View
              style={styles.catalogueJoystickStickV2}
            />
            <View
              style={styles.catalogueJoystickBallV2}
            />
            <View
              style={styles.catalogueJoystickBaseV2}
            />
            <View
              style={styles.catalogueJoystickBaseInnerV2}
            />
          </View>
        ) : title === 'Collections' || title === 'Kolekcije' ? (
          <>
            {/* forkN5GlyphReorderV1:catalogue-memory-box */}
            <CollectionMemoryBoxGlyph
              color={colors.white}
              size={32}
            />
          </>
        ) : (
          <Text style={styles.cardMarkText}>
            {mark}
          </Text>
        )}
        {/* finalJingleHomeCatalogueControlsV2:catalogue-glyphs */}
      </View>

      <View style={styles.cardCopy}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>
            {title}
          </Text>

          {loading ? (
            <ActivityIndicator
              color={colors.textMuted}
              size="small"
            />
          ) : (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {count}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.cardDetail}>
          {detail}
        </Text>

        <Text style={styles.openLabel}>
          Otvori zbirku
        </Text>
      </View>

      {celestialMode ? <Text style={styles.celestialCardStar}>✦</Text> : null}
      <Text style={styles.arrow}>
        ›
      </Text>
    </Pressable>
  );
}

function HighlightedCatalogueTitle({
  title,
  terms,
}: {
  title: string;
  terms: string[];
}) {
  const usefulTerms = terms
    .map((term) => term.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (usefulTerms.length === 0) {
    return (
      <Text
        numberOfLines={1}
        style={styles.resultTitle}
      >
        {title}
      </Text>
    );
  }

  const escaped = usefulTerms.map((term) =>
    term.replace(/[.*+?^${}()|[\]\\]/g, '\\const styles = StyleSheet.create({')
  );

  let matcher: RegExp;

  try {
    matcher = new RegExp(
      '(' + escaped.join('|') + ')',
      'gi',
    );
  } catch {
    return (
      <Text
        numberOfLines={1}
        style={styles.resultTitle}
      >
        {title}
      </Text>
    );
  }

  const parts = title.split(matcher);

  return (
    <Text
      numberOfLines={1}
      style={styles.resultTitle}
    >
      {parts.map((part, index) => {
        const highlighted = usefulTerms.some(
          (term) =>
            normalize(part) === normalize(term)
        );

        return (
          <Text
            key={index}
            style={
              highlighted
                ? styles.resultHighlight
                : undefined
            }
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 48,
  },

  hero: {
    paddingHorizontal: 3,
    paddingBottom: 20,
  },

  heading: {
    color: colors.text,
    fontSize: 40,
    lineHeight: 47,
    fontWeight: '900',
    letterSpacing: -1.2,
  },

  intro: {
    maxWidth: 590,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },

  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },

  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },

  retryText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },

  discovery: {
    gap: 10,
    marginBottom: 18,
  },

  searchShell: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 17,
    paddingLeft: 14,
    paddingRight: 6,
  },

  searchMark: {
    color: colors.textMuted,
    fontSize: 20,
    marginRight: 9,
  },

  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },

  clearButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  clearText: {
    color: colors.textMuted,
    fontSize: 22,
    lineHeight: 24,
  },

  autocompleteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    paddingHorizontal: 2,
  },

  autocompleteChip: {
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },

  autocompleteChipPressed: {
    opacity: 0.58,
    transform: [{ scale: 0.97 }],
  },

  autocompleteChipText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },

  searchChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 2,
  },

  searchChip: {
    minHeight: 25,
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: colors.separator,
  },

  searchChipText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.15,
  },

  resultsPanel: {
    overflow: 'hidden',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },

  resultsHeading: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },

  resultsTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },

  resultsCount: {
    color: colors.textMuted,
    fontSize: 12,
    marginLeft: 7,
  },

  resultRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },

  resultType: {
    minWidth: 66,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: colors.fillStrong,
  },

  resultTypeText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.45,
  },

  resultCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 11,
  },

  resultTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },

  resultMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },

  resultHighlight: {
    color: colors.text,
    backgroundColor: colors.fillStrong,
    fontWeight: '900',
    textDecorationLine: 'underline',
  },

  resultJingleIcon: {
    width: 18,
    height: 21,
    resizeMode: 'contain',
    marginLeft: 8,
  },

  resultArrow: {
    color: colors.textMuted,
    fontSize: 22,
    marginLeft: 8,
  },

  emptyResults: {
    color: colors.textMuted,
    fontSize: 13,
    padding: 16,
  },

  randomButton: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 17,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },

  randomButtonPressed: {
    opacity: 0.68,
    transform: [{ scale: 0.995 }],
  },

  randomButtonDisabled: {
    opacity: 0.55,
  },

  randomCopy: {
    flex: 1,
  },

  randomTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },

  randomSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },

  randomMark: {
    color: colors.text,
    fontSize: 24,
    marginLeft: 12,
  },

  randomResult: {
    padding: 17,
    borderRadius: 17,
    backgroundColor: colors.fill,
  },

  randomEyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  randomResultTitle: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
    marginTop: 5,
  },

  randomMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },

  randomActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },

  rerollButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },

  rerollText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },

  openButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.black,
  },

  openButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },

  randomMessage: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 4,
  },

  pressed: {
    opacity: 0.62,
  },

  categories: {
    gap: 12,
  },

  card: {
    minHeight: 134,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },

  cardPressed: {
    // finalJingleHomeCatalogueControlsV2:motion
    opacity: 0.96,
    transform: [{ scale: 0.988 }],
  },

  cardMark: {
    width: 62,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },

  // finalJingleHomeCatalogueControlsV2:catalogue-styles
  catalogueBookGlyphV2: {
    width: 38,
    height: 30,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  catalogueBookPageV2: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: 'transparent',
  },
  catalogueBookLeftV2: {
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
    borderTopRightRadius: 1,
    borderBottomRightRadius: 1,
    transform: [{ rotate: '-2deg' }],
  },
  catalogueBookRightV2: {
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
    borderTopLeftRadius: 1,
    borderBottomLeftRadius: 1,
    transform: [{ rotate: '2deg' }],
  },
  catalogueBookSpineV2: {
    position: 'absolute',
    left: '50%',
    top: 3,
    width: 2,
    height: 24,
    marginLeft: -1,
    backgroundColor: colors.white,
    borderRadius: 1,
  },
  catalogueJoystickGlyphV2: {
    width: 40,
    height: 34,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  catalogueJoystickStickV2: {
    position: 'absolute',
    top: 8,
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: colors.white,
  },
  catalogueJoystickBallV2: {
    position: 'absolute',
    top: 2,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.white,
  },
  catalogueJoystickBaseV2: {
    width: 32,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: 'transparent',
  },
  catalogueJoystickBaseInnerV2: {
    position: 'absolute',
    bottom: 4,
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.white,
    opacity: 0.72,
  },

  cardMarkText: {
    color: colors.white,
    fontSize: 25,
    fontWeight: '800',
  },

  cardCopy: {
    flex: 1,
    marginLeft: 16,
  },

  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  cardTitle: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
  },

  countBadge: {
    minWidth: 26,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fillStrong,
    borderRadius: 12,
    paddingHorizontal: 7,
    marginLeft: 9,
  },

  countText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },

  cardDetail: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },

  openLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
  },

  arrow: {
    color: colors.textMuted,
    fontSize: 32,
    fontWeight: '300',
    marginLeft: 10,
  },

  note: {
    flexDirection: 'row',
    padding: 16,
    marginTop: 18,
    borderRadius: 17,
    backgroundColor: colors.fill,
  },

  noteMark: {
    width: 28,
    height: 28,
    color: colors.white,
    backgroundColor: colors.black,
    borderRadius: 14,
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 13,
    fontWeight: '800',
  },

  noteCopy: {
    flex: 1,
    marginLeft: 12,
  },

  noteTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },

  noteText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  celestialHero: {
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: celestialAlpha(celestial.gold, 0.28),
  },
  celestialSearchShell: {
    borderColor: celestialAlpha(celestial.gold, 0.40),
    shadowColor: celestial.gold,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
  },
  celestialPanel: {
    borderColor: celestialAlpha(celestial.gold, 0.34),
    shadowColor: celestial.gold,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  celestialSoftPanel: {
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.24),
  },
  celestialCategoryCard: {
    position: 'relative',
    overflow: 'hidden',
    borderColor: celestialAlpha(celestial.gold, 0.38),
    shadowColor: celestial.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  celestialCardStar: {
    color: celestial.gold,
    fontSize: 12,
    marginLeft: 10,
    opacity: 0.82,
  },

});
