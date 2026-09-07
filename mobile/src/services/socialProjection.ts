import { bookApi } from './bookApi';
import { collectionApi } from './collectionApi';
import { mediaApi } from './mediaApi';
import { gameApi } from '../games/services/gameApi';
import { entryApi } from './entryApi';
import { entryTypeLabels, type Entry } from '../types/entry';
// ljinglePortalCleanMineSharedEntriesR1
import { getDatabase } from '../storage/database';
import type { BookResponse } from '../types/book';
import type { MediaResponse } from '../types/media';
import type { GameResponse } from '../games/types/game';
import { getMemoryCapsules } from './memoryCapsules';
// ljinglePortalDirectSendTrueCapsuleR2:projection
import type {
  PortalShareCandidate,
  SocialCollectionSnapshot,
  SocialEntityKind,
  SocialEntitySnapshot,
  SocialEntrySnapshot,
} from '../types/social';

let schemaReady: Promise<void> | null = null;

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = getDatabase().then(async (database) => {
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS portal_visibility (
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          visibility TEXT NOT NULL DEFAULT 'PRIVATE',
          modified_at TEXT NOT NULL,
          PRIMARY KEY (entity_type, entity_id)
        );
        CREATE INDEX IF NOT EXISTS idx_portal_visibility_visible
          ON portal_visibility(visibility, entity_type);
      `);
    });
  }
  await schemaReady;
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function normalized(value: unknown) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

function bookCover(book: BookResponse) {
  const isbn = clean(book.isbn).replace(/[^0-9Xx]/g, '').toUpperCase();
  return isbn
    ? 'https://covers.openlibrary.org/b/isbn/' + encodeURIComponent(isbn) + '-L.jpg'
    : null;
}

export function snapshotBook(book: BookResponse): SocialEntitySnapshot {
  return {
    entityId: book.bookId,
    kind: 'BOOK',
    title: clean(book.title) || 'Knjiga',
    subtitle: clean(book.author) || null,
    coverUrl: bookCover(book),
    year: book.publishedYear > 0 ? book.publishedYear : null,
    state: book.readingStatus,
    source: { isbn: clean(book.isbn) || null },
  };
}

export function snapshotMedia(item: MediaResponse): SocialEntitySnapshot {
  const poster = clean(item.posterPath);
  return {
    entityId: item.mediaId,
    kind: 'MEDIA',
    title: clean(item.title) || 'Film / serija',
    subtitle: item.mediaType === 'SERIES' ? 'Serija' : 'Film',
    coverUrl: poster
      ? /^https?:\/\//i.test(poster)
        ? poster
        : 'https://image.tmdb.org/t/p/w500' + poster
      : null,
    year: item.releaseYear,
    state: item.watchStatus,
    source: { tmdbId: item.tmdbId, mediaType: item.mediaType },
  };
}

export function snapshotGame(game: GameResponse): SocialEntitySnapshot {
  return {
    entityId: game.gameId,
    kind: 'GAME',
    title: clean(game.title) || 'Igra',
    subtitle: clean(game.developer) || clean(game.platform) || null,
    coverUrl: clean(game.coverUrl) || null,
    year: game.releaseYear,
    state: game.gameStatus,
    source: {
      igdbId: game.igdbId,
      platform: clean(game.platform) || null,
    },
  };
}

export function snapshotEntry(entry: Entry): SocialEntrySnapshot {
  return {
    entryId: entry.entryId,
    type: entry.type,
    title: clean(entry.title) || null,
    content: String(entry.content ?? '').trim(),
    createdAt: entry.createdAt,
  };
}

export function snapshotForEntity(
  value: BookResponse | MediaResponse | GameResponse,
): SocialEntitySnapshot {
  if ('bookId' in value) return snapshotBook(value);
  if ('mediaId' in value) return snapshotMedia(value);
  return snapshotGame(value);
}

export async function getPortalVisibility(kind: SocialEntityKind | 'COLLECTION' | 'ENTRY', id: string) {
  await ensureSchema();
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ visibility: string }>(
    'SELECT visibility FROM portal_visibility WHERE entity_type=? AND entity_id=?',
    kind,
    id,
  );
  return row?.visibility === 'PORTAL';
}

export async function setPortalVisibility(
  kind: SocialEntityKind | 'COLLECTION' | 'ENTRY',
  id: string,
  visible: boolean,
) {
  await ensureSchema();
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO portal_visibility(entity_type, entity_id, visibility, modified_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(entity_type, entity_id) DO UPDATE SET
       visibility=excluded.visibility,
       modified_at=excluded.modified_at`,
    kind,
    id,
    visible ? 'PORTAL' : 'PRIVATE',
    new Date().toISOString(),
  );
}

async function visibilitySet() {
  await ensureSchema();
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ entity_type: string; entity_id: string }>(
    `SELECT entity_type, entity_id
       FROM portal_visibility
      WHERE visibility='PORTAL'`,
  );
  return new Set(rows.map((row) => row.entity_type + ':' + row.entity_id));
}

async function listPortalShareCandidatesWithoutCapsules(): Promise<PortalShareCandidate[]> {
  const [books, media, games, collections, entries, visible] = await Promise.all([
    bookApi.getAll(),
    mediaApi.getAll(),
    gameApi.getAll(),
    collectionApi.getAll(),
    entryApi.getAll(),
    visibilitySet(),
  ]);

  return [
    ...collections.map((collection) => ({
      kind: 'COLLECTION' as const,
      id: collection.collectionId,
      title: collection.name,
      subtitle: collection.itemCount + ' stvari',
      visible: visible.has('COLLECTION:' + collection.collectionId),
    })),
    ...entries.map((entry) => ({
      kind: 'ENTRY' as const,
      id: entry.entryId,
      title: clean(entry.title) || entryTypeLabels[entry.type],
      subtitle: clean(entry.content).slice(0, 140) || null,
      visible: visible.has('ENTRY:' + entry.entryId),
    })),
    ...books.map((book) => ({
      kind: 'BOOK' as const,
      id: book.bookId,
      title: book.title,
      subtitle: book.author || null,
      visible: visible.has('BOOK:' + book.bookId),
    })),
    ...media.map((item) => ({
      kind: 'MEDIA' as const,
      id: item.mediaId,
      title: item.title,
      subtitle: item.mediaType === 'SERIES' ? 'Serija' : 'Film',
      visible: visible.has('MEDIA:' + item.mediaId),
    })),
    ...games.map((game) => ({
      kind: 'GAME' as const,
      id: game.gameId,
      title: game.title,
      subtitle: game.developer || game.platform || null,
      visible: visible.has('GAME:' + game.gameId),
    })),
  ];
}

export async function listPortalShareCandidates(): Promise<PortalShareCandidate[]> {
  const [base, capsules] = await Promise.all([
    listPortalShareCandidatesWithoutCapsules(),
    getMemoryCapsules(),
  ]);
  const backingIds = new Set(
    capsules.map((capsule) => capsule.backingCollectionId),
  );
  return [
    ...capsules.map((capsule) => ({
      kind: 'CAPSULE' as const,
      id: capsule.capsuleId,
      title: capsule.title,
      subtitle: capsule.sealedAt
        ? capsule.openOn
          ? 'Zapečaćeno · otvara se ' + capsule.openOn
          : 'Zapečaćeno'
        : 'Pakiranje · prvo zapečati',
      visible: false,
    })),
    ...base.filter(
      (candidate) =>
        candidate.kind !== 'COLLECTION' ||
        !backingIds.has(candidate.id),
    ),
  ];
}


export async function buildSocialProjection() {
  const [books, media, games, collections, entries, visible] = await Promise.all([
    bookApi.getAll(),
    mediaApi.getAll(),
    gameApi.getAll(),
    collectionApi.getAll(),
    entryApi.getAll(),
    visibilitySet(),
  ]);

  const bookMap = new Map(books.map((book) => [book.bookId, snapshotBook(book)]));
  const mediaMap = new Map(media.map((item) => [item.mediaId, snapshotMedia(item)]));
  const gameMap = new Map(games.map((game) => [game.gameId, snapshotGame(game)]));
  const snapshotByKey = new Map<string, SocialEntitySnapshot>([
    ...Array.from(bookMap.entries()).map(([id, item]) => ['BOOK:' + id, item] as const),
    ...Array.from(mediaMap.entries()).map(([id, item]) => ['MEDIA:' + id, item] as const),
    ...Array.from(gameMap.entries()).map(([id, item]) => ['GAME:' + id, item] as const),
  ]);

  const entities = Array.from(snapshotByKey.entries())
    .filter(([key]) => visible.has(key))
    .map(([, item]) => item);

  const projectedEntries = entries
    .filter((entry) => visible.has('ENTRY:' + entry.entryId))
    .map(snapshotEntry);

  const capsuleBackingIds = new Set(
    (await getMemoryCapsules()).map(
      (capsule) => capsule.backingCollectionId,
    ),
  );

  const publicCollections = collections.filter((item) =>
    !capsuleBackingIds.has(item.collectionId) &&
    visible.has('COLLECTION:' + item.collectionId),
  );
  const details = await Promise.all(
    publicCollections.map((item) => collectionApi.getById(item.collectionId)),
  );
  const projectedCollections: SocialCollectionSnapshot[] = details.map((collection) => ({
    collectionId: collection.collectionId,
    name: collection.name,
    description: collection.description,
    symbol: collection.symbol,
    items: collection.items
      .map((item) => snapshotByKey.get(item.entityType + ':' + item.entityId) ?? null)
      .filter((item): item is SocialEntitySnapshot => Boolean(item)),
  }));

  return { entities, collections: projectedCollections, entries: projectedEntries };
}

export async function snapshotCollectionById(collectionId: string): Promise<SocialCollectionSnapshot> {
  const [collection, books, media, games] = await Promise.all([
    collectionApi.getById(collectionId),
    bookApi.getAll(),
    mediaApi.getAll(),
    gameApi.getAll(),
  ]);
  const snapshots = new Map<string, SocialEntitySnapshot>([
    ...books.map((item) => ['BOOK:' + item.bookId, snapshotBook(item)] as const),
    ...media.map((item) => ['MEDIA:' + item.mediaId, snapshotMedia(item)] as const),
    ...games.map((item) => ['GAME:' + item.gameId, snapshotGame(item)] as const),
  ]);
  return {
    collectionId: collection.collectionId,
    name: collection.name,
    description: collection.description,
    symbol: collection.symbol,
    items: collection.items
      .map((item) => snapshots.get(item.entityType + ':' + item.entityId) ?? null)
      .filter((item): item is SocialEntitySnapshot => Boolean(item)),
  };
}

async function findOrCreateEntity(snapshot: SocialEntitySnapshot) {
  if (snapshot.kind === 'BOOK') {
    const books = await bookApi.getAll();
    const isbn = clean(snapshot.source.isbn).replace(/[^0-9Xx]/g, '').toUpperCase();
    const existing = books.find((item) =>
      (isbn && clean(item.isbn).replace(/[^0-9Xx]/g, '').toUpperCase() === isbn) ||
      (normalized(item.title) === normalized(snapshot.title) && normalized(item.author) === normalized(snapshot.subtitle)),
    );
    if (existing) return { kind: 'BOOK' as const, id: existing.bookId, created: false };
    const created = await bookApi.create({
      title: snapshot.title,
      author: snapshot.subtitle || '',
      isbn,
      publishedYear: snapshot.year ?? 0,
      readingStatus: 'LATER',
      progress: 0,
      totalPages: null,
      currentPage: null,
      enjoyment: null,
      favourite: false,
      startedOn: null,
      finishedOn: null,
    });
    return { kind: 'BOOK' as const, id: created.bookId, created: true };
  }

  if (snapshot.kind === 'MEDIA') {
    const all = await mediaApi.getAll();
    const existing = all.find((item) =>
      (snapshot.source.tmdbId && item.tmdbId === snapshot.source.tmdbId) ||
      (normalized(item.title) === normalized(snapshot.title) && item.mediaType === (snapshot.source.mediaType || 'MOVIE')),
    );
    if (existing) return { kind: 'MEDIA' as const, id: existing.mediaId, created: false };
    const created = await mediaApi.create({
      mediaType: snapshot.source.mediaType || 'MOVIE',
      tmdbId: snapshot.source.tmdbId ?? null,
      title: snapshot.title,
      originalTitle: null,
      overview: null,
      posterPath: snapshot.coverUrl,
      backdropPath: null,
      releaseYear: snapshot.year,
      watchStatus: 'LATER',
      progress: 0,
      enjoyment: null,
      favourite: false,
      startedOn: null,
      completedOn: null,
    });
    return { kind: 'MEDIA' as const, id: created.mediaId, created: true };
  }

  const games = await gameApi.getAll();
  const existing = games.find((item) =>
    (snapshot.source.igdbId && item.igdbId === snapshot.source.igdbId) ||
    normalized(item.title) === normalized(snapshot.title),
  );
  if (existing) return { kind: 'GAME' as const, id: existing.gameId, created: false };
  const created = await gameApi.create({
    title: snapshot.title,
    developer: snapshot.subtitle,
    platform: snapshot.source.platform || '',
    releaseYear: snapshot.year,
    gameStatus: 'BACKLOG',
    progress: 0,
    enjoyment: null,
    favourite: false,
    startedOn: null,
    finishedOn: null,
    igdbId: snapshot.source.igdbId ?? null,
    coverUrl: snapshot.coverUrl,
  });
  return { kind: 'GAME' as const, id: created.gameId, created: true };
}

export async function importSocialEntity(snapshot: SocialEntitySnapshot) {
  return findOrCreateEntity(snapshot);
}

export async function importSocialCollection(snapshot: SocialCollectionSnapshot) {
  const collections = await collectionApi.getAll();
  let collection = collections.find((item) => normalized(item.name) === normalized(snapshot.name));
  if (!collection) {
    collection = await collectionApi.create({
      name: snapshot.name,
      description: snapshot.description,
      symbol: snapshot.symbol,
    });
  }

  const detail = await collectionApi.getById(collection.collectionId);
  const present = new Set(detail.items.map((item) => item.entityType + ':' + item.entityId));
  let imported = 0;
  for (const item of snapshot.items) {
    const local = await findOrCreateEntity(item);
    const key = local.kind + ':' + local.id;
    if (!present.has(key)) {
      await collectionApi.addItem(collection.collectionId, local.kind, local.id);
      present.add(key);
    }
    imported += 1;
  }
  return { collectionId: collection.collectionId, imported };
}
