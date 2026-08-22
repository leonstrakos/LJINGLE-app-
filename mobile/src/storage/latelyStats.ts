import { getDatabase } from './database';

export type LatelyPeriod = 30 | 90;

export type LatelyActivity = {
  activityType: string;
  seconds: number;
};

export type LatelyStats = {
  days: LatelyPeriod;

  trackedSeconds: number;
  previousTrackedSeconds: number;

  sessionCount: number;
  previousSessionCount: number;

  entriesCreated: number;
  previousEntriesCreated: number;

  completedBooks: number;
  completedMovies: number;
  completedSeries: number;
  completedGames: number;

  topActivity: {
    label: string;
    activityType: string;
    seconds: number;
  } | null;

  topTopic: {
    name: string;
    signals: number;
  } | null;

  activityBreakdown: LatelyActivity[];
};

type SessionRow = {
  session_id: string;
  activity_id: string;
  started_at: string;
  ended_at: string | null;
  label: string;
  activity_type: string;
  topic_id: string | null;
  topic_name: string | null;
};

type EntryRow = {
  created_at: string;
  topic_id: string | null;
  topic_name: string | null;
};

type CountRow = {
  count: number;
};

function safeTime(value: string | null) {
  if (!value) return NaN;
  return Date.parse(value);
}

function secondsInside(
  startedAt: string,
  endedAt: string | null,
  windowStart: number,
  windowEnd: number,
) {
  const started = safeTime(startedAt);
  const rawEnded = endedAt ? safeTime(endedAt) : Date.now();

  if (!Number.isFinite(started) || !Number.isFinite(rawEnded)) {
    return 0;
  }

  const from = Math.max(started, windowStart);
  const to = Math.min(rawEnded, windowEnd);

  return Math.max(
    0,
    Math.floor((to - from) / 1000),
  );
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function loadLatelyStats(
  days: LatelyPeriod,
): Promise<LatelyStats> {
  const database = await getDatabase();

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const currentStart = now - days * dayMs;
  const previousStart = now - days * 2 * dayMs;

  const currentStartIso = new Date(currentStart).toISOString();
  const previousStartIso = new Date(previousStart).toISOString();

  const sessions = await database.getAllAsync<SessionRow>(
    'SELECT ' +
      's.session_id, ' +
      's.activity_id, ' +
      's.started_at, ' +
      's.ended_at, ' +
      'a.label, ' +
      'a.activity_type, ' +
      'a.topic_id, ' +
      't.name AS topic_name ' +
    'FROM time_sessions s ' +
    'JOIN activities a ON a.activity_id = s.activity_id ' +
    'LEFT JOIN topics t ON t.topic_id = a.topic_id ' +
    'WHERE s.ended_at IS NULL OR s.ended_at >= ? ' +
    'ORDER BY s.started_at DESC',
    previousStartIso,
  );

  let trackedSeconds = 0;
  let previousTrackedSeconds = 0;
  let sessionCount = 0;
  let previousSessionCount = 0;

  const activityTotals = new Map<
    string,
    {
      label: string;
      activityType: string;
      seconds: number;
    }
  >();

  const typeTotals = new Map<string, number>();
  const topicSignals = new Map<
    string,
    {
      name: string;
      signals: number;
    }
  >();

  for (const session of sessions) {
    const currentSeconds = secondsInside(
      session.started_at,
      session.ended_at,
      currentStart,
      now,
    );

    const previousSeconds = secondsInside(
      session.started_at,
      session.ended_at,
      previousStart,
      currentStart,
    );

    if (currentSeconds > 0) {
      trackedSeconds += currentSeconds;
      sessionCount += 1;

      const current = activityTotals.get(session.activity_id);

      if (current) {
        current.seconds += currentSeconds;
      } else {
        activityTotals.set(session.activity_id, {
          label: session.label,
          activityType: session.activity_type,
          seconds: currentSeconds,
        });
      }

      typeTotals.set(
        session.activity_type,
        (typeTotals.get(session.activity_type) ?? 0) +
          currentSeconds,
      );

      if (session.topic_id && session.topic_name) {
        const topic = topicSignals.get(session.topic_id);

        if (topic) {
          topic.signals += 1;
        } else {
          topicSignals.set(session.topic_id, {
            name: session.topic_name,
            signals: 1,
          });
        }
      }
    }

    if (previousSeconds > 0) {
      previousTrackedSeconds += previousSeconds;
      previousSessionCount += 1;
    }
  }

  const entries = await database.getAllAsync<EntryRow>(
    'SELECT ' +
      'e.created_at, ' +
      'e.topic_id, ' +
      't.name AS topic_name ' +
    'FROM entries e ' +
    'LEFT JOIN topics t ON t.topic_id = e.topic_id ' +
    'WHERE e.created_at >= ?',
    previousStartIso,
  );

  let entriesCreated = 0;
  let previousEntriesCreated = 0;

  for (const entry of entries) {
    const createdAt = safeTime(entry.created_at);

    if (!Number.isFinite(createdAt)) continue;

    if (createdAt >= currentStart && createdAt <= now) {
      entriesCreated += 1;

      if (entry.topic_id && entry.topic_name) {
        const topic = topicSignals.get(entry.topic_id);

        if (topic) {
          topic.signals += 1;
        } else {
          topicSignals.set(entry.topic_id, {
            name: entry.topic_name,
            signals: 1,
          });
        }
      }
    } else if (
      createdAt >= previousStart &&
      createdAt < currentStart
    ) {
      previousEntriesCreated += 1;
    }
  }

  const [
    bookCount,
    movieCount,
    seriesCount,
    gameCount,
  ] = await Promise.all([
    database.getFirstAsync<CountRow>(
      "SELECT COUNT(*) AS count FROM books " +
      "WHERE finished_on IS NOT NULL " +
      "AND date(finished_on) >= date(?)",
      currentStartIso,
    ),

    database.getFirstAsync<CountRow>(
      "SELECT COUNT(*) AS count FROM media_items " +
      "WHERE media_type = 'MOVIE' " +
      "AND watch_status = 'COMPLETED' " +
      "AND completed_on IS NOT NULL " +
      "AND date(completed_on) >= date(?)",
      currentStartIso,
    ),

    database.getFirstAsync<CountRow>(
      "SELECT COUNT(*) AS count FROM media_items " +
      "WHERE media_type = 'SERIES' " +
      "AND watch_status = 'COMPLETED' " +
      "AND completed_on IS NOT NULL " +
      "AND date(completed_on) >= date(?)",
      currentStartIso,
    ),

    database.getFirstAsync<CountRow>(
      "SELECT COUNT(*) AS count FROM games " +
      "WHERE finished_on IS NOT NULL " +
      "AND date(finished_on) >= date(?)",
      currentStartIso,
    ),
  ]);

  const topActivity =
    Array.from(activityTotals.values())
      .sort((left, right) => right.seconds - left.seconds)[0] ??
    null;

  const topTopic =
    Array.from(topicSignals.values())
      .sort((left, right) => right.signals - left.signals)[0] ??
    null;

  const activityBreakdown = Array.from(typeTotals.entries())
    .map(([activityType, seconds]) => ({
      activityType,
      seconds,
    }))
    .sort((left, right) => right.seconds - left.seconds)
    .slice(0, 4);

  return {
    days,

    trackedSeconds,
    previousTrackedSeconds,

    sessionCount,
    previousSessionCount,

    entriesCreated,
    previousEntriesCreated,

    completedBooks: numberValue(bookCount?.count),
    completedMovies: numberValue(movieCount?.count),
    completedSeries: numberValue(seriesCount?.count),
    completedGames: numberValue(gameCount?.count),

    topActivity,
    topTopic,
    activityBreakdown,
  };
}
