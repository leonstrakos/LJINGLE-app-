import {
  findNearestEra,
  type Era,
  type EraEntityKind,
} from './eras';

export type ReconstructionEventKind =
  | 'SESSION'
  | 'STARTED'
  | 'PROGRESS'
  | 'COMPLETED'
  | 'STATUS'
  | 'NOTE'
  | 'JINGLE'
  | 'ENTRY'
  | 'TOPIC'
  | 'OTHER';

export type ReconstructionEventInput = {
  id: string;

  occurredAt: string;

  kind: ReconstructionEventKind;

  entityKind?: EraEntityKind | null;
  entityId?: string | null;

  title: string;

  subtitle?: string | null;
  note?: string | null;

  durationSeconds?: number | null;

  /**
   * If this object represents a catalogue item
   * whose active interval is known.
   */
  activeFrom?: string | null;
  activeUntil?: string | null;

  favourite?: boolean | null;
};

export type ReconstructionEvent =
  ReconstructionEventInput & {
    timestamp: number;
    distanceDays: number;
    relation:
      | 'TARGET_DAY'
      | 'BEFORE'
      | 'AFTER';
};

export type ReconstructionActiveItem = {
  entityId: string;
  entityKind: EraEntityKind;
  title: string;

  favourite: boolean;

  startedAt: string | null;
  endedAt: string | null;

  relatedEventCount: number;
};

export type ReconstructionKindSummary = {
  kind: EraEntityKind;
  eventCount: number;
  totalSeconds: number;
};

export type MomentReconstruction = {
  targetDate: string;
  targetTimestamp: number;

  era: Era | null;

  sameDay: ReconstructionEvent[];
  before: ReconstructionEvent[];
  after: ReconstructionEvent[];

  activeItems: ReconstructionActiveItem[];

  dominantKinds: ReconstructionKindSummary[];

  notes: ReconstructionEvent[];

  totalNearbySeconds: number;

  summary: {
    nearbyEventCount: number;
    activeItemCount: number;
    noteCount: number;
    jingleCount: number;
  };
};

export type ReconstructionOptions = {
  /**
   * Events this many days before/after target
   * are included in nearby context.
   */
  windowDays?: number;

  maxBefore?: number;
  maxAfter?: number;
  maxActiveItems?: number;
  maxNotes?: number;
};

const DAY_MS =
  24 * 60 * 60 * 1000;

function timestampOf(
  value: string | null | undefined,
) {
  if (!value) return null;

  const timestamp =
    new Date(value).getTime();

  return Number.isFinite(timestamp)
    ? timestamp
    : null;
}

function startOfLocalDay(
  timestamp: number,
) {
  const date =
    new Date(timestamp);

  date.setHours(
    0,
    0,
    0,
    0,
  );

  return date.getTime();
}

function dayDistance(
  first: number,
  second: number,
) {
  return Math.round(
    Math.abs(
      startOfLocalDay(first) -
      startOfLocalDay(second),
    ) / DAY_MS,
  );
}

function sameLocalDay(
  first: number,
  second: number,
) {
  return (
    startOfLocalDay(first) ===
    startOfLocalDay(second)
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

function relationToTarget(
  timestamp: number,
  targetTimestamp: number,
): ReconstructionEvent['relation'] {
  if (
    sameLocalDay(
      timestamp,
      targetTimestamp,
    )
  ) {
    return 'TARGET_DAY';
  }

  return timestamp <
    targetTimestamp
    ? 'BEFORE'
    : 'AFTER';
}

function normalizeNearbyEvents(
  input: ReconstructionEventInput[],
  targetTimestamp: number,
  windowDays: number,
) {
  const result:
    ReconstructionEvent[] = [];

  const seen =
    new Set<string>();

  for (const event of input) {
    const timestamp =
      timestampOf(
        event.occurredAt,
      );

    if (timestamp === null) {
      continue;
    }

    const distance =
      dayDistance(
        timestamp,
        targetTimestamp,
      );

    if (
      distance >
      windowDays
    ) {
      continue;
    }

    const key = [
      event.id,
      timestamp,
      event.kind,
      event.entityId ?? '',
      event.note?.trim() ?? '',
    ].join('|');

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    result.push({
      ...event,

      timestamp,

      distanceDays:
        distance,

      relation:
        relationToTarget(
          timestamp,
          targetTimestamp,
        ),
    });
  }

  return result.sort(
    (a, b) =>
      a.timestamp -
      b.timestamp,
  );
}

function buildActiveItems(
  input: ReconstructionEventInput[],
  targetTimestamp: number,
  maximum: number,
) {
  const items =
    new Map<
      string,
      ReconstructionActiveItem
    >();

  for (const event of input) {
    if (
      !event.entityId ||
      !event.entityKind ||
      !event.title.trim()
    ) {
      continue;
    }

    const start =
      timestampOf(
        event.activeFrom,
      );

    const end =
      timestampOf(
        event.activeUntil,
      );

    if (start === null) {
      continue;
    }

    const active =
      targetTimestamp >= start &&
      (
        end === null ||
        targetTimestamp <= end
      );

    if (!active) {
      continue;
    }

    const key =
      `${event.entityKind}:` +
      event.entityId;

    const current =
      items.get(key);

    if (current) {
      current.relatedEventCount += 1;

      current.favourite =
        current.favourite ||
        Boolean(
          event.favourite,
        );

      continue;
    }

    items.set(
      key,
      {
        entityId:
          event.entityId,

        entityKind:
          event.entityKind,

        title:
          event.title.trim(),

        favourite:
          Boolean(
            event.favourite,
          ),

        startedAt:
          event.activeFrom ??
          null,

        endedAt:
          event.activeUntil ??
          null,

        relatedEventCount: 1,
      },
    );
  }

  return Array.from(
    items.values(),
  )
    .sort(
      (a, b) => {
        if (
          a.favourite !==
          b.favourite
        ) {
          return a.favourite
            ? -1
            : 1;
        }

        return (
          b.relatedEventCount -
          a.relatedEventCount
        );
      },
    )
    .slice(
      0,
      maximum,
    );
}

function buildKindSummary(
  events: ReconstructionEvent[],
) {
  const map =
    new Map<
      EraEntityKind,
      {
        eventCount: number;
        totalSeconds: number;
      }
    >();

  for (const event of events) {
    if (!event.entityKind) {
      continue;
    }

    const current =
      map.get(
        event.entityKind,
      ) ?? {
        eventCount: 0,
        totalSeconds: 0,
      };

    current.eventCount += 1;

    current.totalSeconds +=
      safeSeconds(
        event.durationSeconds,
      );

    map.set(
      event.entityKind,
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
          value.eventCount,

        totalSeconds:
          value.totalSeconds,
      }),
    )
    .sort(
      (a, b) => {
        if (
          b.eventCount !==
          a.eventCount
        ) {
          return (
            b.eventCount -
            a.eventCount
          );
        }

        return (
          b.totalSeconds -
          a.totalSeconds
        );
      },
    );
}

function nearestFirst(
  events: ReconstructionEvent[],
) {
  return [...events].sort(
    (a, b) => {
      if (
        a.distanceDays !==
        b.distanceDays
      ) {
        return (
          a.distanceDays -
          b.distanceDays
        );
      }

      return (
        b.timestamp -
        a.timestamp
      );
    },
  );
}


/**
 * reconstructionEngineV1
 *
 * Builds a snapshot of what surrounded
 * a particular moment in the user's history.
 *
 * PURE DOMAIN LOGIC.
 *
 * NEVER open SQLite here.
 *
 * Runtime SQLite ownership remains exclusively
 * inside storage/databaseConnection.ts.
 */
export function reconstructMoment(
  input: ReconstructionEventInput[],
  eras: Era[],
  dateInput: string | Date,
  options: ReconstructionOptions = {},
): MomentReconstruction | null {
  const targetTimestamp =
    dateInput instanceof Date
      ? dateInput.getTime()
      : new Date(
          dateInput,
        ).getTime();

  if (
    !Number.isFinite(
      targetTimestamp,
    )
  ) {
    return null;
  }

  const windowDays =
    Math.max(
      1,
      options.windowDays ??
        14,
    );

  const maxBefore =
    Math.max(
      1,
      options.maxBefore ??
        8,
    );

  const maxAfter =
    Math.max(
      1,
      options.maxAfter ??
        8,
    );

  const maxActiveItems =
    Math.max(
      1,
      options.maxActiveItems ??
        8,
    );

  const maxNotes =
    Math.max(
      1,
      options.maxNotes ??
        6,
    );

  const nearby =
    normalizeNearbyEvents(
      input,
      targetTimestamp,
      windowDays,
    );

  const sameDay =
    nearby.filter(
      (event) =>
        event.relation ===
        'TARGET_DAY',
    );

  const before =
    nearestFirst(
      nearby.filter(
        (event) =>
          event.relation ===
          'BEFORE',
      ),
    ).slice(
      0,
      maxBefore,
    );

  const after =
    nearestFirst(
      nearby.filter(
        (event) =>
          event.relation ===
          'AFTER',
      ),
    ).slice(
      0,
      maxAfter,
    );

  const activeItems =
    buildActiveItems(
      input,
      targetTimestamp,
      maxActiveItems,
    );

  const notes =
    nearestFirst(
      nearby.filter(
        (event) =>
          Boolean(
            event.note?.trim(),
          ) ||
          event.kind === 'NOTE' ||
          event.kind === 'ENTRY',
      ),
    ).slice(
      0,
      maxNotes,
    );

  const dominantKinds =
    buildKindSummary(
      nearby,
    );

  const totalNearbySeconds =
    nearby.reduce(
      (sum, event) =>
        sum +
        safeSeconds(
          event.durationSeconds,
        ),
      0,
    );

  const jingleCount =
    nearby.filter(
      (event) =>
        event.kind === 'JINGLE' ||
        event.favourite,
    ).length;

  const targetDate =
    new Date(
      targetTimestamp,
    ).toISOString();

  return {
    targetDate,
    targetTimestamp,

    era:
      findNearestEra(
        eras,
        new Date(
          targetTimestamp,
        ),
      ),

    sameDay,
    before,
    after,

    activeItems,

    dominantKinds,

    notes,

    totalNearbySeconds,

    summary: {
      nearbyEventCount:
        nearby.length,

      activeItemCount:
        activeItems.length,

      noteCount:
        notes.length,

      jingleCount,
    },
  };
}


/**
 * Convenience copy for UI.
 *
 * Does not try to invent a psychological
 * interpretation of the era.
 */
export function describeReconstruction(
  reconstruction: MomentReconstruction,
) {
  const lines: string[] =
    [];

  if (
    reconstruction.activeItems.length >
    0
  ) {
    const names =
      reconstruction.activeItems
        .slice(0, 3)
        .map(
          (item) =>
            item.title,
        );

    lines.push(
      `Aktivno: ${names.join(', ')}`,
    );
  }

  const dominant =
    reconstruction
      .dominantKinds[0];

  if (dominant) {
    lines.push(
      `Najviše aktivnosti: ${dominant.kind}`,
    );
  }

  if (
    reconstruction.sameDay.length >
    0
  ) {
    lines.push(
      `${reconstruction.sameDay.length} događaja tog dana`,
    );
  }

  if (
    reconstruction.notes.length >
    0
  ) {
    lines.push(
      `${reconstruction.notes.length} povezanih bilješki`,
    );
  }

  if (reconstruction.era) {
    lines.push(
      `Era: ${reconstruction.era.suggestedName}`,
    );
  }

  return lines;
}
