import {
  loadChronology,
} from './chronology';

import type {
  ChronologyEvent,
} from '../types/chronology';

import type {
  Reconstruction,
  ReconstructionActiveItem,
  ReconstructionActivitySummary,
  ReconstructionCategory,
  ReconstructionCategorySummary,
  ReconstructionPeriod,
} from '../types/reconstruction';

// reconstructionEngineV1
//
// Derived historical reconstruction.
//
// No SQLite connection.
// No schema.
// No mutations.
//
// This layer only interprets timestamps already exposed by
// Chronology V1.

function localDate(
  year: number,
  month: number,
  day: number,
) {
  return new Date(
    year,
    month,
    day,
    12,
    0,
    0,
    0,
  );
}

function isoDate(date: Date) {
  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1,
    ).padStart(2, '0'),
    String(
      date.getDate(),
    ).padStart(2, '0'),
  ].join('-');
}

function addDays(
  date: Date,
  days: number,
) {
  const result =
    new Date(date);

  result.setDate(
    result.getDate() + days,
  );

  return result;
}

function parseEventTime(
  value: string,
) {
  const normalized =
    /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value + 'T12:00:00'
      : value;

  const parsed =
    Date.parse(normalized);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function duration(
  event: ChronologyEvent,
) {
  return event.kind === 'SESSION'
    ? event.durationSeconds ?? 0
    : 0;
}

function unique(values: string[]) {
  return [...new Set(
    values
      .map((value) => value.trim())
      .filter(Boolean),
  )];
}

function categoryFor(
  event: ChronologyEvent,
): ReconstructionCategory {
  if (event.kind === 'ENTRY') {
    return 'ENTRIES';
  }

  if (event.kind === 'SESSION') {
    return 'SESSIONS';
  }

  if (event.entityType === 'BOOK') {
    return 'BOOKS';
  }

  if (event.entityType === 'MEDIA') {
    return 'MEDIA';
  }

  if (event.entityType === 'GAME') {
    return 'GAMES';
  }

  return 'OTHER';
}

export function reconstructionDay(
  year: number,
  month: number,
  day: number,
): ReconstructionPeriod {
  const start =
    localDate(
      year,
      month - 1,
      day,
    );

  const end =
    addDays(start, 1);

  return {
    kind: 'DAY',

    start: isoDate(start),
    end: isoDate(end),

    label:
      start.toLocaleDateString(
        'hr-HR',
        {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        },
      ),

    year,
    month,
    day,
  };
}

export function reconstructionMonth(
  year: number,
  month: number,
): ReconstructionPeriod {
  const start =
    localDate(
      year,
      month - 1,
      1,
    );

  const end =
    localDate(
      year,
      month,
      1,
    );

  return {
    kind: 'MONTH',

    start: isoDate(start),
    end: isoDate(end),

    label:
      start.toLocaleDateString(
        'hr-HR',
        {
          month: 'long',
          year: 'numeric',
        },
      ),

    year,
    month,
  };
}

export function reconstructionYear(
  year: number,
): ReconstructionPeriod {
  return {
    kind: 'YEAR',

    start:
      String(year) + '-01-01',

    end:
      String(year + 1) + '-01-01',

    label: String(year),

    year,
  };
}

export function reconstructionCustom(
  start: string,
  end: string,
  label: string,
): ReconstructionPeriod {
  const year =
    Number(
      start.slice(0, 4),
    ) || 0;

  return {
    kind: 'CUSTOM',

    start,
    end,
    label,
    year,
  };
}

function buildCategories(
  events: ChronologyEvent[],
): ReconstructionCategorySummary[] {
  const order:
    ReconstructionCategory[] = [
      'BOOKS',
      'MEDIA',
      'GAMES',
      'ENTRIES',
      'SESSIONS',
      'OTHER',
    ];

  return order
    .map((category) => {
      const matches =
        events.filter(
          (event) =>
            categoryFor(event) ===
            category,
        );

      return {
        category,

        eventCount:
          matches.length,

        trackedSeconds:
          matches.reduce(
            (sum, event) =>
              sum + duration(event),
            0,
          ),

        titles:
          unique(
            matches.map(
              (event) =>
                event.title,
            ),
          ),
      };
    })
    .filter(
      (summary) =>
        summary.eventCount > 0,
    );
}

function buildActivities(
  events: ChronologyEvent[],
): ReconstructionActivitySummary[] {
  const map =
    new Map<
      string,
      ReconstructionActivitySummary
    >();

  for (const event of events) {
    if (event.kind !== 'SESSION') {
      continue;
    }

    const label =
      event.activityType ??
      event.subtitle ??
      event.title;

    const current =
      map.get(label) ?? {
        label,
        sessionCount: 0,
        trackedSeconds: 0,
      };

    current.sessionCount += 1;

    current.trackedSeconds +=
      event.durationSeconds ?? 0;

    map.set(label, current);
  }

  return [...map.values()]
    .sort(
      (left, right) =>
        right.trackedSeconds -
          left.trackedSeconds ||
        right.sessionCount -
          left.sessionCount ||
        left.label.localeCompare(
          right.label,
          'hr',
        ),
    );
}

function buildBusiestDay(
  events: ChronologyEvent[],
) {
  const days =
    new Map<
      string,
      {
        eventCount: number;
        trackedSeconds: number;
      }
    >();

  for (const event of events) {
    const time =
      parseEventTime(event.at);

    if (!time) continue;

    const date =
      new Date(time);

    const key =
      isoDate(date);

    const current =
      days.get(key) ?? {
        eventCount: 0,
        trackedSeconds: 0,
      };

    current.eventCount += 1;

    current.trackedSeconds +=
      duration(event);

    days.set(key, current);
  }

  const winner =
    [...days.entries()]
      .sort(
        ([leftDate, left],
         [rightDate, right]) =>
          right.trackedSeconds -
            left.trackedSeconds ||
          right.eventCount -
            left.eventCount ||
          rightDate.localeCompare(
            leftDate,
          ),
      )[0];

  if (!winner) {
    return null;
  }

  return {
    date: winner[0],
    eventCount:
      winner[1].eventCount,
    trackedSeconds:
      winner[1].trackedSeconds,
  };
}

// reconstructionActiveAtDateV1

function buildActiveAtDate(
  events: ChronologyEvent[],
): ReconstructionActiveItem[] {
  const active =
    new Map<string, ReconstructionActiveItem>();

  const sorted = [...events].sort(
    (left, right) =>
      parseEventTime(left.at) -
      parseEventTime(right.at),
  );

  for (const event of sorted) {
    if (!event.entityId) {
      continue;
    }

    const key =
      `${event.entityType}:${event.entityId}`;

    if (
      event.kind === 'BOOK_STARTED' ||
      event.kind === 'MEDIA_STARTED' ||
      event.kind === 'GAME_STARTED'
    ) {
      if (
        event.entityType !== 'BOOK' &&
        event.entityType !== 'MEDIA' &&
        event.entityType !== 'GAME'
      ) {
        continue;
      }

      active.set(key, {
        entityType: event.entityType,
        entityId: event.entityId,
        title: event.title,
        subtitle: event.subtitle,
        startedAt: event.at,
      });

      continue;
    }

    if (
      event.kind === 'BOOK_FINISHED' ||
      event.kind === 'MEDIA_COMPLETED' ||
      event.kind === 'GAME_FINISHED'
    ) {
      active.delete(key);
    }
  }

  return [...active.values()].sort(
    (left, right) =>
      parseEventTime(right.startedAt) -
      parseEventTime(left.startedAt),
  );
}

export async function reconstructPeriod(
  period: ReconstructionPeriod,
): Promise<Reconstruction> {
  const events =
    await loadChronology({
      start: period.start,
      end: period.end,
    });

    const history =
  period.kind === 'DAY'
    ? await loadChronology({
        end: period.end,
      })
    : [];

  const ascending =
    [...events].sort(
      (left, right) =>
        parseEventTime(left.at) -
        parseEventTime(right.at),
    );

  const kindMap =
    new Map<
      ChronologyEvent['kind'],
      number
    >();

  for (const event of events) {
    kindMap.set(
      event.kind,
      (kindMap.get(event.kind) ?? 0) + 1,
    );
  }

  return {
    period,

    eventCount:
      events.length,

    trackedSeconds:
      events.reduce(
        (sum, event) =>
          sum + duration(event),
        0,
      ),

    firstEvent:
      ascending[0] ?? null,

    lastEvent:
      ascending.at(-1) ?? null,

    busiestDay:
      buildBusiestDay(events),

    categories:
      buildCategories(events),

    activities:
      buildActivities(events),

    eventKinds:
      [...kindMap.entries()]
        .map(
          ([kind, count]) => ({
            kind,
            count,
          }),
        )
        .sort(
          (left, right) =>
            right.count -
            left.count,
        ),  
        activeItems:
  period.kind === 'DAY'
    ? buildActiveAtDate(history)
    : [],
    events,
  };
}
