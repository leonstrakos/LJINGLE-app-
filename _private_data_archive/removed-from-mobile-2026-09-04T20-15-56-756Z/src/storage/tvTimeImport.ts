import type * as SQLite from 'expo-sqlite';

const tvTimeData = require('../assets/imports/tvtime-import-v2.json') as TvTimeImportBundle;

const IMPORT_KEY = 'tvtime-personal-data-v2';
const SOURCE = 'TV_TIME';

const STATUS_PLANNED = "WATCHLIST";
const STATUS_WATCHING = "WATCHING";
const STATUS_COMPLETED = "COMPLETED";

type TvTimeSeries = {
  id: number;
  title: string;
  followed: boolean;
  favorite: boolean;
  forLater: boolean;
  archived: boolean;
  active: boolean;
  firstWatchedAt: string | null;
  lastWatchedAt: string | null;
  watchCount: number;
  rewatchCount: number;
  followedAt: string | null;
};

type TvTimeMovie = {
  id: string;
  title: string;
  watched: boolean;
  watchedAt: string | null;
  followed: boolean;
  forLater: boolean;
  favorite: boolean;
  rewatchCount: number;
  runtimeSeconds: number | null;
  releaseDate: string | null;
  country: string | null;
};

type TvTimeEpisodeWatch = {
  seriesId: number;
  episodeId: number;
  season: number;
  episode: number;
  watchedAt: string | null;
  sourceKey: string;
  runtimeSeconds: number | null;
  bulkType: string | null;
};

type TvTimeEpisodeRewatch = {
  seriesId: number;
  episodeId: number;
  season: number;
  episode: number;
  rewatchedAt: string | null;
  rewatchCount: number;
  sourceKey: string;
};

type TvTimeLegacyRewatch = {
  seriesTitle: string;
  episodeId: number;
  season: number;
  episode: number;
  count: number;
  createdAt: string | null;
};

type TvTimeCollection = {
  sourceId: string;
  name: string;
  description: string;
  membershipAvailable: boolean;
  items: Array<{
    kind: 'SERIES' | 'MOVIE';
    sourceKey: string;
    createdAtUnix: number | null;
  }>;
};

type TvTimeImportBundle = {
  format: string;
  source: string;
  privacyNote: string;
  summary: Record<string, number>;
  series: TvTimeSeries[];
  movies: TvTimeMovie[];
  episodeWatches: TvTimeEpisodeWatch[];
  episodeRewatches: TvTimeEpisodeRewatch[];
  legacyEpisodeRewatches: TvTimeLegacyRewatch[];
  collections: TvTimeCollection[];
};

type MediaRow = {
  media_id: string;
  media_type: string;
  title: string;
  original_title: string | null;
  release_year: number | null;
  watch_status: string;
  progress: number;
  favourite: number;
  started_on: string | null;
  completed_on: string | null;
};

type ImportSummary = {
  createdSeries: number;
  reusedSeries: number;
  createdMovies: number;
  reusedMovies: number;
  watchEvents: number;
  rewatchEvents: number;
  legacyRewatchRows: number;
  collections: number;
  collectionItems: number;
  skippedCollectionItems: number;
};

function nowIso() {
  return new Date().toISOString();
}

function dateOnly(value: string | null | undefined) {
  if (!value) return null;
  return value.slice(0, 10);
}

function sourceTimestamp(value: string | null | undefined) {
  if (!value) return null;
  return value.includes('T') ? value : value.replace(' ', 'T');
}

function titleKey(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\s*\(\d{4}\)\s*$/, '')
    .replace(/[\u2018\u2019\u201c\u201d]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function releaseYear(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function json(value: unknown) {
  return JSON.stringify(value);
}

async function ensureImportSchema(database: SQLite.SQLiteDatabase) {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS app_imports (
      import_key TEXT PRIMARY KEY NOT NULL,
      imported_at TEXT NOT NULL,
      summary_json TEXT
    );

    CREATE TABLE IF NOT EXISTS external_media_map (
      source TEXT NOT NULL,
      source_media_key TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      media_id TEXT NOT NULL,
      source_title TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      PRIMARY KEY (source, source_media_key),
      FOREIGN KEY (media_id) REFERENCES media_items(media_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_external_media_map_media
      ON external_media_map(media_id);

    CREATE TABLE IF NOT EXISTS external_watch_events (
      event_id TEXT PRIMARY KEY NOT NULL,
      media_id TEXT NOT NULL,
      source TEXT NOT NULL,
      event_type TEXT NOT NULL,
      source_episode_key TEXT,
      season_number INTEGER,
      episode_number INTEGER,
      watched_at TEXT,
      rewatch_index INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (media_id) REFERENCES media_items(media_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_external_watch_media_date
      ON external_watch_events(media_id, watched_at);

    CREATE INDEX IF NOT EXISTS idx_external_watch_episode
      ON external_watch_events(media_id, season_number, episode_number);

    CREATE TRIGGER IF NOT EXISTS tvtime_mark_episode_after_insert
    AFTER INSERT ON series_episodes
    WHEN EXISTS (
      SELECT 1
      FROM external_watch_events e
      WHERE e.source = 'TV_TIME'
        AND e.media_id = NEW.media_id
        AND e.season_number = NEW.season_number
        AND e.episode_number = NEW.episode_number
        AND e.event_type IN ('EPISODE_WATCH', 'EPISODE_REWATCH', 'EPISODE_REWATCH_LEGACY')
    )
    BEGIN
      UPDATE series_episodes
      SET watched = 1,
          watched_at = COALESCE(
            (
              SELECT MIN(e.watched_at)
              FROM external_watch_events e
              WHERE e.source = 'TV_TIME'
                AND e.media_id = NEW.media_id
                AND e.season_number = NEW.season_number
                AND e.episode_number = NEW.episode_number
                AND e.watched_at IS NOT NULL
                AND e.event_type IN ('EPISODE_WATCH', 'EPISODE_REWATCH', 'EPISODE_REWATCH_LEGACY')
            ),
            watched_at
          )
      WHERE media_id = NEW.media_id
        AND episode_id = NEW.episode_id;
    END;

    CREATE TRIGGER IF NOT EXISTS tvtime_mark_episode_after_number_update
    AFTER UPDATE OF season_number, episode_number ON series_episodes
    WHEN EXISTS (
      SELECT 1
      FROM external_watch_events e
      WHERE e.source = 'TV_TIME'
        AND e.media_id = NEW.media_id
        AND e.season_number = NEW.season_number
        AND e.episode_number = NEW.episode_number
        AND e.event_type IN ('EPISODE_WATCH', 'EPISODE_REWATCH', 'EPISODE_REWATCH_LEGACY')
    )
    BEGIN
      UPDATE series_episodes
      SET watched = 1,
          watched_at = COALESCE(
            (
              SELECT MIN(e.watched_at)
              FROM external_watch_events e
              WHERE e.source = 'TV_TIME'
                AND e.media_id = NEW.media_id
                AND e.season_number = NEW.season_number
                AND e.episode_number = NEW.episode_number
                AND e.watched_at IS NOT NULL
                AND e.event_type IN ('EPISODE_WATCH', 'EPISODE_REWATCH', 'EPISODE_REWATCH_LEGACY')
            ),
            watched_at
          )
      WHERE media_id = NEW.media_id
        AND episode_id = NEW.episode_id;
    END;

    CREATE TRIGGER IF NOT EXISTS tvtime_recalc_series_after_episode_insert
    AFTER INSERT ON series_episodes
    WHEN EXISTS (
      SELECT 1 FROM external_media_map m
      WHERE m.source = 'TV_TIME'
        AND m.entity_type = 'SERIES'
        AND m.media_id = NEW.media_id
    )
    BEGIN
      UPDATE media_items
      SET progress = CASE
        WHEN (SELECT COUNT(*) FROM series_episodes WHERE media_id = NEW.media_id) = 0 THEN progress
        ELSE CAST(ROUND(
          100.0 * (SELECT SUM(watched) FROM series_episodes WHERE media_id = NEW.media_id)
          / (SELECT COUNT(*) FROM series_episodes WHERE media_id = NEW.media_id)
        ) AS INTEGER)
      END,
      modified_at = datetime('now')
      WHERE media_id = NEW.media_id;
    END;

    CREATE TRIGGER IF NOT EXISTS tvtime_recalc_series_after_watched_update
    AFTER UPDATE OF watched ON series_episodes
    WHEN EXISTS (
      SELECT 1 FROM external_media_map m
      WHERE m.source = 'TV_TIME'
        AND m.entity_type = 'SERIES'
        AND m.media_id = NEW.media_id
    )
    BEGIN
      UPDATE media_items
      SET progress = CASE
        WHEN (SELECT COUNT(*) FROM series_episodes WHERE media_id = NEW.media_id) = 0 THEN progress
        ELSE CAST(ROUND(
          100.0 * (SELECT SUM(watched) FROM series_episodes WHERE media_id = NEW.media_id)
          / (SELECT COUNT(*) FROM series_episodes WHERE media_id = NEW.media_id)
        ) AS INTEGER)
      END,
      modified_at = datetime('now')
      WHERE media_id = NEW.media_id;
    END;

    CREATE TRIGGER IF NOT EXISTS tvtime_recalc_series_after_episode_delete
    AFTER DELETE ON series_episodes
    WHEN EXISTS (
      SELECT 1 FROM external_media_map m
      WHERE m.source = 'TV_TIME'
        AND m.entity_type = 'SERIES'
        AND m.media_id = OLD.media_id
    )
    BEGIN
      UPDATE media_items
      SET progress = CASE
        WHEN (SELECT COUNT(*) FROM series_episodes WHERE media_id = OLD.media_id) = 0 THEN 0
        ELSE CAST(ROUND(
          100.0 * (SELECT SUM(watched) FROM series_episodes WHERE media_id = OLD.media_id)
          / (SELECT COUNT(*) FROM series_episodes WHERE media_id = OLD.media_id)
        ) AS INTEGER)
      END,
      modified_at = datetime('now')
      WHERE media_id = OLD.media_id;
    END;
  `);
}

function matchExistingMedia(
  rows: MediaRow[],
  mediaType: 'MOVIE' | 'SERIES',
  title: string,
  year: number | null,
) {
  const key = titleKey(title);
  const matches = rows.filter((row) =>
    row.media_type === mediaType
    && (titleKey(row.title) === key || titleKey(row.original_title) === key),
  );

  if (mediaType === 'MOVIE' && year != null) {
    const yearMatches = matches.filter((row) => Number(row.release_year) === year);
    if (yearMatches.length === 1) return yearMatches[0]!;
  }

  return matches.length === 1 ? matches[0]! : null;
}

async function mappedMediaId(
  database: SQLite.SQLiteDatabase,
  sourceKey: string,
) {
  const row = await database.getFirstAsync<{ media_id: string }>(
    `SELECT media_id FROM external_media_map
     WHERE source = ? AND source_media_key = ?`,
    SOURCE,
    sourceKey,
  );
  return row?.media_id ?? null;
}

async function saveMap(
  database: SQLite.SQLiteDatabase,
  sourceKey: string,
  entityType: 'MOVIE' | 'SERIES',
  mediaId: string,
  sourceTitle: string,
  metadata: unknown,
) {
  const now = nowIso();
  await database.runAsync(
    `INSERT INTO external_media_map
     (source, source_media_key, entity_type, media_id, source_title, metadata_json, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(source, source_media_key) DO UPDATE SET
       entity_type = excluded.entity_type,
       media_id = excluded.media_id,
       source_title = excluded.source_title,
       metadata_json = excluded.metadata_json,
       modified_at = excluded.modified_at`,
    SOURCE,
    sourceKey,
    entityType,
    mediaId,
    sourceTitle,
    json(metadata),
    now,
    now,
  );
}

async function insertExternalEvent(
  database: SQLite.SQLiteDatabase,
  payload: {
    eventId: string;
    mediaId: string;
    eventType: string;
    sourceEpisodeKey?: string | null;
    season?: number | null;
    episode?: number | null;
    watchedAt?: string | null;
    rewatchIndex?: number;
    metadata?: unknown;
  },
) {
  await database.runAsync(
    `INSERT OR IGNORE INTO external_watch_events
     (event_id, media_id, source, event_type, source_episode_key,
      season_number, episode_number, watched_at, rewatch_index, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    payload.eventId,
    payload.mediaId,
    SOURCE,
    payload.eventType,
    payload.sourceEpisodeKey ?? null,
    payload.season ?? null,
    payload.episode ?? null,
    sourceTimestamp(payload.watchedAt),
    payload.rewatchIndex ?? 0,
    payload.metadata == null ? null : json(payload.metadata),
    nowIso(),
  );
}

async function reconcileExistingEpisodes(database: SQLite.SQLiteDatabase) {
  await database.runAsync(`
    UPDATE series_episodes
    SET watched = 1,
        watched_at = COALESCE(
          (
            SELECT MIN(e.watched_at)
            FROM external_watch_events e
            WHERE e.source = 'TV_TIME'
              AND e.media_id = series_episodes.media_id
              AND e.season_number = series_episodes.season_number
              AND e.episode_number = series_episodes.episode_number
              AND e.watched_at IS NOT NULL
              AND e.event_type IN ('EPISODE_WATCH', 'EPISODE_REWATCH', 'EPISODE_REWATCH_LEGACY')
          ),
          watched_at
        )
    WHERE EXISTS (
      SELECT 1
      FROM external_watch_events e
      WHERE e.source = 'TV_TIME'
        AND e.media_id = series_episodes.media_id
        AND e.season_number = series_episodes.season_number
        AND e.episode_number = series_episodes.episode_number
        AND e.event_type IN ('EPISODE_WATCH', 'EPISODE_REWATCH', 'EPISODE_REWATCH_LEGACY')
    )
  `);
}

export async function importTvTimeOnce(database: SQLite.SQLiteDatabase) {
  await ensureImportSchema(database);

  const alreadyImported = await database.getFirstAsync<{ import_key: string }>(
    'SELECT import_key FROM app_imports WHERE import_key = ?',
    IMPORT_KEY,
  );
  if (alreadyImported) return;

  const summary: ImportSummary = {
    createdSeries: 0,
    reusedSeries: 0,
    createdMovies: 0,
    reusedMovies: 0,
    watchEvents: 0,
    rewatchEvents: 0,
    legacyRewatchRows: 0,
    collections: 0,
    collectionItems: 0,
    skippedCollectionItems: 0,
  };

  await database.execAsync('BEGIN IMMEDIATE;');

  try {
    const existingRows = await database.getAllAsync<MediaRow>(
      `SELECT media_id, media_type, title, original_title, release_year, watch_status,
              progress, favourite, started_on, completed_on
       FROM media_items`,
    );

    const sourceToMedia = new Map<string, string>();
    const seriesTitleToIds = new Map<string, string[]>();

    for (const series of tvTimeData.series) {
      const sourceKey = `series:${series.id}`;
      let mediaId = await mappedMediaId(database, sourceKey);
      let row = mediaId ? existingRows.find((item) => item.media_id === mediaId) ?? null : null;

      if (!mediaId) {
        row = matchExistingMedia(existingRows, 'SERIES', series.title, null);
        mediaId = row?.media_id ?? `tvtime-series-${series.id}`;
      }

      const startedOn = dateOnly(series.firstWatchedAt);
      const desiredStatus = series.watchCount > 0 ? STATUS_WATCHING : STATUS_PLANNED;

      if (row) {
        summary.reusedSeries++;
        await database.runAsync(
          `UPDATE media_items
           SET watch_status = CASE WHEN watch_status = ? AND ? <> ? THEN ? ELSE watch_status END,
               favourite = CASE WHEN favourite = 1 OR ? = 1 THEN 1 ELSE 0 END,
               started_on = COALESCE(started_on, ?),
               modified_at = ?
           WHERE media_id = ?`,
          STATUS_PLANNED,
          desiredStatus,
          STATUS_PLANNED,
          desiredStatus,
          series.favorite ? 1 : 0,
          startedOn,
          nowIso(),
          mediaId,
        );
      } else {
        summary.createdSeries++;
        const now = nowIso();
        await database.runAsync(
          `INSERT INTO media_items
           (media_id, media_type, tmdb_id, title, original_title, overview, poster_path,
            backdrop_path, release_year, watch_status, progress, enjoyment, favourite,
            started_on, completed_on, created_at, modified_at)
           VALUES (?, 'SERIES', NULL, ?, NULL, NULL, NULL, NULL, NULL, ?, 0, NULL, ?, ?, NULL, ?, ?)`,
          mediaId,
          series.title,
          desiredStatus,
          series.favorite ? 1 : 0,
          startedOn,
          now,
          now,
        );
        existingRows.push({
          media_id: mediaId,
          media_type: 'SERIES',
          title: series.title,
          original_title: null,
          release_year: null,
          watch_status: desiredStatus,
          progress: 0,
          favourite: series.favorite ? 1 : 0,
          started_on: startedOn,
          completed_on: null,
        });
      }

      await saveMap(database, sourceKey, 'SERIES', mediaId, series.title, series);
      sourceToMedia.set(sourceKey, mediaId);
      const key = titleKey(series.title);
      const bucket = seriesTitleToIds.get(key) ?? [];
      if (!bucket.includes(mediaId)) bucket.push(mediaId);
      seriesTitleToIds.set(key, bucket);
    }

    for (const movie of tvTimeData.movies) {
      const sourceKey = `movie:${movie.id}`;
      const year = releaseYear(movie.releaseDate);
      let mediaId = await mappedMediaId(database, sourceKey);
      let row = mediaId ? existingRows.find((item) => item.media_id === mediaId) ?? null : null;

      if (!mediaId) {
        row = matchExistingMedia(existingRows, 'MOVIE', movie.title, year);
        mediaId = row?.media_id ?? `tvtime-movie-${movie.id}`;
      }

      const desiredStatus = movie.watched ? STATUS_COMPLETED : STATUS_PLANNED;
      const completedOn = movie.watched ? dateOnly(movie.watchedAt) : null;

      if (row) {
        summary.reusedMovies++;
        await database.runAsync(
          `UPDATE media_items
           SET watch_status = CASE WHEN watch_status = ? AND ? <> ? THEN ? ELSE watch_status END,
               progress = CASE WHEN ? = 1 AND progress < 100 THEN 100 ELSE progress END,
               favourite = CASE WHEN favourite = 1 OR ? = 1 THEN 1 ELSE 0 END,
               completed_on = COALESCE(completed_on, ?),
               modified_at = ?
           WHERE media_id = ?`,
          STATUS_PLANNED,
          desiredStatus,
          STATUS_PLANNED,
          desiredStatus,
          movie.watched ? 1 : 0,
          movie.favorite ? 1 : 0,
          completedOn,
          nowIso(),
          mediaId,
        );
      } else {
        summary.createdMovies++;
        const now = nowIso();
        await database.runAsync(
          `INSERT INTO media_items
           (media_id, media_type, tmdb_id, title, original_title, overview, poster_path,
            backdrop_path, release_year, watch_status, progress, enjoyment, favourite,
            started_on, completed_on, created_at, modified_at)
           VALUES (?, 'MOVIE', NULL, ?, NULL, NULL, NULL, NULL, ?, ?, ?, NULL, ?, NULL, ?, ?, ?)`,
          mediaId,
          movie.title,
          year,
          desiredStatus,
          movie.watched ? 100 : 0,
          movie.favorite ? 1 : 0,
          completedOn,
          now,
          now,
        );
        existingRows.push({
          media_id: mediaId,
          media_type: 'MOVIE',
          title: movie.title,
          original_title: null,
          release_year: year,
          watch_status: desiredStatus,
          progress: movie.watched ? 100 : 0,
          favourite: movie.favorite ? 1 : 0,
          started_on: null,
          completed_on: completedOn,
        });
      }

      await saveMap(database, sourceKey, 'MOVIE', mediaId, movie.title, movie);
      sourceToMedia.set(sourceKey, mediaId);

      if (movie.watched) {
        await insertExternalEvent(database, {
          eventId: `tvtime:movie-watch:${movie.id}`,
          mediaId,
          eventType: 'MOVIE_WATCH',
          watchedAt: movie.watchedAt,
          metadata: { runtimeSeconds: movie.runtimeSeconds, country: movie.country },
        });
        summary.watchEvents++;
      }

      if (movie.rewatchCount > 0) {
        await insertExternalEvent(database, {
          eventId: `tvtime:movie-rewatch-count:${movie.id}`,
          mediaId,
          eventType: 'MOVIE_REWATCH_COUNT',
          rewatchIndex: movie.rewatchCount,
          metadata: { count: movie.rewatchCount },
        });
        summary.rewatchEvents += movie.rewatchCount;
      }
    }

    for (const event of tvTimeData.episodeWatches) {
      const mediaId = sourceToMedia.get(`series:${event.seriesId}`)
        ?? await mappedMediaId(database, `series:${event.seriesId}`);
      if (!mediaId) continue;
      await insertExternalEvent(database, {
        eventId: `tvtime:${event.sourceKey}`,
        mediaId,
        eventType: 'EPISODE_WATCH',
        sourceEpisodeKey: String(event.episodeId),
        season: event.season,
        episode: event.episode,
        watchedAt: event.watchedAt,
        metadata: { runtimeSeconds: event.runtimeSeconds, bulkType: event.bulkType },
      });
      summary.watchEvents++;
    }

    for (const event of tvTimeData.episodeRewatches) {
      const mediaId = sourceToMedia.get(`series:${event.seriesId}`)
        ?? await mappedMediaId(database, `series:${event.seriesId}`);
      if (!mediaId) continue;
      await insertExternalEvent(database, {
        eventId: `tvtime:${event.sourceKey}`,
        mediaId,
        eventType: 'EPISODE_REWATCH',
        sourceEpisodeKey: String(event.episodeId),
        season: event.season,
        episode: event.episode,
        watchedAt: event.rewatchedAt,
        rewatchIndex: event.rewatchCount,
        metadata: { count: event.rewatchCount },
      });
      summary.rewatchEvents += event.rewatchCount;
    }

    for (const event of tvTimeData.legacyEpisodeRewatches) {
      const ids = seriesTitleToIds.get(titleKey(event.seriesTitle)) ?? [];
      if (ids.length !== 1) continue;
      const mediaId = ids[0]!;
      await insertExternalEvent(database, {
        eventId: `tvtime:legacy-rewatch:${event.episodeId}:${event.createdAt ?? 'unknown'}`,
        mediaId,
        eventType: 'EPISODE_REWATCH_LEGACY',
        sourceEpisodeKey: String(event.episodeId),
        season: event.season,
        episode: event.episode,
        watchedAt: event.createdAt,
        rewatchIndex: event.count,
        metadata: { count: event.count, legacy: true },
      });
      summary.legacyRewatchRows++;
      summary.rewatchEvents += event.count;
    }

    await reconcileExistingEpisodes(database);

    for (const list of tvTimeData.collections) {
      const deterministicId = `tvtime-list-${list.sourceId}`;
      const existingCollection = await database.getFirstAsync<{ collection_id: string }>(
        'SELECT collection_id FROM collections WHERE name = ? COLLATE NOCASE',
        list.name,
      );
      const collectionId = existingCollection?.collection_id ?? deterministicId;
      const now = nowIso();

      if (!existingCollection) {
        await database.runAsync(
          `INSERT INTO collections
           (collection_id, name, description, symbol, created_at, modified_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          collectionId,
          list.name,
          list.description,
          '◉',
          now,
          now,
        );
      }
      summary.collections++;

      for (let index = 0; index < list.items.length; index++) {
        const item = list.items[index]!;
        const mediaId = sourceToMedia.get(item.sourceKey)
          ?? await mappedMediaId(database, item.sourceKey);
        if (!mediaId) {
          summary.skippedCollectionItems++;
          continue;
        }
        await database.runAsync(
          `INSERT OR IGNORE INTO collection_items
           (item_id, collection_id, entity_type, entity_id, position, created_at, modified_at)
           VALUES (?, ?, 'MEDIA', ?, ?, ?, ?)`,
          `tvtime-list-item-${list.sourceId}-${index}`,
          collectionId,
          mediaId,
          index,
          item.createdAtUnix ? new Date(item.createdAtUnix * 1000).toISOString() : now,
          now,
        );
        summary.collectionItems++;
      }
    }

    await database.runAsync(
      `INSERT INTO app_imports (import_key, imported_at, summary_json)
       VALUES (?, ?, ?)`,
      IMPORT_KEY,
      nowIso(),
      json({ ...tvTimeData.summary, actual: summary }),
    );

    await database.execAsync('COMMIT;');
    console.info('[TV Time import] complete', summary);
  } catch (error) {
    try {
      await database.execAsync('ROLLBACK;');
    } catch {
      // Preserve the original import error.
    }
    throw error;
  }
}
