export type EraEntityKind =
  | 'BOOK'
  | 'MOVIE'
  | 'SERIES'
  | 'GAME'
  | 'ENTRY'
  | 'TOPIC'
  | 'ACTIVITY';

export type EraEventInput = {
  id: string;

  occurredAt: string;

  kind: EraEntityKind;

  /**
   * ID of book / movie / game / topic / etc.
   * Optional for generic activities.
   */
  entityId?: string | null;

  title?: string | null;

  /**
   * Timer/session duration when known.
   */
  durationSeconds?: number | null;

  favourite?: boolean | null;

  /**
   * Optional signal for events that should matter
   * more when identifying defining items.
   *
   * Examples:
   * completion, Jingle, major note, first session.
   *
   * Expected range: 0–1.
   */
  significance?: number | null;
};

export type EraEvent =
  EraEventInput & {
    timestamp: number;
    dayKey: string;
  };

export type EraDefiningItem = {
  entityId: string;
  kind: EraEntityKind;
  title: string;

  eventCount: number;
  totalSeconds: number;

  favourite: boolean;

  score: number;
};

export type EraKindBreakdown = {
  kind: EraEntityKind;

  eventCount: number;
  activeDays: number;
  totalSeconds: number;
};

export type Era = {
  id: string;

  startAt: string;
  endAt: string;

  startTimestamp: number;
  endTimestamp: number;

  spanDays: number;
  activeDays: number;

  eventCount: number;
  totalSeconds: number;

  /**
   * Automatically generated neutral name.
   * User can later override this elsewhere.
   *
   * Example:
   * Summer 2026
   * Late August 2026
   */
  suggestedName: string;

  dominantKinds: EraEntityKind[];

  breakdown: EraKindBreakdown[];

  definingItems: EraDefiningItem[];

  events: EraEvent[];
};

export type BuildErasOptions = {
  /**
   * Gap after which activity is assumed to belong
   * to a different era.
   */
  splitGapDays?: number;

  /**
   * Very small clusters can be ignored.
   */
  minimumEvents?: number;

  minimumActiveDays?: number;

  /**
   * Merge neighbouring weak clusters when their
   * distance is still reasonably small.
   */
  mergeGapDays?: number;

  maxDefiningItems?: number;
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

function timestampOf(
  value: string,
) {
  const timestamp =
    new Date(value).getTime();

  return Number.isFinite(timestamp)
    ? timestamp
    : null;
}

function dayKey(
  timestamp: number,
) {
  const date =
    new Date(timestamp);

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(2, '0');

  const day =
    String(
      date.getDate(),
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function daysBetween(
  first: number,
  second: number,
) {
  return Math.max(
    0,
    Math.floor(
      Math.abs(second - first) /
        DAY_MS,
    ),
  );
}

function safeSeconds(
  value: number | null | undefined,
) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(
    0,
    Number(value),
  );
}

function safeSignificance(
  value: number | null | undefined,
) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return clamp(
    Number(value),
    0,
    1,
  );
}

function seasonName(
  monthIndex: number,
) {
  if (
    monthIndex === 11 ||
    monthIndex <= 1
  ) {
    return 'Winter';
  }

  if (monthIndex <= 4) {
    return 'Spring';
  }

  if (monthIndex <= 7) {
    return 'Summer';
  }

  return 'Autumn';
}

function monthName(
  monthIndex: number,
) {
  return [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ][monthIndex] ?? 'Unknown';
}

function suggestedEraName(
  startTimestamp: number,
  endTimestamp: number,
) {
  const start =
    new Date(startTimestamp);

  const end =
    new Date(endTimestamp);

  const sameYear =
    start.getFullYear() ===
    end.getFullYear();

  const sameMonth =
    sameYear &&
    start.getMonth() ===
      end.getMonth();

  const span =
    daysBetween(
      startTimestamp,
      endTimestamp,
    ) + 1;

  if (
    sameMonth &&
    span <= 18
  ) {
    const startDay =
      start.getDate();

    const position =
      startDay <= 10
        ? 'Early'
        : startDay <= 20
          ? 'Mid'
          : 'Late';

    return (
      `${position} ` +
      `${monthName(start.getMonth())} ` +
      `${start.getFullYear()}`
    );
  }

  if (sameYear) {
    const startSeason =
      seasonName(
        start.getMonth(),
      );

    const endSeason =
      seasonName(
        end.getMonth(),
      );

    if (
      startSeason ===
      endSeason
    ) {
      return (
        `${startSeason} ` +
        `${start.getFullYear()}`
      );
    }

    return (
      `${monthName(start.getMonth())}` +
      `–` +
      `${monthName(end.getMonth())} ` +
      `${start.getFullYear()}`
    );
  }

  return (
    `${monthName(start.getMonth())} ` +
    `${start.getFullYear()}` +
    `–` +
    `${monthName(end.getMonth())} ` +
    `${end.getFullYear()}`
  );
}

function normalizeEvents(
  events: EraEventInput[],
) {
  const normalized: EraEvent[] =
    [];

  const seen =
    new Set<string>();

  for (const event of events) {
    const timestamp =
      timestampOf(
        event.occurredAt,
      );

    if (timestamp === null) {
      continue;
    }

    const key = [
      event.id,
      timestamp,
      event.kind,
      event.entityId ?? '',
    ].join('|');

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    normalized.push({
      ...event,

      timestamp,

      dayKey:
        dayKey(timestamp),
    });
  }

  return normalized.sort(
    (a, b) =>
      a.timestamp -
      b.timestamp,
  );
}

function splitIntoClusters(
  events: EraEvent[],
  splitGapDays: number,
) {
  const clusters:
    EraEvent[][] = [];

  for (const event of events) {
    const current =
      clusters[
        clusters.length - 1
      ];

    if (!current) {
      clusters.push([event]);
      continue;
    }

    const previous =
      current[
        current.length - 1
      ];

    if (!previous) {
      current.push(event);
      continue;
    }

    const gap =
      daysBetween(
        previous.timestamp,
        event.timestamp,
      );

    if (
      gap >
      splitGapDays
    ) {
      clusters.push([event]);
    } else {
      current.push(event);
    }
  }

  return clusters;
}

function activeDayCount(
  events: EraEvent[],
) {
  return new Set(
    events.map(
      (event) =>
        event.dayKey,
    ),
  ).size;
}

function clusterIsStrong(
  events: EraEvent[],
  minimumEvents: number,
  minimumActiveDays: number,
) {
  return (
    events.length >=
      minimumEvents &&
    activeDayCount(events) >=
      minimumActiveDays
  );
}

function mergeWeakNeighbours(
  clusters: EraEvent[][],
  mergeGapDays: number,
  minimumEvents: number,
  minimumActiveDays: number,
) {
  if (clusters.length <= 1) {
    return clusters;
  }

  const result:
    EraEvent[][] = [];

  for (
    let index = 0;
    index < clusters.length;
    index++
  ) {
    const cluster =
      clusters[index];

    if (!cluster?.length) {
      continue;
    }

    const previous =
      result[
        result.length - 1
      ];

    if (!previous?.length) {
      result.push(cluster);
      continue;
    }

    const previousLast =
      previous[
        previous.length - 1
      ];

    const currentFirst =
      cluster[0];

    if (
      !previousLast ||
      !currentFirst
    ) {
      result.push(cluster);
      continue;
    }

    const gap =
      daysBetween(
        previousLast.timestamp,
        currentFirst.timestamp,
      );

    const previousStrong =
      clusterIsStrong(
        previous,
        minimumEvents,
        minimumActiveDays,
      );

    const currentStrong =
      clusterIsStrong(
        cluster,
        minimumEvents,
        minimumActiveDays,
      );

    /**
     * If at least one side is weak, a modest gap
     * should not necessarily create an artificial era.
     *
     * Two already-strong clusters remain separate.
     */
    if (
      gap <= mergeGapDays &&
      (
        !previousStrong ||
        !currentStrong
      )
    ) {
      previous.push(
        ...cluster,
      );
    } else {
      result.push(cluster);
    }
  }

  return result;
}

function buildBreakdown(
  events: EraEvent[],
): EraKindBreakdown[] {
  const map =
    new Map<
      EraEntityKind,
      {
        events: number;
        days: Set<string>;
        seconds: number;
      }
    >();

  for (const event of events) {
    const current =
      map.get(event.kind) ?? {
        events: 0,
        days: new Set<string>(),
        seconds: 0,
      };

    current.events += 1;

    current.days.add(
      event.dayKey,
    );

    current.seconds +=
      safeSeconds(
        event.durationSeconds,
      );

    map.set(
      event.kind,
      current,
    );
  }

  return Array.from(
    map.entries(),
  )
    .map(
      ([kind, value]) => ({
        kind,

        eventCount:
          value.events,

        activeDays:
          value.days.size,

        totalSeconds:
          value.seconds,
      }),
    )
    .sort(
      (a, b) =>
        b.eventCount -
        a.eventCount,
    );
}

function buildDefiningItems(
  events: EraEvent[],
  limit: number,
): EraDefiningItem[] {
  const map =
    new Map<
      string,
      EraDefiningItem
    >();

  for (const event of events) {
    if (
      !event.entityId ||
      !event.title?.trim()
    ) {
      continue;
    }

    const key =
      `${event.kind}:` +
      event.entityId;

    const current =
      map.get(key) ?? {
        entityId:
          event.entityId,

        kind:
          event.kind,

        title:
          event.title.trim(),

        eventCount: 0,

        totalSeconds: 0,

        favourite: false,

        score: 0,
      };

    current.eventCount += 1;

    current.totalSeconds +=
      safeSeconds(
        event.durationSeconds,
      );

    current.favourite =
      current.favourite ||
      Boolean(
        event.favourite,
      );

    const significance =
      safeSignificance(
        event.significance,
      );

    /**
     * Repeated interaction is meaningful,
     * but diminishing returns prevent one item
     * from infinitely dominating an era.
     */
    const repetitionWeight =
      Math.min(
        12,
        Math.log2(
          1 +
          current.eventCount,
        ) * 4,
      );

    const timeWeight =
      Math.min(
        15,
        Math.log2(
          1 +
          current.totalSeconds /
            1800,
        ) * 3,
      );

    const jingleWeight =
      current.favourite
        ? 10
        : 0;

    const significanceWeight =
      significance * 12;

    current.score =
      repetitionWeight +
      timeWeight +
      jingleWeight +
      significanceWeight;

    map.set(
      key,
      current,
    );
  }

  return Array.from(
    map.values(),
  )
    .sort(
      (a, b) =>
        b.score -
        a.score,
    )
    .slice(
      0,
      limit,
    )
    .map(
      (item) => ({
        ...item,

        score:
          Math.round(
            item.score * 10,
          ) / 10,
      }),
    );
}

function buildEra(
  events: EraEvent[],
  index: number,
  maxDefiningItems: number,
): Era | null {
  const first =
    events[0];

  const last =
    events[
      events.length - 1
    ];

  if (!first || !last) {
    return null;
  }

  const breakdown =
    buildBreakdown(events);

  const strongestCount =
    breakdown[0]
      ?.eventCount ?? 0;

  const dominantKinds =
    breakdown
      .filter(
        (entry) =>
          entry.eventCount >=
          Math.max(
            1,
            strongestCount * 0.55,
          ),
      )
      .map(
        (entry) =>
          entry.kind,
      );

  const totalSeconds =
    events.reduce(
      (sum, event) =>
        sum +
        safeSeconds(
          event.durationSeconds,
        ),
      0,
    );

  return {
    id:
      `era-${first.dayKey}-` +
      `${last.dayKey}-${index}`,

    startAt:
      first.occurredAt,

    endAt:
      last.occurredAt,

    startTimestamp:
      first.timestamp,

    endTimestamp:
      last.timestamp,

    spanDays:
      daysBetween(
        first.timestamp,
        last.timestamp,
      ) + 1,

    activeDays:
      activeDayCount(events),

    eventCount:
      events.length,

    totalSeconds,

    suggestedName:
      suggestedEraName(
        first.timestamp,
        last.timestamp,
      ),

    dominantKinds,

    breakdown,

    definingItems:
      buildDefiningItems(
        events,
        maxDefiningItems,
      ),

    events,
  };
}


/**
 * erasEngineV1
 *
 * Pure chronological clustering.
 *
 * IMPORTANT:
 * This file must NEVER open SQLite.
 *
 * The app's only runtime database opener remains
 * storage/databaseConnection.ts.
 */
export function buildEras(
  input: EraEventInput[],
  options: BuildErasOptions = {},
): Era[] {
  const splitGapDays =
    Math.max(
      2,
      options.splitGapDays ??
        21,
    );

  const mergeGapDays =
    Math.max(
      1,
      Math.min(
        splitGapDays,
        options.mergeGapDays ??
          9,
      ),
    );

  const minimumEvents =
    Math.max(
      1,
      options.minimumEvents ??
        4,
    );

  const minimumActiveDays =
    Math.max(
      1,
      options.minimumActiveDays ??
        2,
    );

  const maxDefiningItems =
    Math.max(
      1,
      options.maxDefiningItems ??
        6,
    );

  const events =
    normalizeEvents(input);

  if (events.length === 0) {
    return [];
  }

  const rawClusters =
    splitIntoClusters(
      events,
      splitGapDays,
    );

  const merged =
    mergeWeakNeighbours(
      rawClusters,
      mergeGapDays,
      minimumEvents,
      minimumActiveDays,
    );

  return merged
    .filter(
      (cluster) =>
        clusterIsStrong(
          cluster,
          minimumEvents,
          minimumActiveDays,
        ),
    )
    .map(
      (cluster, index) =>
        buildEra(
          cluster,
          index,
          maxDefiningItems,
        ),
    )
    .filter(
      (era): era is Era =>
        era !== null,
    );
}


/**
 * Find the era containing a specific date.
 */
export function findEraAt(
  eras: Era[],
  dateInput: string | Date,
) {
  const timestamp =
    dateInput instanceof Date
      ? dateInput.getTime()
      : new Date(
          dateInput,
        ).getTime();

  if (
    !Number.isFinite(timestamp)
  ) {
    return null;
  }

  return (
    eras.find(
      (era) =>
        timestamp >=
          era.startTimestamp &&
        timestamp <=
          era.endTimestamp,
    ) ?? null
  );
}


/**
 * Find the era nearest to a date even if the
 * date falls into a quiet gap.
 *
 * Later useful for:
 * "Where was I then?"
 */
export function findNearestEra(
  eras: Era[],
  dateInput: string | Date,
) {
  const timestamp =
    dateInput instanceof Date
      ? dateInput.getTime()
      : new Date(
          dateInput,
        ).getTime();

  if (
    !Number.isFinite(timestamp) ||
    eras.length === 0
  ) {
    return null;
  }

  const containing =
    findEraAt(
      eras,
      new Date(timestamp),
    );

  if (containing) {
    return containing;
  }

  return (
    [...eras].sort(
      (a, b) => {
        const aDistance =
          Math.min(
            Math.abs(
              timestamp -
                a.startTimestamp,
            ),
            Math.abs(
              timestamp -
                a.endTimestamp,
            ),
          );

        const bDistance =
          Math.min(
            Math.abs(
              timestamp -
                b.startTimestamp,
            ),
            Math.abs(
              timestamp -
                b.endTimestamp,
            ),
          );

        return (
          aDistance -
          bDistance
        );
      },
    )[0] ?? null
  );
}
