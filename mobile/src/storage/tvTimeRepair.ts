import type * as SQLite from 'expo-sqlite';

const repairData = require('../assets/imports/tvtime-repair-v3.json') as TvTimeRepairBundle;

const IMPORT_KEY = 'tvtime-personal-data-repair-v3-fast';
const SOURCE = 'TV_TIME';

const STATUS_PLANNED = "WATCHLIST";
const STATUS_WATCHING = "WATCHING";
const STATUS_COMPLETED = "COMPLETED";
const STATUS_DROPPED = "DROPPED";

type EpisodeMetadata = {
  id: number;
  season: number;
  episode: number;
  name: string;
  runtimeMinutes: number | null;
  airDate: string | null;
  imageUrl: string | null;
};

type SeriesRepair = {
  sourceKey: string;
  tvTimeId: number;
  title: string;
  addedAt: string | null;
  archived: boolean;
  firstWatchedAt: string | null;
  lastWatchedAt: string | null;
  metadata: null | {
    sourceId: number;
    title: string;
    overview: string | null;
    posterPath: string | null;
    releaseYear: number | null;
    status: string | null;
  };
  episodes: EpisodeMetadata[];
};

type MovieRepair = {
  sourceKey: string;
  sourceId: string;
  title: string;
  addedAt: string | null;
  watched: boolean;
  watchedAt: string | null;
  forLater: boolean;
  rewatchCount: number;
  runtimeSeconds: number | null;
  metadata: null | {
    sourceId: number;
    title: string;
    overview: string | null;
    posterPath: string | null;
    releaseYear: number | null;
  };
};

type TvTimeRepairBundle = {
  format: string;
  generatedAt: string;
  series: SeriesRepair[];
  movies: MovieRepair[];
  nebitno: Array<{ sourceKey: string; addedAt: string | null }>;
  unresolved: {
    series: string[];
    movies: string[];
  };
  stats: {
    sourceUpdatedAt: string | null;
    totalSeriesRuntimeSeconds: number;
    seriesFollowCount: number;
    movieWatchCount: number;
    totalMoviesRuntimeSeconds: number;
    episodeWatchCount: number;
  };
};

type Summary = {
  mappedSeries: number;
  mappedMovies: number;
  metadataSeries: number;
  metadataMovies: number;
  episodesInsertedOrUpdated: number;
  droppedArchived: number;
  completedSeries: number;
  ignoredMapped: number;
  ignoredSourceItems: number;
  movieRuntimesStored: number;
  unresolvedSeries: number;
  unresolvedMovies: number;
};

function nowIso() {
  return new Date().toISOString();
}

function sourceTimestamp(value: string | null | undefined) {
  if (!value) return null;
  if (value.includes('T')) return value;
  return `${value.replace(' ', 'T')}Z`;
}

async function ensureV3Schema(database: SQLite.SQLiteDatabase) {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS external_media_flags (
      source TEXT NOT NULL,
      source_media_key TEXT NOT NULL,
      media_id TEXT,
      flag TEXT NOT NULL,
      flagged_at TEXT,
      created_at TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      PRIMARY KEY (source, source_media_key, flag),
      FOREIGN KEY (media_id) REFERENCES media_items(media_id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_external_media_flags_media
      ON external_media_flags(media_id, flag);

    CREATE TABLE IF NOT EXISTS tvtime_media_runtime (
      media_id TEXT PRIMARY KEY NOT NULL,
      runtime_seconds INTEGER,
      rewatch_count INTEGER NOT NULL DEFAULT 0,
      watched_at TEXT,
      modified_at TEXT NOT NULL,
      FOREIGN KEY (media_id) REFERENCES media_items(media_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tvtime_stats_snapshot (
      snapshot_key TEXT PRIMARY KEY NOT NULL,
      source_updated_at TEXT,
      total_series_runtime_seconds INTEGER NOT NULL,
      series_follow_count INTEGER NOT NULL,
      movie_watch_count INTEGER NOT NULL,
      total_movies_runtime_seconds INTEGER NOT NULL,
      episode_watch_count INTEGER NOT NULL,
      imported_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_recent_dismissals (
      activity_id TEXT PRIMARY KEY NOT NULL,
      dismissed_at TEXT NOT NULL,
      FOREIGN KEY (activity_id) REFERENCES activities(activity_id) ON DELETE CASCADE
    );
  `);
}

async function mappedMediaId(database: SQLite.SQLiteDatabase, sourceKey: string) {
  const row = await database.getFirstAsync<{ media_id: string }>(
    `SELECT media_id
       FROM external_media_map
      WHERE source = ? AND source_media_key = ?`,
    SOURCE,
    sourceKey,
  );
  return row?.media_id ?? null;
}

async function safeExternalSourceId(
  database: SQLite.SQLiteDatabase,
  mediaId: string,
  mediaType: 'MOVIE' | 'SERIES',
  sourceId: number,
) {
  const collision = await database.getFirstAsync<{ media_id: string }>(
    `SELECT media_id
       FROM media_items
      WHERE media_type = ?
        AND tmdb_id = ?
        AND media_id <> ?
      LIMIT 1`,
    mediaType,
    sourceId,
    mediaId,
  );
  return collision ? null : sourceId;
}

async function reconcileWatchedEpisodes(database: SQLite.SQLiteDatabase, mediaId: string) {
  await database.runAsync(
    `UPDATE series_episodes
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
      WHERE media_id = ?
        AND EXISTS (
          SELECT 1
            FROM external_watch_events e
           WHERE e.source = 'TV_TIME'
             AND e.media_id = series_episodes.media_id
             AND e.season_number = series_episodes.season_number
             AND e.episode_number = series_episodes.episode_number
             AND e.event_type IN ('EPISODE_WATCH', 'EPISODE_REWATCH', 'EPISODE_REWATCH_LEGACY')
        )`,
    mediaId,
  );
}

async function repairSeriesStatus(
  database: SQLite.SQLiteDatabase,
  mediaId: string,
  archived: boolean,
  sourceEnded: boolean,
) {
  if (archived) {
    await database.runAsync(
      `UPDATE media_items
          SET watch_status = ?, modified_at = ?
        WHERE media_id = ?`,
      STATUS_DROPPED,
      nowIso(),
      mediaId,
    );
    return 'DROPPED' as const;
  }

  const regular = await database.getFirstAsync<{
    total: number;
    watched: number;
    completed_on: string | null;
  }>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN watched = 1 THEN 1 ELSE 0 END), 0) AS watched,
            MAX(CASE WHEN watched = 1 THEN watched_at ELSE NULL END) AS completed_on
       FROM series_episodes
      WHERE media_id = ? AND season_number > 0`,
    mediaId,
  );

  const total = Number(regular?.total ?? 0);
  const watched = Number(regular?.watched ?? 0);
  const progress = total > 0 ? Math.max(0, Math.min(100, Math.round((watched / total) * 100))) : null;

  if (total > 0 && sourceEnded && watched === total) {
    await database.runAsync(
      `UPDATE media_items
          SET watch_status = ?,
              progress = 100,
              completed_on = COALESCE(completed_on, ?),
              modified_at = ?
        WHERE media_id = ?`,
      STATUS_COMPLETED,
      regular?.completed_on?.slice(0, 10) ?? null,
      nowIso(),
      mediaId,
    );
    return 'COMPLETED' as const;
  }

  const externalWatch = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM external_watch_events
      WHERE source = 'TV_TIME'
        AND media_id = ?
        AND event_type IN ('EPISODE_WATCH', 'EPISODE_REWATCH', 'EPISODE_REWATCH_LEGACY')`,
    mediaId,
  );

  const hasWatched = watched > 0 || Number(externalWatch?.count ?? 0) > 0;
  await database.runAsync(
    `UPDATE media_items
        SET watch_status = ?,
            progress = COALESCE(?, progress),
            modified_at = ?
      WHERE media_id = ?`,
    hasWatched ? STATUS_WATCHING : STATUS_PLANNED,
    progress,
    nowIso(),
    mediaId,
  );
  return hasWatched ? 'WATCHING' as const : 'PLANNED' as const;
}

export async function repairTvTimeOnce(database: SQLite.SQLiteDatabase) {
  await ensureV3Schema(database);

  const already = await database.getFirstAsync<{ import_key: string }>(
    'SELECT import_key FROM app_imports WHERE import_key = ?',
    IMPORT_KEY,
  );
  if (already) return;

  const summary: Summary = {
    mappedSeries: 0,
    mappedMovies: 0,
    metadataSeries: 0,
    metadataMovies: 0,
    episodesInsertedOrUpdated: 0,
    droppedArchived: 0,
    completedSeries: 0,
    ignoredMapped: 0,
    ignoredSourceItems: repairData.nebitno.length,
    movieRuntimesStored: 0,
    unresolvedSeries: repairData.unresolved.series.length,
    unresolvedMovies: repairData.unresolved.movies.length,
  };

  const nebitnoKeys = new Set(repairData.nebitno.map((item) => item.sourceKey));

  await database.execAsync('BEGIN IMMEDIATE;');
  try {
    for (const series of repairData.series) {
      const mediaId = await mappedMediaId(database, series.sourceKey);
      if (!mediaId) continue;
      summary.mappedSeries++;

      const addedAt = sourceTimestamp(series.addedAt);
      const metadata = series.metadata;

      if (metadata) {
        summary.metadataSeries++;
        const sourceId = await safeExternalSourceId(
          database,
          mediaId,
          'SERIES',
          metadata.sourceId,
        );
        await database.runAsync(
          `UPDATE media_items
              SET tmdb_id = COALESCE(tmdb_id, ?),
                  overview = COALESCE(overview, ?),
                  poster_path = COALESCE(poster_path, ?),
                  release_year = COALESCE(release_year, ?),
                  created_at = CASE
                    WHEN media_id LIKE 'tvtime-%' AND ? IS NOT NULL THEN ?
                    ELSE created_at
                  END,
                  modified_at = ?
            WHERE media_id = ?`,
          sourceId,
          metadata.overview,
          metadata.posterPath,
          metadata.releaseYear,
          addedAt,
          addedAt,
          nowIso(),
          mediaId,
        );

        for (const episode of series.episodes) {
          // Preserve an episode row that the app already knows about, even if its
          // provider-specific episode_id differs from TVmaze. Season + episode is
          // the stable bridge to the TV Time history.
          const existingEpisode = await database.getFirstAsync<{ episode_id: number }>(
            `SELECT episode_id
               FROM series_episodes
              WHERE media_id = ?
                AND season_number = ?
                AND episode_number = ?
              LIMIT 1`,
            mediaId,
            episode.season,
            episode.episode,
          );

          if (existingEpisode) {
            await database.runAsync(
              `UPDATE series_episodes
                  SET name = ?,
                      runtime_minutes = COALESCE(?, runtime_minutes),
                      air_date = COALESCE(?, air_date),
                      image_url = COALESCE(?, image_url)
                WHERE media_id = ? AND episode_id = ?`,
              episode.name,
              episode.runtimeMinutes,
              episode.airDate,
              episode.imageUrl,
              mediaId,
              existingEpisode.episode_id,
            );
          } else {
            await database.runAsync(
              `INSERT OR IGNORE INTO series_episodes
               (media_id, episode_id, season_number, episode_number, name,
                runtime_minutes, air_date, image_url, watched, watched_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
              mediaId,
              episode.id,
              episode.season,
              episode.episode,
              episode.name,
              episode.runtimeMinutes,
              episode.airDate,
              episode.imageUrl,
            );
          }
          summary.episodesInsertedOrUpdated++;
        }
      } else if (addedAt) {
        await database.runAsync(
          `UPDATE media_items
              SET created_at = CASE WHEN media_id LIKE 'tvtime-%' THEN ? ELSE created_at END,
                  modified_at = ?
            WHERE media_id = ?`,
          addedAt,
          nowIso(),
          mediaId,
        );
      }

      await reconcileWatchedEpisodes(database, mediaId);

      const dropped = series.archived;
      const result = await repairSeriesStatus(
        database,
        mediaId,
        dropped,
        (metadata?.status ?? '').toLowerCase() === 'ended',
      );
      if (result === 'DROPPED' && series.archived) summary.droppedArchived++;
      if (result === 'COMPLETED') summary.completedSeries++;
    }

    for (const movie of repairData.movies) {
      const mediaId = await mappedMediaId(database, movie.sourceKey);
      if (!mediaId) continue;
      summary.mappedMovies++;

      const addedAt = sourceTimestamp(movie.addedAt);
      const metadata = movie.metadata;
      if (metadata) {
        summary.metadataMovies++;
        const sourceId = await safeExternalSourceId(
          database,
          mediaId,
          'MOVIE',
          metadata.sourceId,
        );
        await database.runAsync(
          `UPDATE media_items
              SET tmdb_id = COALESCE(tmdb_id, ?),
                  overview = COALESCE(overview, ?),
                  poster_path = COALESCE(poster_path, ?),
                  release_year = COALESCE(release_year, ?),
                  created_at = CASE
                    WHEN media_id LIKE 'tvtime-%' AND ? IS NOT NULL THEN ?
                    ELSE created_at
                  END,
                  modified_at = ?
            WHERE media_id = ?`,
          sourceId,
          metadata.overview,
          metadata.posterPath,
          metadata.releaseYear,
          addedAt,
          addedAt,
          nowIso(),
          mediaId,
        );
      } else if (addedAt) {
        await database.runAsync(
          `UPDATE media_items
              SET created_at = CASE WHEN media_id LIKE 'tvtime-%' THEN ? ELSE created_at END,
                  modified_at = ?
            WHERE media_id = ?`,
          addedAt,
          nowIso(),
          mediaId,
        );
      }

      await database.runAsync(
        `INSERT INTO tvtime_media_runtime
         (media_id, runtime_seconds, rewatch_count, watched_at, modified_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(media_id) DO UPDATE SET
           runtime_seconds = excluded.runtime_seconds,
           rewatch_count = excluded.rewatch_count,
           watched_at = excluded.watched_at,
           modified_at = excluded.modified_at`,
        mediaId,
        movie.runtimeSeconds,
        movie.rewatchCount,
        sourceTimestamp(movie.watchedAt),
        nowIso(),
      );
      if (movie.runtimeSeconds != null) summary.movieRuntimesStored++;

      // If an older repair forced a Nebitno movie into DROPPED, restore its
      // underlying TV Time state. It remains hidden by the NEBITNO flag below.
      if (nebitnoKeys.has(movie.sourceKey)) {
        await database.runAsync(
          `UPDATE media_items
              SET watch_status = ?,
                  progress = ?,
                  completed_on = CASE WHEN ? = 1 THEN COALESCE(completed_on, ?) ELSE completed_on END,
                  modified_at = ?
            WHERE media_id = ?`,
          movie.watched ? STATUS_COMPLETED : STATUS_PLANNED,
          movie.watched ? 100 : 0,
          movie.watched ? 1 : 0,
          movie.watched ? movie.watchedAt?.slice(0, 10) ?? null : null,
          nowIso(),
          mediaId,
        );
      }
    }

    // Nebitno is an ignored flag, NOT a watch status and NOT a collection.
    for (const item of repairData.nebitno) {
      const mediaId = await mappedMediaId(database, item.sourceKey);
      const flaggedAt = sourceTimestamp(item.addedAt);
      await database.runAsync(
        `INSERT INTO external_media_flags
         (source, source_media_key, media_id, flag, flagged_at, created_at, modified_at)
         VALUES (?, ?, ?, 'NEBITNO', ?, ?, ?)
         ON CONFLICT(source, source_media_key, flag) DO UPDATE SET
           media_id = excluded.media_id,
           flagged_at = COALESCE(excluded.flagged_at, external_media_flags.flagged_at),
           modified_at = excluded.modified_at`,
        SOURCE,
        item.sourceKey,
        mediaId,
        flaggedAt,
        nowIso(),
        nowIso(),
      );
      if (mediaId) summary.ignoredMapped++;
    }

    // Remove the old empty/recovered Nebitno collection and remove ignored media
    // from every collection so it contributes to no collection count.
    await database.runAsync(
      `DELETE FROM collection_items
        WHERE collection_id IN (
          SELECT collection_id FROM collections
           WHERE name = 'TV Time • Nebitno' COLLATE NOCASE
        )`,
    );
    await database.runAsync(
      `DELETE FROM collections WHERE name = 'TV Time • Nebitno' COLLATE NOCASE`,
    );
    await database.runAsync(
      `DELETE FROM collection_items
        WHERE entity_type = 'MEDIA'
          AND entity_id IN (
            SELECT media_id FROM external_media_flags
             WHERE source = 'TV_TIME' AND flag = 'NEBITNO' AND media_id IS NOT NULL
          )`,
    );

    await database.runAsync(
      `INSERT INTO tvtime_stats_snapshot
       (snapshot_key, source_updated_at, total_series_runtime_seconds, series_follow_count,
        movie_watch_count, total_movies_runtime_seconds, episode_watch_count, imported_at)
       VALUES ('TV_TIME_EXPORT', ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(snapshot_key) DO UPDATE SET
         source_updated_at = excluded.source_updated_at,
         total_series_runtime_seconds = excluded.total_series_runtime_seconds,
         series_follow_count = excluded.series_follow_count,
         movie_watch_count = excluded.movie_watch_count,
         total_movies_runtime_seconds = excluded.total_movies_runtime_seconds,
         episode_watch_count = excluded.episode_watch_count,
         imported_at = excluded.imported_at`,
      sourceTimestamp(repairData.stats.sourceUpdatedAt),
      repairData.stats.totalSeriesRuntimeSeconds,
      repairData.stats.seriesFollowCount,
      repairData.stats.movieWatchCount,
      repairData.stats.totalMoviesRuntimeSeconds,
      repairData.stats.episodeWatchCount,
      nowIso(),
    );

    await database.runAsync(
      `INSERT INTO app_imports (import_key, imported_at, summary_json)
       VALUES (?, ?, ?)`,
      IMPORT_KEY,
      nowIso(),
      JSON.stringify(summary),
    );

    await database.execAsync('COMMIT;');
    console.log('TV Time repair v2 complete', summary);
  } catch (error) {
    await database.execAsync('ROLLBACK;');
    throw error;
  }
}
