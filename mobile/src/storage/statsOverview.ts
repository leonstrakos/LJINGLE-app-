import { getDatabase } from './database';

export type StatsTopItem = {
  id: string;
  title: string;
  count: number;
  seconds: number;
};

export type StatsOverview = {
  tvTime: {
    available: boolean;
    sourceUpdatedAt: string | null;
    totalSeriesRuntimeSeconds: number;
    seriesFollowCount: number;
    movieWatchCount: number;
    totalMoviesRuntimeSeconds: number;
    episodeWatchCount: number;
  };
  app: {
    trackedSeconds: number;
    sessionCount: number;
    activeSessionCount: number;
  };
  library: {
    books: number;
    media: number;
    movies: number;
    series: number;
    games: number;
    entries: number;
  };
  topSeries: StatsTopItem[];
  topMovies: StatsTopItem[];
};

type CountRow = { count: number | null };
type SnapshotRow = {
  source_updated_at: string | null;
  total_series_runtime_seconds: number;
  series_follow_count: number;
  movie_watch_count: number;
  total_movies_runtime_seconds: number;
  episode_watch_count: number;
};
type SessionRow = {
  tracked_seconds: number | null;
  session_count: number | null;
  active_count: number | null;
};
type MediaCountRow = {
  media_count: number | null;
  movie_count: number | null;
  series_count: number | null;
  completed_movie_count: number | null;
};
type TopRow = {
  id: string;
  title: string;
  item_count: number | null;
  seconds: number | null;
};

async function tableExists(name: string) {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
    name,
  );
  return Boolean(row?.name);
}

function n(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export async function loadStatsOverview(): Promise<StatsOverview> {
  const database = await getDatabase();

  const [
    hasFlags,
    hasSnapshot,
    hasTvRuntime,
    hasEpisodes,
  ] = await Promise.all([
    tableExists('external_media_flags'),
    tableExists('tvtime_stats_snapshot'),
    tableExists('tvtime_media_runtime'),
    tableExists('series_episodes'),
  ]);

  const visibleMediaWhere = hasFlags
    ? `WHERE NOT EXISTS (
         SELECT 1
           FROM external_media_flags f
          WHERE f.media_id = m.media_id
            AND f.source = 'TV_TIME'
            AND f.flag = 'NEBITNO'
       )`
    : '';

  const [bookRow, gameRow, entryRow, mediaRow, sessionRow] = await Promise.all([
    database.getFirstAsync<CountRow>('SELECT COUNT(*) AS count FROM books'),
    database.getFirstAsync<CountRow>('SELECT COUNT(*) AS count FROM games'),
    database.getFirstAsync<CountRow>('SELECT COUNT(*) AS count FROM entries'),
    database.getFirstAsync<MediaCountRow>(
      `SELECT
         COUNT(*) AS media_count,
         SUM(CASE WHEN m.media_type = 'MOVIE' THEN 1 ELSE 0 END) AS movie_count,
         SUM(CASE WHEN m.media_type = 'SERIES' THEN 1 ELSE 0 END) AS series_count,
         /* canonicalCompletedMovieCountV1 */
         SUM(CASE
               WHEN m.media_type = 'MOVIE'
                AND m.watch_status = 'COMPLETED'
               THEN 1 ELSE 0
             END) AS completed_movie_count
       FROM media_items m
       ${visibleMediaWhere}`,
    ),
    database.getFirstAsync<SessionRow>(
      `SELECT
         COALESCE(SUM(
           MAX(
             0,
             CAST(strftime('%s', COALESCE(ended_at, CURRENT_TIMESTAMP)) AS INTEGER)
             - CAST(strftime('%s', started_at) AS INTEGER)
           )
         ), 0) AS tracked_seconds,
         COUNT(*) AS session_count,
         SUM(CASE WHEN ended_at IS NULL THEN 1 ELSE 0 END) AS active_count
       FROM time_sessions`,
    ),
  ]);

  let snapshot: SnapshotRow | null = null;
  if (hasSnapshot) {
    snapshot = await database.getFirstAsync<SnapshotRow>(
      `SELECT
         source_updated_at,
         total_series_runtime_seconds,
         series_follow_count,
         movie_watch_count,
         total_movies_runtime_seconds,
         episode_watch_count
       FROM tvtime_stats_snapshot
       WHERE snapshot_key = 'TV_TIME_EXPORT'
       LIMIT 1`,
    );
  }

  let topSeries: StatsTopItem[] = [];
  if (hasEpisodes) {
    const ignoreJoin = hasFlags
      ? `AND NOT EXISTS (
           SELECT 1 FROM external_media_flags f
            WHERE f.media_id = m.media_id
              AND f.source = 'TV_TIME'
              AND f.flag = 'NEBITNO'
         )`
      : '';

    const rows = await database.getAllAsync<TopRow>(
      `SELECT
         m.media_id AS id,
         m.title AS title,
         COUNT(*) AS item_count,
         COALESCE(SUM(COALESCE(se.runtime_minutes, 0) * 60), 0) AS seconds
       FROM series_episodes se
       JOIN media_items m ON m.media_id = se.media_id
       WHERE se.watched = 1
         ${ignoreJoin}
       GROUP BY m.media_id, m.title
       ORDER BY seconds DESC, item_count DESC, m.title COLLATE NOCASE
       LIMIT 6`,
    );

    topSeries = rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      count: n(row.item_count),
      seconds: n(row.seconds),
    }));
  }

  let topMovies: StatsTopItem[] = [];
  if (hasTvRuntime) {
    const ignoreJoin = hasFlags
      ? `AND NOT EXISTS (
           SELECT 1 FROM external_media_flags f
            WHERE f.media_id = m.media_id
              AND f.source = 'TV_TIME'
              AND f.flag = 'NEBITNO'
         )`
      : '';

    const rows = await database.getAllAsync<TopRow>(
      `SELECT
         m.media_id AS id,
         m.title AS title,
         (1 + COALESCE(r.rewatch_count, 0)) AS item_count,
         COALESCE(r.runtime_seconds, 0) * (1 + COALESCE(r.rewatch_count, 0)) AS seconds
       FROM tvtime_media_runtime r
       JOIN media_items m ON m.media_id = r.media_id
       WHERE r.watched_at IS NOT NULL
         AND COALESCE(r.runtime_seconds, 0) > 0
         ${ignoreJoin}
       ORDER BY seconds DESC, m.title COLLATE NOCASE
       LIMIT 6`,
    );

    topMovies = rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      count: n(row.item_count),
      seconds: n(row.seconds),
    }));
  }

  return {
    tvTime: {
      available: Boolean(snapshot),
      sourceUpdatedAt: snapshot?.source_updated_at ?? null,
      totalSeriesRuntimeSeconds: n(snapshot?.total_series_runtime_seconds),
      seriesFollowCount: n(snapshot?.series_follow_count),
      movieWatchCount: n(mediaRow?.completed_movie_count),
      totalMoviesRuntimeSeconds: n(snapshot?.total_movies_runtime_seconds),
      episodeWatchCount: n(snapshot?.episode_watch_count),
    },
    app: {
      trackedSeconds: n(sessionRow?.tracked_seconds),
      sessionCount: n(sessionRow?.session_count),
      activeSessionCount: n(sessionRow?.active_count),
    },
    library: {
      books: n(bookRow?.count),
      media: n(mediaRow?.media_count),
      movies: n(mediaRow?.movie_count),
      series: n(mediaRow?.series_count),
      games: n(gameRow?.count),
      entries: n(entryRow?.count),
    },
    topSeries,
    topMovies,
  };
}
