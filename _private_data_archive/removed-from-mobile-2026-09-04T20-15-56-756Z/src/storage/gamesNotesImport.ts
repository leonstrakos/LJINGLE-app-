import type * as SQLite from 'expo-sqlite';

const importData = require('../assets/imports/games-notes-import-v1.json') as GamesNotesImportBundle;

const IMPORT_KEY = 'ultimate-games-notes-v1';
const SOURCE = 'ULTIMATE_GAMES_NOTES';

type ImportEvent = {
  eventId: string;
  eventType: string;
  year: number | null;
  date: string | null;
  platform: string | null;
  durationMinutes: number | null;
  note: string | null;
  source: string;
  sourceIndex: number | null;
  raw: string | null;
  title: string | null;
  tags: string[];
  currentLayer: boolean;
};

type ImportGame = {
  canonicalKey: string;
  stableGameId: string;
  title: string;
  appStatus: 'BACKLOG' | 'PLAYING' | 'INSTALLED' | 'COMPLETED' | 'PLAYED_BEFORE' | 'DROPPED' | 'QUIT' | 'UNSORTED';
  sourceStatus: string;
  platform: string;
  progress: number;
  favourite: boolean;
  dnf: boolean;
  finishedOn: string | null;
  createdAt: string;
  entityKind: string;
  needsReview: boolean;
  resolutionNote: string | null;
  tags: string[];
  aliases: string[];
  matchKeys: string[];
  events: ImportEvent[];
};

type GamesNotesImportBundle = {
  format: string;
  source: string;
  generatedFrom: string;
  games: ImportGame[];
  summary: {
    games: number;
    statusCounts: Record<string, number>;
    dnf: number;
    favourites: number;
    events: number;
  };
};

type ExistingGameRow = {
  game_id: string;
  title: string;
  platform: string;
  game_status: string;
  progress: number;
  favourite: number;
  started_on: string | null;
  finished_on: string | null;
  dnf?: number;
};

type ImportSummary = {
  sourceGames: number;
  insertedGames: number;
  matchedExistingGames: number;
  ambiguousExistingMatches: number;
  sourceMappings: number;
  events: number;
  tags: number;
  aliases: number;
  dnfGames: number;
  favourites: number;
  statusCounts: Record<string, number>;
  ambiguousTitles: string[];
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeTitle(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

async function ensureGameImportSchema(database: SQLite.SQLiteDatabase) {
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(games)');
  if (!columns.some((column) => column.name === 'dnf')) {
    await database.execAsync('ALTER TABLE games ADD COLUMN dnf INTEGER NOT NULL DEFAULT 0;');
  }

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS games_notes_imports (
      import_key TEXT PRIMARY KEY NOT NULL,
      imported_at TEXT NOT NULL,
      summary_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS game_source_map (
      canonical_key TEXT PRIMARY KEY NOT NULL,
      game_id TEXT,
      stable_game_id TEXT NOT NULL,
      source TEXT NOT NULL,
      entity_kind TEXT NOT NULL,
      source_status TEXT NOT NULL,
      app_status TEXT NOT NULL,
      needs_review INTEGER NOT NULL DEFAULT 0,
      resolution_note TEXT,
      imported_at TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_game_source_map_game
      ON game_source_map(game_id);

    CREATE TABLE IF NOT EXISTS game_events (
      event_id TEXT PRIMARY KEY NOT NULL,
      game_id TEXT,
      canonical_key TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_year INTEGER,
      event_date TEXT,
      platform TEXT,
      duration_minutes INTEGER,
      note TEXT,
      source_document TEXT NOT NULL,
      source_index INTEGER,
      raw_text TEXT,
      source_title TEXT,
      tags_json TEXT NOT NULL,
      current_layer INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_game_events_game
      ON game_events(game_id, event_date DESC, event_year DESC);
    CREATE INDEX IF NOT EXISTS idx_game_events_canonical
      ON game_events(canonical_key);
    CREATE INDEX IF NOT EXISTS idx_game_events_type
      ON game_events(event_type);

    CREATE TABLE IF NOT EXISTS game_tags (
      game_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (game_id, tag),
      FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_game_tags_tag
      ON game_tags(tag, game_id);

    CREATE TABLE IF NOT EXISTS game_aliases (
      game_id TEXT NOT NULL,
      alias_key TEXT NOT NULL,
      alias TEXT NOT NULL,
      canonical_key TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (game_id, alias_key),
      FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_game_aliases_key
      ON game_aliases(alias_key);
  `);
}

function addToTitleIndex(index: Map<string, Set<string>>, title: string, gameId: string) {
  const key = normalizeTitle(title);
  if (!key) return;
  const ids = index.get(key) ?? new Set<string>();
  ids.add(gameId);
  index.set(key, ids);
}

function candidateIds(index: Map<string, Set<string>>, matchKeys: string[]) {
  const ids = new Set<string>();
  for (const key of matchKeys) {
    const normalized = normalizeTitle(key);
    for (const id of index.get(normalized) ?? []) ids.add(id);
  }
  return ids;
}

export async function importGamesNotesOnce(database: SQLite.SQLiteDatabase) {
  await ensureGameImportSchema(database);

  const already = await database.getFirstAsync<{ import_key: string }>(
    'SELECT import_key FROM games_notes_imports WHERE import_key = ?',
    IMPORT_KEY,
  );
  if (already) return;

  if (importData.format !== 'life-catalogue-games-notes-import-v1') {
    throw new Error(`Unexpected games import format: ${importData.format}`);
  }

  const existingRows = await database.getAllAsync<ExistingGameRow>('SELECT * FROM games');
  const titleIndex = new Map<string, Set<string>>();
  const existingById = new Map<string, ExistingGameRow>();
  for (const row of existingRows) {
    existingById.set(String(row.game_id), row);
    addToTitleIndex(titleIndex, String(row.title), String(row.game_id));
  }

  const summary: ImportSummary = {
    sourceGames: importData.games.length,
    insertedGames: 0,
    matchedExistingGames: 0,
    ambiguousExistingMatches: 0,
    sourceMappings: 0,
    events: 0,
    tags: 0,
    aliases: 0,
    dnfGames: 0,
    favourites: 0,
    statusCounts: {},
    ambiguousTitles: [],
  };

  await database.execAsync('BEGIN IMMEDIATE;');
  try {
    for (const item of importData.games) {
      summary.statusCounts[item.appStatus] = (summary.statusCounts[item.appStatus] ?? 0) + 1;
      if (item.dnf) summary.dnfGames++;
      if (item.favourite) summary.favourites++;

      let gameId: string | null = null;
      const candidates = candidateIds(titleIndex, item.matchKeys);

      if (candidates.size === 1) {
        gameId = [...candidates][0]!;
        summary.matchedExistingGames++;
      } else if (candidates.size > 1) {
        summary.ambiguousExistingMatches++;
        summary.ambiguousTitles.push(item.title);
      } else {
        gameId = item.stableGameId;
        const existingStable = existingById.get(gameId);
        if (existingStable) {
          summary.matchedExistingGames++;
        } else {
          const modifiedAt = nowIso();
          await database.runAsync(
            `INSERT INTO games
             (game_id, title, developer, platform, release_year, game_status, progress, enjoyment,
              favourite, started_on, finished_on, igdb_id, cover_url, playing_activity_id,
              created_at, modified_at, dnf)
             VALUES (?, ?, NULL, ?, NULL, ?, ?, NULL, ?, NULL, ?, NULL, NULL, NULL, ?, ?, ?)`,
            gameId,
            item.title,
            item.platform,
            item.appStatus,
            item.progress,
            item.favourite ? 1 : 0,
            item.finishedOn,
            item.createdAt,
            modifiedAt,
            item.dnf ? 1 : 0,
          );
          summary.insertedGames++;
          addToTitleIndex(titleIndex, item.title, gameId);
          existingById.set(gameId, {
            game_id: gameId,
            title: item.title,
            platform: item.platform,
            game_status: item.appStatus,
            progress: item.progress,
            favourite: item.favourite ? 1 : 0,
            started_on: null,
            finished_on: item.finishedOn,
            dnf: item.dnf ? 1 : 0,
          });
        }
      }

      if (gameId) {
        const modifiedAt = nowIso();
        // The notes are the requested source of truth for lifecycle status, while richer
        // manually/online-populated metadata (developer, year, cover, IGDB, enjoyment) survives.
        await database.runAsync(
          `UPDATE games
              SET game_status = ?,
                  platform = CASE
                    WHEN platform IS NULL OR TRIM(platform) = '' OR platform = 'Nije navedeno'
                    THEN ? ELSE platform END,
                  progress = CASE
                    WHEN ? = 'COMPLETED' AND progress = 0 THEN 100
                    ELSE progress END,
                  favourite = CASE WHEN favourite = 1 OR ? = 1 THEN 1 ELSE 0 END,
                  finished_on = COALESCE(finished_on, ?),
                  dnf = CASE WHEN dnf = 1 OR ? = 1 THEN 1 ELSE 0 END,
                  modified_at = ?
            WHERE game_id = ?`,
          item.appStatus,
          item.platform,
          item.appStatus,
          item.favourite ? 1 : 0,
          item.finishedOn,
          item.dnf ? 1 : 0,
          modifiedAt,
          gameId,
        );
      }

      const mappedAt = nowIso();
      await database.runAsync(
        `INSERT INTO game_source_map
         (canonical_key, game_id, stable_game_id, source, entity_kind, source_status, app_status,
          needs_review, resolution_note, imported_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(canonical_key) DO UPDATE SET
           game_id = excluded.game_id,
           stable_game_id = excluded.stable_game_id,
           entity_kind = excluded.entity_kind,
           source_status = excluded.source_status,
           app_status = excluded.app_status,
           needs_review = excluded.needs_review,
           resolution_note = excluded.resolution_note,
           modified_at = excluded.modified_at`,
        item.canonicalKey,
        gameId,
        item.stableGameId,
        SOURCE,
        item.entityKind,
        item.sourceStatus,
        item.appStatus,
        item.needsReview ? 1 : 0,
        item.resolutionNote,
        mappedAt,
        mappedAt,
      );
      summary.sourceMappings++;

      for (const event of item.events) {
        const timestamp = nowIso();
        await database.runAsync(
          `INSERT OR IGNORE INTO game_events
           (event_id, game_id, canonical_key, event_type, event_year, event_date, platform,
            duration_minutes, note, source_document, source_index, raw_text, source_title,
            tags_json, current_layer, created_at, modified_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          event.eventId,
          gameId,
          item.canonicalKey,
          event.eventType,
          event.year,
          event.date,
          event.platform,
          event.durationMinutes,
          event.note,
          event.source,
          event.sourceIndex,
          event.raw,
          event.title,
          JSON.stringify(event.tags),
          event.currentLayer ? 1 : 0,
          timestamp,
          timestamp,
        );
        summary.events++;
      }

      if (gameId) {
        for (const tag of item.tags) {
          await database.runAsync(
            `INSERT OR IGNORE INTO game_tags (game_id, tag, source, created_at)
             VALUES (?, ?, ?, ?)`,
            gameId,
            tag,
            SOURCE,
            nowIso(),
          );
          summary.tags++;
        }

        for (const alias of item.aliases) {
          const aliasKey = normalizeTitle(alias);
          if (!aliasKey) continue;
          await database.runAsync(
            `INSERT OR IGNORE INTO game_aliases
             (game_id, alias_key, alias, canonical_key, source, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            gameId,
            aliasKey,
            alias,
            item.canonicalKey,
            SOURCE,
            nowIso(),
          );
          summary.aliases++;
        }
      }
    }

    await database.runAsync(
      `INSERT INTO games_notes_imports (import_key, imported_at, summary_json)
       VALUES (?, ?, ?)`,
      IMPORT_KEY,
      nowIso(),
      JSON.stringify(summary),
    );

    await database.execAsync('COMMIT;');
    console.log('Games Notes import v1 complete', summary);
  } catch (error) {
    await database.execAsync('ROLLBACK;');
    throw error;
  }
}
