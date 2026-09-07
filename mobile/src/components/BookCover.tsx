// ljingleOfflineBookCoversV1
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { bookCoverCacheKey, getCachedBookCover, persistBookCover, forgetBrokenBookCover } from '../services/bookCoverCache';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { colors } from '../theme/colors';

export type CoverSize = 'S' | 'M' | 'L';

export function getBookCoverUrl(isbn: string, size: CoverSize = 'M') {
  const normalizedIsbn = isbn.replace(/[^0-9Xx]/g, '').toUpperCase();

  if (!normalizedIsbn) return null;

  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(
    normalizedIsbn,
  )}-${size}.jpg?default=false`;
}

type OpenLibrarySearchResponse = {
  docs?: Array<{
    cover_i?: number;
  }>;
};

type GoogleBooksResponse = {
  items?: Array<{
    volumeInfo?: {
      imageLinks?: {
        smallThumbnail?: string;
        thumbnail?: string;
        small?: string;
        medium?: string;
        large?: string;
        extraLarge?: string;
      };
    };
  }>;
};

const fallbackCache = new Map<string, Promise<string | null>>();

function secureImageUrl(url?: string) {
  return url?.replace(/^http:\/\//i, 'https://') ?? null;
}

async function searchOpenLibraryCover(title: string, author?: string) {
  try {
    const params = new URLSearchParams({
      title: title.trim(),
      fields: 'cover_i',
      limit: '1',
    });

    if (author?.trim()) {
      params.set('author', author.trim());
    }

    const response = await fetch(
      `https://openlibrary.org/search.json?${params.toString()}`,
    );

    if (!response.ok) return null;

    const payload = (await response.json()) as OpenLibrarySearchResponse;

    return payload.docs?.find((book) => book.cover_i)?.cover_i ?? null;
  } catch {
    return null;
  }
}

function pickGoogleCover(
  response: GoogleBooksResponse,
  size: CoverSize,
) {
  const links = response.items?.find(
    (item) => item.volumeInfo?.imageLinks,
  )?.volumeInfo?.imageLinks;

  if (!links) return null;

  if (size === 'L') {
    return secureImageUrl(
      links.extraLarge ??
        links.large ??
        links.medium ??
        links.thumbnail ??
        links.smallThumbnail,
    );
  }

  if (size === 'M') {
    return secureImageUrl(
      links.medium ??
        links.small ??
        links.thumbnail ??
        links.smallThumbnail,
    );
  }

  return secureImageUrl(
    links.smallThumbnail ??
      links.thumbnail ??
      links.small ??
      links.medium,
  );
}

async function searchGoogleBooksCover(
  query: string,
  size: CoverSize,
) {
  try {
    const params = new URLSearchParams({
      q: query,
      maxResults: '5',
      projection: 'lite',
    });

    const apiKey =
      process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY?.trim();

    if (apiKey) {
      params.set('key', apiKey);
    }

    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
    );

    if (!response.ok) return null;

    const payload = (await response.json()) as GoogleBooksResponse;

    return pickGoogleCover(payload, size);
  } catch {
    return null;
  }
}

function findFallbackCoverUrl(
  isbn: string,
  title: string,
  author: string | undefined,
  size: CoverSize,
) {
  const normalizedIsbn = isbn
    .replace(/[^0-9Xx]/g, '')
    .toUpperCase();

  const cacheKey = [
    normalizedIsbn,
    title.trim(),
    author?.trim() ?? '',
    size,
  ].join('|');

  const cached = fallbackCache.get(cacheKey);

  if (cached) return cached;

  const lookup = (async () => {
    // First fallback: Google Books using ISBN.
    if (normalizedIsbn) {
      const googleIsbnCover = await searchGoogleBooksCover(
        `isbn:${normalizedIsbn}`,
        size,
      );

      if (googleIsbnCover) return googleIsbnCover;
    }

    if (!title.trim()) return null;

    // Second fallback: Open Library using title and author.
    const exactOpenLibraryId = await searchOpenLibraryCover(
      title,
      author,
    );

    const openLibraryId =
      exactOpenLibraryId ??
      (author ? await searchOpenLibraryCover(title) : null);

    if (openLibraryId) {
      return `https://covers.openlibrary.org/b/id/${openLibraryId}-${size}.jpg?default=false`;
    }

    // Third fallback: Google Books using title and author.
    const exactGoogleQuery = author?.trim()
      ? `intitle:${title.trim()} inauthor:${author.trim()}`
      : `intitle:${title.trim()}`;

    const exactGoogleCover = await searchGoogleBooksCover(
      exactGoogleQuery,
      size,
    );

    if (exactGoogleCover) return exactGoogleCover;

    // Final attempt: Google Books using only the title.
    return searchGoogleBooksCover(
      `intitle:${title.trim()}`,
      size,
    );
  })();

  fallbackCache.set(cacheKey, lookup);
  void lookup.then(() => fallbackCache.delete(cacheKey), () => fallbackCache.delete(cacheKey));

  return lookup;
}

type Props = {
  isbn: string;
  title: string;
  author?: string;
  size?: CoverSize;
  style?: StyleProp<ViewStyle>;
  onCoverResolved?: (url: string | null) => void;
};

export function BookCover({ isbn, title, author, size = 'M', style, onCoverResolved }: Props) {
  const key = bookCoverCacheKey(isbn, title, author);
  const direct = getBookCoverUrl(isbn, size);
  const [cover, setCover] = useState<{ key: string; uri: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const callback = useRef(onCoverResolved);
  callback.current = onCoverResolved;
  const generation = useRef(0);
  const searching = useRef(false);
  const triedFallback = useRef(false);
  const loaded = useRef(false);
  const currentKey = useRef(key);
  currentKey.current = key;

  useEffect(() => {
    let wasOffline = false;
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (online && wasOffline && !loaded.current) setRetry(value => value + 1);
      if (state.isConnected === false || state.isInternetReachable === false) wasOffline = true;
      else if (online) wasOffline = false;
    });
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && !loaded.current) setRetry(value => value + 1);
    });
    return () => { unsubscribe(); subscription.remove(); };
  }, []);

  useEffect(() => {
    const request = ++generation.current;
    let active = true;
    searching.current = false;
    triedFallback.current = false;
    loaded.current = false;
    const current = () => active && generation.current === request && currentKey.current === key;
    void (async () => {
      const local = await getCachedBookCover(key).catch(() => null);
      if (!current()) return;
      if (local) { setCover({ key, uri: local }); return; }
      if (direct) { setCover({ key, uri: direct }); return; }
      triedFallback.current = true;
      searching.current = true;
      const fallback = await findFallbackCoverUrl(isbn, title, author, size);
      if (!current()) return;
      searching.current = false;
      setCover(fallback ? { key, uri: fallback } : null);
      if (!fallback) callback.current?.(null);
    })();
    return () => { active = false; generation.current++; };
  }, [key, direct, isbn, title, author, size, retry]);

  const uri = cover?.key === key ? cover.uri : null;
  const handleError = async () => {
    if (!uri || searching.current) return;
    const request = generation.current;
    loaded.current = false;
    if (/^(file:|data:)/.test(uri)) {
      await forgetBrokenBookCover(key, uri).catch(() => undefined);
      if (request !== generation.current || currentKey.current !== key) return;
      setCover(null);
      setRetry(value => value + 1);
      return;
    }
    if (triedFallback.current) { setCover(null); callback.current?.(null); return; }
    triedFallback.current = true;
    searching.current = true;
    const fallback = await findFallbackCoverUrl(isbn, title, author, size);
    if (request !== generation.current || currentKey.current !== key) return;
    searching.current = false;
    setCover(fallback ? { key, uri: fallback } : null);
    if (!fallback) callback.current?.(null);
  };
  const handleLoad = () => {
    if (!uri || currentKey.current !== key) return;
    loaded.current = true;
    callback.current?.(uri);
    if (!/^https:\/\//i.test(uri)) return;
    const request = generation.current;
    void persistBookCover(key, uri).then(local => {
      if (request === generation.current && currentKey.current === key) setCover({ key, uri: local });
    }).catch(() => {
      // Keep the visible remote cover. Retry persistence when connectivity returns.
      if (request === generation.current && currentKey.current === key) loaded.current = false;
    });
  };
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.missingCoverTitle}>{title}</Text>
      {uri ? (
        <Image key={uri} accessibilityLabel={`Naslovnica knjige ${title}`}
          onError={() => void handleError()} onLoad={handleLoad} resizeMode="cover"
          source={{ uri }} style={StyleSheet.absoluteFill} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.black,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3A3A3C',
  },
  missingCoverTitle: {
    color: colors.onAccent,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 8,
  }, // gridTitlesMediaSwitchV31
  initial: {
    color: colors.white,
    fontSize: 25,
    fontWeight: '700',
  },
});