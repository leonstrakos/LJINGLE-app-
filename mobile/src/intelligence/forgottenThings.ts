export type ForgottenEntityKind =
  | 'BOOK'
  | 'MOVIE'
  | 'SERIES'
  | 'GAME'
  | 'TOPIC'
  | 'ENTRY';

export type ForgottenThingInput = {
  id: string;
  kind: ForgottenEntityKind;
  title: string;

  createdAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  lastInteractionAt?: string | null;

  totalMinutes?: number | null;
  sessionCount?: number | null;
  progress?: number | null;

  favourite?: boolean | null;

  /**
   * Currently reading / watching / playing.
   * Active things should normally not be resurfaced
   * as "forgotten".
   */
  active?: boolean | null;
};

export type ForgottenThing = ForgottenThingInput & {
  dormantDays: number;

  /**
   * How much evidence we have that this thing once
   * mattered / occupied meaningful time.
   *
   * 0–50.
   */
  significanceScore: number;

  /**
   * Combination of significance + time forgotten.
   *
   * 0–100.
   */
  forgottenScore: number;

  reasons: string[];
};

export type ForgottenThingsOptions = {
  now?: Date;

  /**
   * Ignore things touched more recently than this.
   */
  minimumDormantDays?: number;

  /**
   * Normally active catalogue items should stay in
   * Continue rather than Forgotten.
   */
  includeActive?: boolean;

  limit?: number;
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

function numeric(
  value: number | null | undefined,
) {
  return Number.isFinite(value)
    ? Number(value)
    : 0;
}

function validDate(
  value: string | null | undefined,
) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function interactionAnchor(
  item: ForgottenThingInput,
) {
  return (
    validDate(item.lastInteractionAt) ??
    validDate(item.completedAt) ??
    validDate(item.startedAt) ??
    validDate(item.createdAt)
  );
}

function dormantDaysSince(
  date: Date,
  now: Date,
) {
  return Math.max(
    0,
    Math.floor(
      (now.getTime() - date.getTime()) /
        DAY_MS,
    ),
  );
}

function formatDormancy(days: number) {
  if (days < 60) {
    return `${days} dana`;
  }

  if (days < 365) {
    const months =
      Math.max(
        2,
        Math.round(days / 30.44),
      );

    return `${months} mj.`;
  }

  const years =
    days / 365.25;

  if (years < 2) {
    return 'oko godinu dana';
  }

  const rounded =
    Math.round(years * 10) / 10;

  return `${rounded} god.`;
}

function formatMinutes(minutes: number) {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }

  const hours =
    Math.round(
      (minutes / 60) * 10,
    ) / 10;

  return `${hours} h`;
}

function significanceFor(
  item: ForgottenThingInput,
) {
  const totalMinutes =
    Math.max(
      0,
      numeric(item.totalMinutes),
    );

  const sessions =
    Math.max(
      0,
      numeric(item.sessionCount),
    );

  const progress =
    clamp(
      numeric(item.progress),
      0,
      100,
    );

  // Time has diminishing returns:
  // 3 hours matters;
  // 300 hours matters more,
  // but not 100× more.
  const timeScore =
    clamp(
      Math.log2(
        1 +
        totalMinutes / 30,
      ) * 5.5,
      0,
      22,
    );

  const sessionScore =
    clamp(
      sessions * 2.1,
      0,
      14,
    );

  const progressScore =
    clamp(
      progress / 10,
      0,
      10,
    );

  const jingleScore =
    item.favourite
      ? 18
      : 0;

  return clamp(
    timeScore +
      sessionScore +
      progressScore +
      jingleScore,
    0,
    50,
  );
}

function dormancyScoreFor(
  dormantDays: number,
  minimumDormantDays: number,
) {
  if (
    dormantDays <
    minimumDormantDays
  ) {
    return 0;
  }

  /**
   * Crossing the minimum already means something,
   * but dormancy keeps becoming more interesting
   * for roughly the first two years.
   */
  const beyondMinimum =
    dormantDays -
    minimumDormantDays;

  return clamp(
    12 +
      (beyondMinimum / 730) * 38,
    12,
    50,
  );
}

function reasonsFor(
  item: ForgottenThingInput,
  dormantDays: number,
) {
  const reasons: string[] = [];

  reasons.push(
    `Bez aktivnosti ${formatDormancy(
      dormantDays,
    )}`,
  );

  if (item.favourite) {
    reasons.push('Jingle');
  }

  const minutes =
    numeric(item.totalMinutes);

  if (minutes >= 60) {
    reasons.push(
      `${formatMinutes(
        minutes,
      )} zabilježeno`,
    );
  }

  const sessions =
    Math.round(
      numeric(item.sessionCount),
    );

  if (sessions >= 2) {
    reasons.push(
      `${sessions} ${
        sessions === 1
          ? 'sesija'
          : 'sesija'
      }`,
    );
  }

  const progress =
    Math.round(
      clamp(
        numeric(item.progress),
        0,
        100,
      ),
    );

  if (
    progress >= 25 &&
    progress < 100
  ) {
    reasons.push(
      `${progress}% dovršeno`,
    );
  }

  if (progress >= 100) {
    reasons.push('Dovršeno');
  }

  return reasons;
}


/**
 * forgottenThingsV1
 *
 * Pure ranking engine.
 *
 * No SQLite.
 * No API.
 * No React.
 * No side effects.
 */
export function rankForgottenThings(
  items: ForgottenThingInput[],
  options: ForgottenThingsOptions = {},
): ForgottenThing[] {
  const now =
    options.now ??
    new Date();

  const minimumDormantDays =
    Math.max(
      1,
      options.minimumDormantDays ??
        60,
    );

  const includeActive =
    options.includeActive ??
    false;

  const limit =
    Math.max(
      1,
      options.limit ??
        30,
    );

  const ranked: ForgottenThing[] =
    [];

  for (const item of items) {
    if (
      item.active &&
      !includeActive
    ) {
      continue;
    }

    const anchor =
      interactionAnchor(item);

    if (!anchor) {
      continue;
    }

    const dormantDays =
      dormantDaysSince(
        anchor,
        now,
      );

    if (
      dormantDays <
      minimumDormantDays
    ) {
      continue;
    }

    const significanceScore =
      significanceFor(item);

    /**
     * Something being merely old does not
     * automatically make it meaningful.
     *
     * Jingles bypass this because choosing
     * Jingle is itself a significance signal.
     */
    if (
      significanceScore < 4 &&
      !item.favourite
    ) {
      continue;
    }

    const dormancyScore =
      dormancyScoreFor(
        dormantDays,
        minimumDormantDays,
      );

    const forgottenScore =
      clamp(
        Math.round(
          significanceScore +
            dormancyScore,
        ),
        0,
        100,
      );

    ranked.push({
      ...item,

      dormantDays,

      significanceScore:
        Math.round(
          significanceScore * 10,
        ) / 10,

      forgottenScore,

      reasons: reasonsFor(
        item,
        dormantDays,
      ),
    });
  }

  return ranked
    .sort((a, b) => {
      if (
        b.forgottenScore !==
        a.forgottenScore
      ) {
        return (
          b.forgottenScore -
          a.forgottenScore
        );
      }

      return (
        b.dormantDays -
        a.dormantDays
      );
    })
    .slice(0, limit);
}


/**
 * Useful later for Tamagotchi / Memory Radio.
 *
 * Instead of always returning the #1 item,
 * choose naturally from the strongest few
 * candidates.
 */
export function pickForgottenThing(
  ranked: ForgottenThing[],
  random: () => number =
    Math.random,
) {
  if (ranked.length === 0) {
    return null;
  }

  const pool =
    ranked.slice(
      0,
      Math.min(
        8,
        ranked.length,
      ),
    );

  const weights =
    pool.map((item) =>
      Math.max(
        1,
        item.forgottenScore,
      ),
    );

  const total =
    weights.reduce(
      (sum, value) =>
        sum + value,
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
      return pool[index] ?? null;
    }
  }

  return (
    pool[pool.length - 1] ??
    null
  );
}
