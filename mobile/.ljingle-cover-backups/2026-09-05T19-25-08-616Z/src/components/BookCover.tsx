import { useEffect, useState } from 'react';
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

export function BookCover({
  isbn,
  title,
  author,
  size = 'M',
  style,
  onCoverResolved,
}: Props) {
  const directCoverUrl = getBookCoverUrl(isbn, size);

  const [coverUrl, setCoverUrl] = useState<string | null>(
    directCoverUrl,
  );
  const [failed, setFailed] = useState(false);
  const [searching, setSearching] = useState(false);

  const initial =
    title.trim().charAt(0).toUpperCase() || 'B';

  useEffect(() => {
    setFailed(false);
    setSearching(false);
    setCoverUrl(directCoverUrl);
    onCoverResolved?.(null);
  }, [
    author,
    directCoverUrl,
    onCoverResolved,
    title,
  ]);

  const handleError = async () => {
    if (searching) return;

    // A fallback image was found but could not be displayed.
    if (coverUrl !== directCoverUrl) {
      setFailed(true);
      onCoverResolved?.(null);
      return;
    }

    setSearching(true);

    const fallbackUrl = await findFallbackCoverUrl(
      isbn,
      title,
      author,
      size,
    );

    setSearching(false);

    if (fallbackUrl) {
      setCoverUrl(fallbackUrl);
    } else {
      setFailed(true);
      onCoverResolved?.(null);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.missingCoverTitle}>{title}</Text>

      {coverUrl && !failed ? (
        <Image
          accessibilityLabel={`Naslovnica knjige ${title}`}
          onError={() => void handleError()}
          onLoad={() => onCoverResolved?.(coverUrl)}
          resizeMode="cover"
          source={{ uri: coverUrl }}
          style={StyleSheet.absoluteFill}
        />
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
    color: colors.white,
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