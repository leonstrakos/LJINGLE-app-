// forkHPaletteOnlineApiV1
import { gameApi } from '../games/services/gameApi';
import type { GameMetadataResult } from '../games/types/game';
import { bookApi } from './bookApi';
import { bookMetadataApi } from './bookMetadataApi';
import { mediaApi } from './mediaApi';
import type { BookMetadataCandidate } from '../types/bookMetadata';
import type { MediaType, TmdbMediaResponse } from '../types/media';

export type PaletteOnlineKind =
  | 'MOVIE'
  | 'TV'
  | 'BOOK'
  | 'GAME';

export type PaletteOnlineResult =
  | {
      key: string;
      kind: 'MOVIE' | 'TV';
      title: string;
      meta: string;
      sourceLabel: 'TMDB';
      media: TmdbMediaResponse;
    }
  | {
      key: string;
      kind: 'BOOK';
      title: string;
      meta: string;
      sourceLabel: 'GOOGLE BOOKS';
      book: BookMetadataCandidate;
    }
  | {
      key: string;
      kind: 'GAME';
      title: string;
      meta: string;
      sourceLabel: 'IGDB';
      game: GameMetadataResult;
    };

export type PaletteCreatedTarget =
  | { kind: 'BOOK'; id: string }
  | { kind: 'MEDIA'; id: string }
  | { kind: 'GAME'; id: string };

function compact(values: Array<string | number | null | undefined>) {
  return values
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
    .join(' · ');
}

function bookKey(candidate: BookMetadataCandidate, index: number) {
  const source = candidate.sources[0];
  return source
    ? `BOOK:${source.provider}:${source.externalId}`
    : `BOOK:${candidate.title ?? 'untitled'}:${index}`;
}

function mediaTypeFor(kind: 'MOVIE' | 'TV'): MediaType {
  return kind === 'MOVIE' ? 'MOVIE' : 'SERIES';
}

async function createMedia(result: Extract<PaletteOnlineResult, { kind: 'MOVIE' | 'TV' }>) {
  const existing = (await mediaApi.getAll({ mediaType: result.media.mediaType })).find(
    (item) => item.tmdbId === result.media.tmdbId,
  );

  if (existing) {
    return { kind: 'MEDIA' as const, id: existing.mediaId };
  }

  const created = await mediaApi.create({
    mediaType: result.media.mediaType,
    tmdbId: result.media.tmdbId,
    title: result.media.title,
    originalTitle: result.media.originalTitle,
    overview: result.media.overview,
    posterPath: result.media.posterPath ?? result.media.posterUrl,
    backdropPath: result.media.backdropPath ?? result.media.backdropUrl,
    releaseYear: result.media.releaseYear,
    watchStatus: 'WATCHLIST',
    progress: 0,
    enjoyment: null,
    favourite: false,
    startedOn: null,
    completedOn: null,
  });

  return { kind: 'MEDIA' as const, id: created.mediaId };
}

async function createBook(result: Extract<PaletteOnlineResult, { kind: 'BOOK' }>) {
  const source =
    result.book.sources.find((item) => item.provider === 'GOOGLE_BOOKS') ??
    result.book.sources[0] ??
    null;

  if (source) {
    const preview = await bookMetadataApi.previewImport({ source });

    if (preview.existingBook) {
      return { kind: 'BOOK' as const, id: preview.existingBook.bookId };
    }

    const duplicate = preview.duplicates[0];
    if (duplicate) {
      return { kind: 'BOOK' as const, id: duplicate.bookId };
    }

    if (preview.importable && preview.action === 'CREATE') {
      const imported = await bookMetadataApi.confirmImport({
        source,
        confirmMetadataUpdate: false,
      });
      return { kind: 'BOOK' as const, id: imported.book.bookId };
    }
  }

  const created = await bookApi.create({
    title: result.book.title?.trim() || result.title,
    author: result.book.authors.join(', ').trim(),
    isbn: result.book.isbn13 || result.book.isbn10 || '',
    publishedYear: result.book.publishedYear ?? 0,
    readingStatus: 'LATER',
    progress: 0,
    enjoyment: null,
    favourite: false,
    startedOn: null,
    finishedOn: null,
  });

  return { kind: 'BOOK' as const, id: created.bookId };
}

async function createGame(result: Extract<PaletteOnlineResult, { kind: 'GAME' }>) {
  const existing = (await gameApi.getAll()).find(
    (item) => item.igdbId === result.game.igdbId,
  );

  if (existing) {
    return { kind: 'GAME' as const, id: existing.gameId };
  }

  const created = await gameApi.create({
    title: result.game.title,
    developer: result.game.developer,
    platform: result.game.platforms[0] || 'Nije navedeno',
    releaseYear: result.game.releaseYear,
    gameStatus: 'BACKLOG',
    progress: 0,
    enjoyment: null,
    favourite: false,
    startedOn: null,
    finishedOn: null,
    igdbId: result.game.igdbId,
    coverUrl: result.game.coverUrl,
  });

  return { kind: 'GAME' as const, id: created.gameId };
}

export const paletteOnlineApi = {
  async search(
    kind: PaletteOnlineKind,
    query: string,
    limit = 8,
  ): Promise<PaletteOnlineResult[]> {
    const clean = query.trim();
    if (!clean) return [];

    if (kind === 'MOVIE' || kind === 'TV') {
      const response = await mediaApi.searchTmdb(
        clean,
        mediaTypeFor(kind),
        1,
      );

      return response.results.slice(0, limit).map((media) => ({
        key: `${kind}:${media.tmdbId}`,
        kind,
        title: media.title,
        meta:
          compact([
            media.releaseYear,
            media.originalTitle && media.originalTitle !== media.title
              ? media.originalTitle
              : null,
          ]) || (kind === 'MOVIE' ? 'Film' : 'TV serija'),
        sourceLabel: 'TMDB' as const,
        media,
      }));
    }

    if (kind === 'BOOK') {
      const response = await bookMetadataApi.search(
        clean,
        'GOOGLE_BOOKS',
        limit,
      );

      return response.results.slice(0, limit).map((book, index) => ({
        key: bookKey(book, index),
        kind: 'BOOK' as const,
        title: book.title?.trim() || clean,
        meta:
          compact([
            book.authors.join(', '),
            book.publishedYear,
          ]) || 'Knjiga',
        sourceLabel: 'GOOGLE BOOKS' as const,
        book,
      }));
    }

    const games = await gameApi.searchMetadata(clean);
    return games.slice(0, limit).map((game) => ({
      key: `GAME:${game.igdbId}`,
      kind: 'GAME' as const,
      title: game.title,
      meta:
        compact([
          game.developer,
          game.releaseYear,
          game.platforms[0],
        ]) || 'Igra',
      sourceLabel: 'IGDB' as const,
      game,
    }));
  },

  async create(result: PaletteOnlineResult): Promise<PaletteCreatedTarget> {
    if (result.kind === 'MOVIE' || result.kind === 'TV') {
      return createMedia(result);
    }

    if (result.kind === 'BOOK') {
      return createBook(result);
    }

    if (result.kind === 'GAME') {
      return createGame(result);
    }

    throw new Error('Nepodržan online rezultat.');
  },

  async createManual(
    kind: PaletteOnlineKind,
    title: string,
  ): Promise<PaletteCreatedTarget> {
    const clean = title.trim();
    if (!clean) {
      throw new Error('Naslov ne smije biti prazan.');
    }

    if (kind === 'BOOK') {
      const created = await bookApi.create({
        title: clean,
        author: '',
        isbn: '',
        publishedYear: 0,
        readingStatus: 'LATER',
        progress: 0,
        enjoyment: null,
        favourite: false,
        startedOn: null,
        finishedOn: null,
      });
      return { kind: 'BOOK', id: created.bookId };
    }

    if (kind === 'GAME') {
      const created = await gameApi.create({
        title: clean,
        developer: null,
        platform: 'Nije navedeno',
        releaseYear: null,
        gameStatus: 'BACKLOG',
        progress: 0,
        enjoyment: null,
        favourite: false,
        startedOn: null,
        finishedOn: null,
        igdbId: null,
        coverUrl: null,
      });
      return { kind: 'GAME', id: created.gameId };
    }

    const created = await mediaApi.create({
      mediaType: mediaTypeFor(kind),
      tmdbId: null,
      title: clean,
      originalTitle: null,
      overview: null,
      posterPath: null,
      backdropPath: null,
      releaseYear: null,
      watchStatus: 'WATCHLIST',
      progress: 0,
      enjoyment: null,
      favourite: false,
      startedOn: null,
      completedOn: null,
    });

    return { kind: 'MEDIA', id: created.mediaId };
  },
};
