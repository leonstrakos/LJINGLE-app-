export type ContinueKind =
  | 'BOOK'
  | 'MOVIE'
  | 'SERIES'
  | 'GAME'
  | 'ACTIVITY';

export type ContinueInput = {
  id: string;
  kind: ContinueKind;

  title: string;

  active: boolean;

  favourite?: boolean | null;

  lastInteractionAt?: string | null;
  startedAt?: string | null;

  progressPercent?: number | null;

  currentPage?: number | null;
  totalPages?: number | null;

  seasonNumber?: number | null;
  episodeNumber?: number | null;
  episodeTitle?: string | null;

  playbackSeconds?: number | null;
  runtimeSeconds?: number | null;

  totalTrackedSeconds?: number | null;
  lastSessionSeconds?: number | null;
  sessionCount?: number | null;

  lastNote?: string | null;
};

export type ContinueItem = ContinueInput & {
  lastInteractionTimestamp: number | null;

  dormantDays: number | null;

  primaryState: string | null;
  secondaryState: string | null;

  continueScore: number;

  freshness:
    | 'TODAY'
    | 'RECENT'
    | 'AGING'
    | 'OLD'
    | 'UNKNOWN';
};

export type ContinueOptions = {
  now?: Date;
  staleAfterDays?: number;
  limit?: number;
  scoreBoosts?: Record<string, number>;
};

const DAY_MS =
  24 * 60 * 60 * 1000;

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.max(
    minimum,
    Math.min(maximum, value),
  );
}

function safeNumber(
  value: number | null | undefined,
) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(value);
}

function timestampOf(
  value: string | null | undefined,
) {
  if (!value) {
    return null;
  }

  const timestamp =
    new Date(value).getTime();

  return Number.isFinite(timestamp)
    ? timestamp
    : null;
}

function dormantDaysSince(
  timestamp: number | null,
  now: Date,
) {
  if (timestamp === null) {
    return null;
  }

  return Math.max(
    0,
    Math.floor(
      (
        now.getTime() -
        timestamp
      ) / DAY_MS,
    ),
  );
}

function formatDuration(
  rawSeconds: number | null | undefined,
) {
  const seconds =
    Math.max(
      0,
      Math.round(
        safeNumber(rawSeconds),
      ),
    );

  if (seconds <= 0) {
    return null;
  }

  const minutes =
    Math.round(
      seconds / 60,
    );

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours =
    Math.floor(
      minutes / 60,
    );

  const remaining =
    minutes % 60;

  if (remaining === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${remaining} min`;
}

function normalizeProgress(
  value: number | null | undefined,
) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.round(
    clamp(
      Number(value),
      0,
      100,
    ),
  );
}

function freshnessFor(
  dormantDays: number | null,
): ContinueItem['freshness'] {
  if (dormantDays === null) {
    return 'UNKNOWN';
  }

  if (dormantDays === 0) {
    return 'TODAY';
  }

  if (dormantDays <= 7) {
    return 'RECENT';
  }

  if (dormantDays <= 30) {
    return 'AGING';
  }

  return 'OLD';
}

function playbackState(
  item: ContinueInput,
) {
  const playback =
    Math.max(
      0,
      safeNumber(
        item.playbackSeconds,
      ),
    );

  const runtime =
    Math.max(
      0,
      safeNumber(
        item.runtimeSeconds,
      ),
    );

  if (
    playback <= 0 ||
    runtime <= 0
  ) {
    return null;
  }

  const progress =
    Math.round(
      clamp(
        (
          playback /
          runtime
        ) * 100,
        0,
        100,
      ),
    );

  const elapsed =
    formatDuration(
      playback,
    );

  if (!elapsed) {
    return `${progress}%`;
  }

  return (
    `${elapsed} · ` +
    `${progress}%`
  );
}

function bookState(
  item: ContinueInput,
) {
  const page =
    Math.max(
      0,
      Math.round(
        safeNumber(
          item.currentPage,
        ),
      ),
    );

  const totalPages =
    Math.max(
      0,
      Math.round(
        safeNumber(
          item.totalPages,
        ),
      ),
    );

  const explicitProgress =
    normalizeProgress(
      item.progressPercent,
    );

  const calculatedProgress =
    page > 0 &&
    totalPages > 0
      ? Math.round(
          clamp(
            (
              page /
              totalPages
            ) * 100,
            0,
            100,
          ),
        )
      : null;

  const progress =
    explicitProgress ??
    calculatedProgress;

  if (
    page > 0 &&
    progress !== null
  ) {
    return {
      primary:
        `Str. ${page} · ${progress}%`,

      secondary:
        item.lastSessionSeconds
          ? `Zadnje čitanje ${formatDuration(
              item.lastSessionSeconds,
            )}`
          : null,
    };
  }

  if (page > 0) {
    return {
      primary:
        `Str. ${page}`,

      secondary: null,
    };
  }

  if (progress !== null) {
    return {
      primary:
        `${progress}%`,

      secondary: null,
    };
  }

  return {
    primary:
      'Nastavi čitati',

    secondary: null,
  };
}

function seriesState(
  item: ContinueInput,
) {
  const season =
    Math.max(
      0,
      Math.round(
        safeNumber(
          item.seasonNumber,
        ),
      ),
    );

  const episode =
    Math.max(
      0,
      Math.round(
        safeNumber(
          item.episodeNumber,
        ),
      ),
    );

  const code =
    season > 0 &&
    episode > 0
      ? `S${String(
          season,
        ).padStart(2, '0')}E${String(
          episode,
        ).padStart(2, '0')}`
      : null;

  const episodeTitle =
    item.episodeTitle?.trim() ||
    null;

  if (code) {
    return {
      primary:
        episodeTitle
          ? `${code} · ${episodeTitle}`
          : code,

      secondary:
        playbackState(
          item,
        ),
    };
  }

  return {
    primary:
      'Nastavi gledati',

    secondary:
      playbackState(
        item,
      ),
  };
}

function movieState(
  item: ContinueInput,
) {
  const playback =
    playbackState(item);

  if (playback) {
    return {
      primary:
        playback,

      secondary:
        'Nastavi film',
    };
  }

  const progress =
    normalizeProgress(
      item.progressPercent,
    );

  if (progress !== null) {
    return {
      primary:
        `${progress}%`,

      secondary:
        'Nastavi film',
    };
  }

  return {
    primary:
      'Nastavi gledati',

    secondary: null,
  };
}

function gameState(
  item: ContinueInput,
) {
  const total =
    formatDuration(
      item.totalTrackedSeconds,
    );

  const last =
    formatDuration(
      item.lastSessionSeconds,
    );

  const progress =
    normalizeProgress(
      item.progressPercent,
    );

  if (progress !== null) {
    return {
      primary:
        `${progress}% dovršeno`,

      secondary:
        last
          ? `Zadnja sesija ${last}`
          : total
            ? `${total} ukupno`
            : null,
    };
  }

  if (total) {
    return {
      primary:
        `${total} ukupno`,

      secondary:
        last
          ? `Zadnja sesija ${last}`
          : null,
    };
  }

  return {
    primary:
      'Nastavi igrati',

    secondary:
      last
        ? `Zadnja sesija ${last}`
        : null,
  };
}

function genericState(
  item: ContinueInput,
) {
  const last =
    formatDuration(
      item.lastSessionSeconds,
    );

  const total =
    formatDuration(
      item.totalTrackedSeconds,
    );

  return {
    primary:
      last
        ? `Zadnje ${last}`
        : 'Nastavi',

    secondary:
      total
        ? `${total} ukupno`
        : null,
  };
}

function stateFor(
  item: ContinueInput,
) {
  switch (item.kind) {
    case 'BOOK':
      return bookState(item);

    case 'SERIES':
      return seriesState(item);

    case 'MOVIE':
      return movieState(item);

    case 'GAME':
      return gameState(item);

    case 'ACTIVITY':
    default:
      return genericState(item);
  }
}

function recencyScore(
  dormantDays: number | null,
  staleAfterDays: number,
) {
  if (dormantDays === null) {
    return 8;
  }

  if (dormantDays === 0) {
    return 45;
  }

  if (dormantDays <= 3) {
    return 40;
  }

  if (dormantDays <= 7) {
    return 34;
  }

  if (dormantDays <= 14) {
    return 26;
  }

  if (dormantDays <= 30) {
    return 18;
  }

  if (
    dormantDays <=
    staleAfterDays
  ) {
    return 10;
  }

  const overdue =
    dormantDays -
    staleAfterDays;

  return Math.max(
    0,
    8 -
      overdue / 20,
  );
}

function engagementScore(
  item: ContinueInput,
) {
  const sessions =
    Math.max(
      0,
      safeNumber(
        item.sessionCount,
      ),
    );

  const totalSeconds =
    Math.max(
      0,
      safeNumber(
        item.totalTrackedSeconds,
      ),
    );

  const progress =
    normalizeProgress(
      item.progressPercent,
    );

  const sessionScore =
    clamp(
      Math.log2(
        1 + sessions,
      ) * 4,
      0,
      14,
    );

  const timeScore =
    clamp(
      Math.log2(
        1 +
        totalSeconds /
          1800,
      ) * 3,
      0,
      14,
    );

  const progressScore =
    progress === null
      ? 0
      : clamp(
          progress / 8,
          0,
          12,
        );

  const jingleScore =
    item.favourite
      ? 8
      : 0;

  return (
    sessionScore +
    timeScore +
    progressScore +
    jingleScore
  );
}

/**
 * continueIntelligenceV1
 *
 * Pure domain logic.
 *
 * No SQLite.
 * No API.
 * No React.
 *
 * Runtime SQLite ownership remains exclusively
 * in storage/databaseConnection.ts.
 */
export function buildContinueItems(
  input: ContinueInput[],
  options: ContinueOptions = {},
): ContinueItem[] {
  const now =
    options.now ??
    new Date();

  const staleAfterDays =
    Math.max(
      7,
      options.staleAfterDays ??
        60,
    );

  const limit =
    Math.max(
      1,
      options.limit ??
        12,
    );

  const scoreBoosts =
    options.scoreBoosts ??
    {};

  const result:
    ContinueItem[] = [];

  for (const item of input) {
    if (!item.active) {
      continue;
    }

    if (!item.title.trim()) {
      continue;
    }

    const lastTimestamp =
      timestampOf(
        item.lastInteractionAt,
      ) ??
      timestampOf(
        item.startedAt,
      );

    const dormantDays =
      dormantDaysSince(
        lastTimestamp,
        now,
      );

    const state =
      stateFor(item);

    const baseScore =
      recencyScore(
        dormantDays,
        staleAfterDays,
      ) +
      engagementScore(item);

    const manualBoost =
      safeNumber(
        scoreBoosts[item.id],
      );

    result.push({
      ...item,

      lastInteractionTimestamp:
        lastTimestamp,

      dormantDays,

      primaryState:
        state.primary,

      secondaryState:
        item.lastNote?.trim()
          ? item.lastNote.trim()
          : state.secondary,

      continueScore:
        Math.round(
          clamp(
            baseScore +
            manualBoost,
            0,
            100,
          ) * 10,
        ) / 10,

      freshness:
        freshnessFor(
          dormantDays,
        ),
    });
  }

  return result
    .sort(
      (a, b) => {
        if (
          b.continueScore !==
          a.continueScore
        ) {
          return (
            b.continueScore -
            a.continueScore
          );
        }

        const aTime =
          a.lastInteractionTimestamp ??
          0;

        const bTime =
          b.lastInteractionTimestamp ??
          0;

        return bTime - aTime;
      },
    )
    .slice(
      0,
      limit,
    );
}

export function pickContinueItem(
  items: ContinueItem[],
  random: () => number =
    Math.random,
) {
  if (items.length === 0) {
    return null;
  }

  const pool =
    items.slice(
      0,
      Math.min(
        6,
        items.length,
      ),
    );

  const weights =
    pool.map(
      (item) =>
        Math.max(
          1,
          item.continueScore,
        ),
    );

  const total =
    weights.reduce(
      (sum, weight) =>
        sum + weight,
      0,
    );

  let cursor =
    random() * total;

  for (
    let index = 0;
    index < pool.length;
    index++
  ) {
    cursor -=
      weights[index] ?? 0;

    if (cursor <= 0) {
      return (
        pool[index] ??
        null
      );
    }
  }

  return (
    pool[
      pool.length - 1
    ] ?? null
  );
}

export function describeContinueRecency(
  item: ContinueItem,
) {
  const days =
    item.dormantDays;

  if (days === null) {
    return null;
  }

  if (days === 0) {
    return 'Danas';
  }

  if (days === 1) {
    return 'Jučer';
  }

  if (days < 7) {
    return (
      `Prije ${days} dana`
    );
  }

  if (days < 14) {
    return 'Prije tjedan dana';
  }

  if (days < 30) {
    const weeks =
      Math.max(
        2,
        Math.round(
          days / 7,
        ),
      );

    return (
      `Prije ${weeks} tjedna`
    );
  }

  if (days < 365) {
    const months =
      Math.max(
        1,
        Math.round(
          days / 30.44,
        ),
      );

    return (
      `Prije ${months} mj.`
    );
  }

  const years =
    Math.max(
      1,
      Math.round(
        days / 365.25,
      ),
    );

  return (
    `Prije ${years} god.`
  );
}
