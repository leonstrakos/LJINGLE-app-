import { gameApi } from '../games/services/gameApi';
import type { GameResponse } from '../games/types/game';
import { getDatabase } from '../storage/database';
import { bookApi } from './bookApi';
import { mediaApi } from './mediaApi';
import type { BookResponse } from '../types/book';
import type { MediaResponse } from '../types/media';

export type CatalogueSnapshotEntityType =
  | 'BOOK'
  | 'MOVIE'
  | 'SERIES'
  | 'GAME';

export type CatalogueSnapshotItem = {
  snapshotId: string;
  entityType: CatalogueSnapshotEntityType;
  entityId: string;
  title: string;
  subtitle: string | null;
  status: string;
  progress: number;
  jingle: boolean;
  nebitno: boolean;
};

export type CatalogueSnapshot = {
  snapshotId: string;
  label: string;
  createdAt: string;

  totalItems: number;
  bookCount: number;
  movieCount: number;
  seriesCount: number;
  gameCount: number;

  jingleCount: number;
  nebitnoCount: number;
  activeCount: number;
};

export type CatalogueSnapshotDetails = {
  snapshot: CatalogueSnapshot;
  items: CatalogueSnapshotItem[];
};

type SnapshotRow = {
  snapshot_id: string;
  label: string;
  created_at: string;
  total_items: number;
  book_count: number;
  movie_count: number;
  series_count: number;
  game_count: number;
  jingle_count: number;
  nebitno_count: number;
  active_count: number;
};

type SnapshotItemRow = {
  snapshot_id: string;
  entity_type: CatalogueSnapshotEntityType;
  entity_id: string;
  title: string;
  subtitle: string | null;
  status: string;
  progress: number;
  jingle: number;
  nebitno: number;
};

function identifier() {
  return (
    'snapshot-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}

async function databaseWithSnapshots() {
  const database = await getDatabase();

  await database.execAsync(
    `CREATE TABLE IF NOT EXISTS catalogue_snapshots (
      snapshot_id TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL,
      total_items INTEGER NOT NULL,
      book_count INTEGER NOT NULL,
      movie_count INTEGER NOT NULL,
      series_count INTEGER NOT NULL,
      game_count INTEGER NOT NULL,
      jingle_count INTEGER NOT NULL,
      nebitno_count INTEGER NOT NULL,
      active_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalogue_snapshot_items (
      snapshot_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      jingle INTEGER NOT NULL DEFAULT 0,
      nebitno INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (snapshot_id, entity_type, entity_id),
      FOREIGN KEY (snapshot_id)
        REFERENCES catalogue_snapshots(snapshot_id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_catalogue_snapshots_created
      ON catalogue_snapshots(created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_catalogue_snapshot_items_snapshot
      ON catalogue_snapshot_items(snapshot_id, entity_type, title COLLATE NOCASE);`
  );

  return database;
}

function mapSnapshot(row: SnapshotRow): CatalogueSnapshot {
  return {
    snapshotId: String(row.snapshot_id),
    label: String(row.label),
    createdAt: String(row.created_at),

    totalItems: Number(row.total_items),
    bookCount: Number(row.book_count),
    movieCount: Number(row.movie_count),
    seriesCount: Number(row.series_count),
    gameCount: Number(row.game_count),

    jingleCount: Number(row.jingle_count),
    nebitnoCount: Number(row.nebitno_count),
    activeCount: Number(row.active_count),
  };
}

function mapItem(row: SnapshotItemRow): CatalogueSnapshotItem {
  return {
    snapshotId: String(row.snapshot_id),
    entityType: row.entity_type,
    entityId: String(row.entity_id),
    title: String(row.title),
    subtitle: row.subtitle ?? null,
    status: String(row.status),
    progress: Number(row.progress),
    jingle: Boolean(row.jingle),
    nebitno: Boolean(row.nebitno),
  };
}

function seasonalLabel(date: Date) {
  const month = date.getMonth();

  const season =
    month === 11 || month <= 1
      ? 'Zima'
      : month <= 4
        ? 'Proljeće'
        : month <= 7
          ? 'Ljeto'
          : 'Jesen';

  return season + ' ' + date.getFullYear();
}

function isBookActive(book: BookResponse) {
  return book.readingStatus === 'IN_PROGRESS';
}

function isMediaActive(item: MediaResponse) {
  return item.watchStatus === 'WATCHING';
}

function isGameActive(game: GameResponse) {
  return (
    game.gameStatus === 'PLAYING' ||
    game.gameStatus === 'INSTALLED'
  );
}

export async function listCatalogueSnapshots() {
  const database = await databaseWithSnapshots();

  const rows = await database.getAllAsync<SnapshotRow>(
    'SELECT * FROM catalogue_snapshots ORDER BY created_at DESC',
  );

  return rows.map(mapSnapshot);
}

export async function loadCatalogueSnapshot(
  snapshotId: string,
): Promise<CatalogueSnapshotDetails> {
  const database = await databaseWithSnapshots();

  const snapshotRow =
    await database.getFirstAsync<SnapshotRow>(
      'SELECT * FROM catalogue_snapshots WHERE snapshot_id = ?',
      snapshotId,
    );

  if (!snapshotRow) {
    throw new Error('Snapshot vi?e ne postoji.');
  }

  const rows =
    await database.getAllAsync<SnapshotItemRow>(
      `SELECT *
       FROM catalogue_snapshot_items
       WHERE snapshot_id = ?
       ORDER BY
         CASE entity_type
           WHEN 'BOOK' THEN 1
           WHEN 'MOVIE' THEN 2
           WHEN 'SERIES' THEN 3
           WHEN 'GAME' THEN 4
           ELSE 5
         END,
         title COLLATE NOCASE ASC`,
      snapshotId,
    );

  return {
    snapshot: mapSnapshot(snapshotRow),
    items: rows.map(mapItem),
  };
}

export async function createCatalogueSnapshot() {
  const [
    books,
    visibleMedia,
    nebitnoMedia,
    games,
  ] = await Promise.all([
    bookApi.getAll(),
    mediaApi.getAll({}),
    mediaApi.getAll({ ignored: 'NEBITNO' }),
    gameApi.getAll(),
  ]);

  const nebitnoIds = new Set(
    nebitnoMedia.map((item) => item.mediaId),
  );

  const mediaMap = new Map<string, MediaResponse>();

  for (const item of visibleMedia) {
    mediaMap.set(item.mediaId, item);
  }

  for (const item of nebitnoMedia) {
    mediaMap.set(item.mediaId, item);
  }

  const allMedia = Array.from(mediaMap.values());

  const snapshotId = identifier();
  const now = new Date();
  const createdAt = now.toISOString();
  const label = seasonalLabel(now);

  const items: CatalogueSnapshotItem[] = [
    ...books.map((book) => ({
      snapshotId,
      entityType: 'BOOK' as const,
      entityId: book.bookId,
      title: book.title,
      subtitle: book.author || null,
      status: book.readingStatus,
      progress: Number(book.progress ?? 0),
      jingle: Boolean(book.favourite),
      nebitno: false,
    })),

    ...allMedia.map((item) => ({
      snapshotId,
      entityType: item.mediaType,
      entityId: item.mediaId,
      title: item.title,
      subtitle:
        item.releaseYear === null
          ? null
          : String(item.releaseYear),
      status: item.watchStatus,
      progress: Number(item.progress ?? 0),
      jingle: Boolean(item.favourite),
      nebitno: nebitnoIds.has(item.mediaId),
    })),

    ...games.map((game) => ({
      snapshotId,
      entityType: 'GAME' as const,
      entityId: game.gameId,
      title: game.title,
      subtitle: game.platform || null,
      status: game.gameStatus,
      progress: Number(game.progress ?? 0),
      jingle: Boolean(game.favourite),
      nebitno: false,
    })),
  ];

  const movieCount = allMedia.filter(
    (item) => item.mediaType === 'MOVIE',
  ).length;

  const seriesCount = allMedia.filter(
    (item) => item.mediaType === 'SERIES',
  ).length;

  const jingleCount = items.filter(
    (item) => item.jingle,
  ).length;

  const nebitnoCount = items.filter(
    (item) => item.nebitno,
  ).length;

  const activeCount =
    books.filter(isBookActive).length +
    allMedia.filter(isMediaActive).length +
    games.filter(isGameActive).length;

  const database = await databaseWithSnapshots();

  await database.execAsync('BEGIN TRANSACTION;');

  try {
    await database.runAsync(
      `INSERT INTO catalogue_snapshots (
        snapshot_id,
        label,
        created_at,
        total_items,
        book_count,
        movie_count,
        series_count,
        game_count,
        jingle_count,
        nebitno_count,
        active_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      snapshotId,
      label,
      createdAt,
      items.length,
      books.length,
      movieCount,
      seriesCount,
      games.length,
      jingleCount,
      nebitnoCount,
      activeCount,
    );

    for (const item of items) {
      await database.runAsync(
        `INSERT INTO catalogue_snapshot_items (
          snapshot_id,
          entity_type,
          entity_id,
          title,
          subtitle,
          status,
          progress,
          jingle,
          nebitno
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.snapshotId,
        item.entityType,
        item.entityId,
        item.title,
        item.subtitle,
        item.status,
        item.progress,
        item.jingle ? 1 : 0,
        item.nebitno ? 1 : 0,
      );
    }

    await database.execAsync('COMMIT;');
  } catch (error) {
    await database.execAsync('ROLLBACK;').catch(
      () => undefined,
    );

    throw error;
  }

  return {
    snapshotId,
    label,
    createdAt,

    totalItems: items.length,
    bookCount: books.length,
    movieCount,
    seriesCount,
    gameCount: games.length,

    jingleCount,
    nebitnoCount,
    activeCount,
  } satisfies CatalogueSnapshot;
}

export async function deleteCatalogueSnapshot(
  snapshotId: string,
) {
  const database = await databaseWithSnapshots();

  await database.runAsync(
    'DELETE FROM catalogue_snapshot_items WHERE snapshot_id = ?',
    snapshotId,
  );

  await database.runAsync(
    'DELETE FROM catalogue_snapshots WHERE snapshot_id = ?',
    snapshotId,
  );
}
