import { getDatabase } from './database';

// temporalStatsStorageV1
// IMPORTANT: this module never opens SQLite.
// It only uses the canonical getDatabase() connection.

export type TemporalCategory = {
  key: string;
  label: string;
  seconds: number;
  share: number;
};

export type TemporalPeriod = {
  totalSeconds: number;
  categories: TemporalCategory[];
  definingItems: Array<{
    title: string;
    seconds: number;
  }>;
};

export type TemporalMover = {
  key: string;
  label: string;
  previousShare: number;
  currentShare: number;
  deltaPoints: number;
};

export type TemporalStatsComparison = {
  days: number;
  previous: TemporalPeriod;
  current: TemporalPeriod;
  mover: TemporalMover | null;
  generatedAt: string;
};

type TemporalRow = {
  started_at: string;
  ended_at: string | null;
  label: string;
  activity_type: string;
  media_type: string | null;
  book_title: string | null;
  media_title: string | null;
  game_title: string | null;
};

type Bucket = {
  seconds: number;
  items: Map<string, number>;
};

const categoryLabels: Record<string, string> = {
  READING: 'Čitanje',
  MOVIE: 'Filmovi',
  SERIES: 'Serije',
  PLAYING: 'Igre',
  STUDYING: 'Učenje',
  RESEARCH: 'Istraživanje',
  WORK: 'Rad',
  EXERCISE: 'Vježbanje',
  CUSTOM: 'Ostalo',
  OTHER: 'Ostalo',
};

function categoryFor(
  row: TemporalRow
) {
  const type =
    String(row.activity_type || 'OTHER')
      .toUpperCase();

  if (type === 'WATCHING') {
    const mediaType =
      String(row.media_type || '')
        .toUpperCase();

    if (mediaType === 'MOVIE') {
      return 'MOVIE';
    }

    if (mediaType === 'SERIES') {
      return 'SERIES';
    }

    return 'WATCHING';
  }

  return type;
}

function categoryLabel(
  key: string
) {
  if (key === 'WATCHING') {
    return 'Gledanje';
  }

  return (
    categoryLabels[key] ??
    key
      .toLowerCase()
      .replace(
        /(^|_)([a-z])/g,
        (_, prefix, letter) =>
          `${prefix ? ' ' : ''}${letter.toUpperCase()}`
      )
  );
}

function titleFor(
  row: TemporalRow
) {
  const category =
    categoryFor(row);

  if (category === 'READING') {
    return row.book_title ?? row.label;
  }

  if (
    category === 'MOVIE' ||
    category === 'SERIES' ||
    category === 'WATCHING'
  ) {
    return row.media_title ?? row.label;
  }

  if (category === 'PLAYING') {
    return row.game_title ?? row.label;
  }

  return row.label;
}

function overlapSeconds(
  startedAt: string,
  endedAt: string | null,
  windowStart: number,
  windowEnd: number,
  now: number
) {
  const start =
    Date.parse(startedAt);

  const rawEnd =
    endedAt
      ? Date.parse(endedAt)
      : now;

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(rawEnd)
  ) {
    return 0;
  }

  const from =
    Math.max(
      start,
      windowStart
    );

  const to =
    Math.min(
      rawEnd,
      windowEnd
    );

  return Math.max(
    0,
    Math.floor(
      (to - from) / 1000
    )
  );
}

function buildPeriod(
  rows: TemporalRow[],
  start: number,
  end: number,
  now: number
): TemporalPeriod {
  const categories =
    new Map<string, Bucket>();

  const allItems =
    new Map<string, number>();

  for (const row of rows) {
    const seconds =
      overlapSeconds(
        row.started_at,
        row.ended_at,
        start,
        end,
        now
      );

    if (seconds <= 0) {
      continue;
    }

    const key =
      categoryFor(row);

    const title =
      titleFor(row).trim();

    let bucket =
      categories.get(key);

    if (!bucket) {
      bucket = {
        seconds: 0,
        items: new Map(),
      };

      categories.set(
        key,
        bucket
      );
    }

    bucket.seconds += seconds;

    if (title) {
      bucket.items.set(
        title,
        (bucket.items.get(title) ?? 0) +
          seconds
      );

      allItems.set(
        title,
        (allItems.get(title) ?? 0) +
          seconds
      );
    }
  }

  const totalSeconds =
    Array.from(
      categories.values()
    ).reduce(
      (sum, bucket) =>
        sum + bucket.seconds,
      0
    );

  const categoryResults =
    Array.from(
      categories.entries()
    )
      .map(
        ([key, bucket]) => ({
          key,
          label: categoryLabel(key),
          seconds: bucket.seconds,
          share:
            totalSeconds > 0
              ? Math.round(
                  (
                    bucket.seconds /
                    totalSeconds
                  ) *
                    100
                )
              : 0,
        })
      )
      .sort(
        (left, right) =>
          right.seconds -
          left.seconds
      );

  const definingItems =
    Array.from(
      allItems.entries()
    )
      .map(
        ([title, seconds]) => ({
          title,
          seconds,
        })
      )
      .sort(
        (left, right) =>
          right.seconds -
          left.seconds
      )
      .slice(0, 4);

  return {
    totalSeconds,
    categories: categoryResults,
    definingItems,
  };
}

function findMover(
  previous: TemporalPeriod,
  current: TemporalPeriod
): TemporalMover | null {
  if (
    previous.totalSeconds <= 0 ||
    current.totalSeconds <= 0
  ) {
    return null;
  }

  const previousMap =
    new Map(
      previous.categories.map(
        (item) => [
          item.key,
          item.share,
        ]
      )
    );

  const currentMap =
    new Map(
      current.categories.map(
        (item) => [
          item.key,
          item.share,
        ]
      )
    );

  const keys =
    new Set([
      ...previousMap.keys(),
      ...currentMap.keys(),
    ]);

  let winner:
    TemporalMover | null = null;

  for (const key of keys) {
    const previousShare =
      previousMap.get(key) ?? 0;

    const currentShare =
      currentMap.get(key) ?? 0;

    const deltaPoints =
      currentShare -
      previousShare;

    const candidate: TemporalMover = {
      key,
      label: categoryLabel(key),
      previousShare,
      currentShare,
      deltaPoints,
    };

    if (
      !winner ||
      Math.abs(deltaPoints) >
        Math.abs(
          winner.deltaPoints
        )
    ) {
      winner = candidate;
    }
  }

  return winner;
}

export async function loadTemporalStats(
  days = 30
): Promise<TemporalStatsComparison> {
  const safeDays =
    Math.max(
      7,
      Math.min(
        365,
        Math.floor(days)
      )
    );

  const database =
    await getDatabase();

  const now =
    Date.now();

  const dayMs =
    24 * 60 * 60 * 1000;

  const currentEnd =
    now;

  const currentStart =
    currentEnd -
    safeDays * dayMs;

  const previousEnd =
    currentStart;

  const previousStart =
    previousEnd -
    safeDays * dayMs;

  const rows =
    await database.getAllAsync<TemporalRow>(
      `
        SELECT
          s.started_at,
          s.ended_at,
          a.label,
          a.activity_type,
          m.media_type,
          b.title AS book_title,
          m.title AS media_title,
          g.title AS game_title
        FROM time_sessions s
        JOIN activities a
          ON a.activity_id = s.activity_id
        LEFT JOIN books b
          ON b.book_id = a.book_id
        LEFT JOIN media_items m
          ON m.media_id = a.media_id
        LEFT JOIN games g
          ON g.playing_activity_id = a.activity_id
        WHERE s.started_at < ?
          AND COALESCE(
            s.ended_at,
            ?
          ) > ?
        ORDER BY s.started_at ASC
      `,
      new Date(currentEnd)
        .toISOString(),
      new Date(now)
        .toISOString(),
      new Date(previousStart)
        .toISOString()
    );

  const previous =
    buildPeriod(
      rows,
      previousStart,
      previousEnd,
      now
    );

  const current =
    buildPeriod(
      rows,
      currentStart,
      currentEnd,
      now
    );

  return {
    days: safeDays,
    previous,
    current,
    mover:
      findMover(
        previous,
        current
      ),
    generatedAt:
      new Date(now)
        .toISOString(),
  };
}
