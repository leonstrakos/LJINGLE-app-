import { getDatabase } from './database';
import type { ReadingStatus } from '../types/book';

// forkEBookStatsUnifiedV1
// forkNProfileNetTrackingV1
// statsClosedItemsV1
// statsGamesQuitNeutralDroppedNegativeV1

export type StatsTopItem = {
  id: string;
  title: string;
  count: number;
  seconds: number;
};

export type StatsBookRangeItem = {
  id: string;
  title: string;
  author: string;
  publishedYear: number;
};

export type StatsBookOverview = {
  total: number;
  favourites: number;
  averageProgress: number;
  averageYear: number;
  statusCounts: Record<ReadingStatus, number>;
  oldest: StatsBookRangeItem | null;
  newest: StatsBookRangeItem | null;
};

export type StatsNetPeriodKey =
  | 'DAYS_7'
  | 'DAYS_30'
  | 'YEAR'
  | 'ALL';

export type StatsNetChange = {
  added: number;
  finished: number;
  net: number;
};

export type StatsNetPeriod = StatsNetChange & {
  books: StatsNetChange;
  media: StatsNetChange;
  games: StatsNetChange;
};

export type StatsNetTracking = Record<
  StatsNetPeriodKey,
  StatsNetPeriod
>;

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
  books: StatsBookOverview;
  netTracking: StatsNetTracking;
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

type BookStatsRow = {
  total: number | null;
  favourites: number | null;
  average_progress: number | null;
  average_year: number | null;
  later_count: number | null;
  in_progress_count: number | null;
  completed_count: number | null;
  paused_count: number | null;
  dropped_count: number | null;
};

type BookRangeRow = {
  id: string;
  title: string;
  author: string;
  published_year: number;
};

type NetTrackingRow = {
  books_added: number | null;
  books_finished: number | null;
  media_added: number | null;
  media_finished: number | null;
  games_added: number | null;
  games_finished: number | null;
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

function netChange(
  addedValue: number | null | undefined,
  finishedValue: number | null | undefined,
): StatsNetChange {
  const added = n(addedValue);
  const finished = n(finishedValue);

  return {
    added,
    finished,
    net: added - finished,
  };
}

function mapNetPeriod(
  row: NetTrackingRow | null,
): StatsNetPeriod {
  const books = netChange(
    row?.books_added,
    row?.books_finished,
  );
  const media = netChange(
    row?.media_added,
    row?.media_finished,
  );
  const games = netChange(
    row?.games_added,
    row?.games_finished,
  );

  const added =
    books.added + media.added + games.added;
  const finished =
    books.finished + media.finished + games.finished;

  return {
    added,
    finished,
    net: added - finished,
    books,
    media,
    games,
  };
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

  // Neto uses "closed" semantics rather than only literal COMPLETED.
  // NEBITNO closes Film/TV; DROPPED and DNF close games; QUIT is neutral.
  const ignoredMediaFinishedClause = hasFlags
    ? `OR (
           m.watch_status <> 'COMPLETED'
           AND EXISTS (
             SELECT 1
               FROM external_media_flags f
              WHERE f.media_id = m.media_id
                AND f.flag = 'NEBITNO'
                AND (
                  p.since IS NULL
                  OR julianday(COALESCE(f.flagged_at, f.modified_at, f.created_at)) >= julianday(p.since)
                )
           )
         )`
    : '';

  // Games Neto semantics: QUIT is completely neutral. DROPPED/Odustao
  // is a real close event and therefore belongs on the negative side.
  // Legacy DNF remains closed unless the current status is explicitly QUIT.
  const gameColumns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(games)');
  const hasGameDnf = gameColumns.some((column) => column.name === 'dnf');
  const closedGamePredicate = hasGameDnf
    ? `(g.game_status <> 'QUIT' AND (g.game_status IN ('COMPLETED', 'DROPPED') OR COALESCE(g.dnf, 0) = 1))`
    : `g.game_status IN ('COMPLETED', 'DROPPED')`;

  const loadNetPeriod = (since: string | null) =>
    database.getFirstAsync<NetTrackingRow>(
      `WITH params(since) AS (VALUES (?))
       SELECT
         (SELECT COUNT(*)
            FROM books b, params p
           WHERE p.since IS NULL
              OR julianday(b.created_at) >= julianday(p.since)
         ) AS books_added,
         (SELECT COUNT(*)
            FROM books b, params p
           WHERE b.reading_status = 'COMPLETED'
             AND b.finished_on IS NOT NULL
             AND (
               p.since IS NULL
               OR julianday(b.finished_on) >= julianday(p.since)
             )
         ) AS books_finished,
         (SELECT COUNT(*)
            FROM media_items m, params p
           WHERE p.since IS NULL
              OR julianday(m.created_at) >= julianday(p.since)
         ) AS media_added,
         (SELECT COUNT(*)
            FROM media_items m, params p
           WHERE (
             (
               m.watch_status = 'COMPLETED'
               AND (
                 p.since IS NULL
                 OR julianday(COALESCE(m.completed_on, m.modified_at, m.created_at)) >= julianday(p.since)
               )
             )
             ${ignoredMediaFinishedClause}
           )
         ) AS media_finished,
         (SELECT COUNT(*)
            FROM games g, params p
           WHERE g.game_status <> 'QUIT'
             AND (
               p.since IS NULL
               OR julianday(g.created_at) >= julianday(p.since)
             )
         ) AS games_added,
         (SELECT COUNT(*)
            FROM games g, params p
           WHERE ${closedGamePredicate}
             AND (
               p.since IS NULL
               OR julianday(COALESCE(g.finished_on, g.modified_at, g.created_at)) >= julianday(p.since)
             )
         ) AS games_finished`,
      since,
    );

  const [bookRow, gameRow, entryRow, mediaRow, sessionRow, bookStatsRow] = await Promise.all([
    database.getFirstAsync<CountRow>('SELECT COUNT(*) AS count FROM books'),
    database.getFirstAsync<CountRow>("SELECT COUNT(*) AS count FROM games WHERE game_status <> 'QUIT'"),
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
    database.getFirstAsync<BookStatsRow>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN favourite = 1 THEN 1 ELSE 0 END) AS favourites,
         ROUND(AVG(progress)) AS average_progress,
         ROUND(AVG(published_year)) AS average_year,
         SUM(CASE WHEN reading_status = 'LATER' THEN 1 ELSE 0 END) AS later_count,
         SUM(CASE WHEN reading_status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS in_progress_count,
         SUM(CASE WHEN reading_status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_count,
         SUM(CASE WHEN reading_status = 'PAUSED' THEN 1 ELSE 0 END) AS paused_count,
         SUM(CASE WHEN reading_status = 'DROPPED' THEN 1 ELSE 0 END) AS dropped_count
       FROM books`,
    ),
  ]);

  const [oldestBookRow, newestBookRow] = await Promise.all([
    database.getFirstAsync<BookRangeRow>(
      `SELECT
         book_id AS id,
         title,
         author,
         published_year
       FROM books
       ORDER BY published_year ASC, title COLLATE NOCASE ASC
       LIMIT 1`,
    ),
    database.getFirstAsync<BookRangeRow>(
      `SELECT
         book_id AS id,
         title,
         author,
         published_year
       FROM books
       ORDER BY published_year DESC, title COLLATE NOCASE ASC
       LIMIT 1`,
    ),
  ]);

  const mapBookRange = (row: BookRangeRow | null): StatsBookRangeItem | null =>
    row
      ? {
          id: String(row.id),
          title: String(row.title),
          author: String(row.author),
          publishedYear: n(row.published_year),
        }
      : null;

  const periodNow = new Date();
  const sevenDaysAgo = new Date(
    periodNow.getTime() - 7 * 24 * 60 * 60 * 1000,
  );
  const thirtyDaysAgo = new Date(
    periodNow.getTime() - 30 * 24 * 60 * 60 * 1000,
  );
  const yearStart = new Date(
    periodNow.getFullYear(),
    0,
    1,
  );

  const [
    net7Row,
    net30Row,
    netYearRow,
    netAllRow,
  ] = await Promise.all([
    loadNetPeriod(sevenDaysAgo.toISOString()),
    loadNetPeriod(thirtyDaysAgo.toISOString()),
    loadNetPeriod(yearStart.toISOString()),
    loadNetPeriod(null),
  ]);

  const netTracking: StatsNetTracking = {
    DAYS_7: mapNetPeriod(net7Row),
    DAYS_30: mapNetPeriod(net30Row),
    YEAR: mapNetPeriod(netYearRow),
    ALL: mapNetPeriod(netAllRow),
  };

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
    books: {
      total: n(bookStatsRow?.total),
      favourites: n(bookStatsRow?.favourites),
      averageProgress: n(bookStatsRow?.average_progress),
      averageYear: n(bookStatsRow?.average_year),
      statusCounts: {
        LATER: n(bookStatsRow?.later_count),
        IN_PROGRESS: n(bookStatsRow?.in_progress_count),
        COMPLETED: n(bookStatsRow?.completed_count),
        PAUSED: n(bookStatsRow?.paused_count),
        DROPPED: n(bookStatsRow?.dropped_count),
      },
      oldest: mapBookRange(oldestBookRow),
      newest: mapBookRange(newestBookRow),
    },
    netTracking,
    topSeries,
    topMovies,
  };
}
