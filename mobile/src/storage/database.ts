import * as SQLite from 'expo-sqlite';
import { importGamesNotesOnce } from './gamesNotesImport';
import { importTvTimeOnce } from './tvTimeImport';
import { repairTvTimeOnce } from './tvTimeRepair';

const DATABASE_NAME = 'life_catalogue.db';
const DATABASE_VERSION = 4;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(database: SQLite.SQLiteDatabase) {
  await database.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

  const versionRow = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion < 1) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS books (
        book_id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        isbn TEXT NOT NULL,
        published_year INTEGER NOT NULL,
        reading_status TEXT NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0,
        enjoyment TEXT,
        favourite INTEGER NOT NULL DEFAULT 0,
        started_on TEXT,
        finished_on TEXT,
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS topics (
        topic_id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        description TEXT,
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS media_items (
        media_id TEXT PRIMARY KEY NOT NULL,
        media_type TEXT NOT NULL,
        tmdb_id INTEGER,
        title TEXT NOT NULL,
        original_title TEXT,
        overview TEXT,
        poster_path TEXT,
        backdrop_path TEXT,
        release_year INTEGER,
        watch_status TEXT NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0,
        enjoyment TEXT,
        favourite INTEGER NOT NULL DEFAULT 0,
        started_on TEXT,
        completed_on TEXT,
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL,
        UNIQUE(media_type, tmdb_id)
      );

      CREATE TABLE IF NOT EXISTS activities (
        activity_id TEXT PRIMARY KEY NOT NULL,
        label TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        book_id TEXT,
        topic_id TEXT,
        media_id TEXT,
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE SET NULL,
        FOREIGN KEY (topic_id) REFERENCES topics(topic_id) ON DELETE SET NULL,
        FOREIGN KEY (media_id) REFERENCES media_items(media_id) ON DELETE SET NULL,
        UNIQUE(book_id, activity_type),
        UNIQUE(media_id, activity_type)
      );

      CREATE TABLE IF NOT EXISTS games (
        game_id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        developer TEXT,
        platform TEXT NOT NULL,
        release_year INTEGER,
        game_status TEXT NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0,
        enjoyment TEXT,
        favourite INTEGER NOT NULL DEFAULT 0,
        started_on TEXT,
        finished_on TEXT,
        igdb_id INTEGER,
        cover_url TEXT,
        playing_activity_id TEXT UNIQUE,
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL,
        FOREIGN KEY (playing_activity_id) REFERENCES activities(activity_id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS time_sessions (
        session_id TEXT PRIMARY KEY NOT NULL,
        activity_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL,
        FOREIGN KEY (activity_id) REFERENCES activities(activity_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS entries (
        entry_id TEXT PRIMARY KEY NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        entry_type TEXT NOT NULL,
        book_id TEXT,
        topic_id TEXT,
        activity_id TEXT,
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE SET NULL,
        FOREIGN KEY (topic_id) REFERENCES topics(topic_id) ON DELETE SET NULL,
        FOREIGN KEY (activity_id) REFERENCES activities(activity_id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_books_title ON books(title COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_topics_name ON topics(name COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_activities_topic ON activities(topic_id);
      CREATE INDEX IF NOT EXISTS idx_activities_book ON activities(book_id);
      CREATE INDEX IF NOT EXISTS idx_activities_media ON activities(media_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_activity_started
        ON time_sessions(activity_id, started_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_one_running_session
        ON time_sessions(activity_id) WHERE ended_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_entries_modified ON entries(modified_at DESC);
      CREATE INDEX IF NOT EXISTS idx_games_title ON games(title COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_media_title ON media_items(title COLLATE NOCASE);
    `);
  }



  if (currentVersion < 2) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS audio_tracks (
        track_id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        artist TEXT,
        file_uri TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT,
        waveform_seed TEXT NOT NULL,
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS entry_soundtracks (
        link_id TEXT PRIMARY KEY NOT NULL,
        entry_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        anchor_text TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (entry_id) REFERENCES entries(entry_id) ON DELETE CASCADE,
        FOREIGN KEY (track_id) REFERENCES audio_tracks(track_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_entry_soundtracks_entry
        ON entry_soundtracks(entry_id);
      CREATE INDEX IF NOT EXISTS idx_entry_soundtracks_created
        ON entry_soundtracks(created_at DESC);
    `);
  }



  if (currentVersion < 3) {
    await database.execAsync(`
      ALTER TABLE entry_soundtracks
        ADD COLUMN clip_start_seconds REAL NOT NULL DEFAULT 0;
      ALTER TABLE entry_soundtracks
        ADD COLUMN clip_end_seconds REAL;
    `);
  }

  if (currentVersion < 4) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS series_episodes (
        media_id TEXT NOT NULL,
        episode_id INTEGER NOT NULL,
        season_number INTEGER NOT NULL,
        episode_number INTEGER NOT NULL,
        name TEXT NOT NULL,
        runtime_minutes INTEGER,
        air_date TEXT,
        image_url TEXT,
        watched INTEGER NOT NULL DEFAULT 0,
        watched_at TEXT,
        PRIMARY KEY (media_id, episode_id),
        FOREIGN KEY (media_id) REFERENCES media_items(media_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_series_episodes_order
        ON series_episodes(media_id, season_number, episode_number);
    `);
  }

  // collectionsSchemaEnsureV2
  // Always ensure these optional polymorphic tables exist. CREATE IF NOT EXISTS
  // + INSERT OR IGNORE makes this safe on every app startup.
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS collections (
      collection_id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      description TEXT,
      symbol TEXT,
      created_at TEXT NOT NULL,
      modified_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS collection_items (
      item_id TEXT PRIMARY KEY NOT NULL,
      collection_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      FOREIGN KEY (collection_id) REFERENCES collections(collection_id) ON DELETE CASCADE,
      UNIQUE(collection_id, entity_type, entity_id)
    );

    CREATE TABLE IF NOT EXISTS entity_links (
      link_id TEXT PRIMARY KEY NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      relation_type TEXT NOT NULL DEFAULT 'RELATED',
      note TEXT,
      created_at TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      UNIQUE(source_type, source_id, target_type, target_id, relation_type)
    );

    CREATE INDEX IF NOT EXISTS idx_collection_items_collection
      ON collection_items(collection_id, position, created_at);
    CREATE INDEX IF NOT EXISTS idx_collection_items_entity
      ON collection_items(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_entity_links_source
      ON entity_links(source_type, source_id);
    CREATE INDEX IF NOT EXISTS idx_entity_links_target
      ON entity_links(target_type, target_id);

    INSERT OR IGNORE INTO collections
      (collection_id, name, description, symbol, created_at, modified_at)
    VALUES
      ('00000000-0000-4000-8000-000000000101', 'Childhood', 'Stvari koje pripadaju djetinjstvu i ranim uspomenama.', '◌', datetime('now'), datetime('now')),
      ('00000000-0000-4000-8000-000000000102', 'Rainy Night Movies', 'Filmovi i serije za kišne noći.', '☂', datetime('now'), datetime('now')),
      ('00000000-0000-4000-8000-000000000103', 'Philosophy', 'Knjige, teme, citati i bilješke povezani s filozofijom.', '◇', datetime('now'), datetime('now')),
      ('00000000-0000-4000-8000-000000000104', 'Weird Internet', 'Čudni kutovi interneta, rabbit holes i reference.', '⌁', datetime('now'), datetime('now')),
      ('00000000-0000-4000-8000-000000000105', 'Comfort Games', 'Igre kojima se vraćaš radi poznatog osjećaja.', '☆', datetime('now'), datetime('now')),
      ('00000000-0000-4000-8000-000000000106', 'Summer 2026', 'Stvari koje pripadaju ljetu 2026.', '☼', datetime('now'), datetime('now')),
      ('00000000-0000-4000-8000-000000000107', 'To Revisit', 'Stvari kojima se želiš vratiti kasnije.', '↻', datetime('now'), datetime('now'));
  `);

  if (currentVersion < DATABASE_VERSION) {
    await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
  }
}

export function getDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (database) => {
      await migrate(database);
      // tvTimeImportV1 — one-time idempotent TV Time migration
      await importTvTimeOnce(database);
      // tvTimeRepairV3Fast — cached series metadata, ignored flags, stats and recent-dismiss schema
      await repairTvTimeOnce(database);
      // gamesNotesImportV1 — one-time Notes history import, SQLite only
      await importGamesNotesOnce(database);
      return database;
    });
  }
  return databasePromise;
}
