import { getDatabase } from './database';

import type {
  ChronologyEntityType,
  ChronologyEvent,
  ChronologyMonth,
  ChronologyPeriodSnapshot,
  ChronologyYear,
  SeasonalMemoryGroup,
} from '../types/chronology';

// chronologyV1
//
// IMPORTANT:
// This is a derived read model.
// It creates no tables and mutates no user data.
//
// We only produce timeline events when the database contains
// a real timestamp for the event. Current state alone is not
// treated as historical fact.

type Row = Record<string, unknown>;

const monthNames = [
  'siječanj',
  'veljača',
  'ožujak',
  'travanj',
  'svibanj',
  'lipanj',
  'srpanj',
  'kolovoz',
  'rujan',
  'listopad',
  'studeni',
  'prosinac',
];

function asNullableString(
  value: unknown,
): string | null {
  return value === null ||
    value === undefined ||
    value === ''
    ? null
    : String(value);
}

function parseTime(value: string) {
  const normalized =
    /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value + 'T12:00:00'
      : value;

  const parsed = Date.parse(normalized);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function durationSeconds(
  start: string,
  end: string | null,
) {
  const startMs = parseTime(start);

  const endMs = end
    ? parseTime(end)
    : Date.now();

  if (!startMs || !endMs) return 0;

  return Math.max(
    0,
    Math.floor((endMs - startMs) / 1000),
  );
}

function eventYear(event: ChronologyEvent) {
  const d = new Date(parseTime(event.at));
  return d.getFullYear();
}

function eventMonth(event: ChronologyEvent) {
  const d = new Date(parseTime(event.at));
  return d.getMonth();
}

function inRange(
  event: ChronologyEvent,
  start?: string,
  end?: string,
) {
  const time = parseTime(event.at);

  if (!time) return false;

  if (start && time < parseTime(start)) {
    return false;
  }

  if (end && time >= parseTime(end)) {
    return false;
  }

  return true;
}

function compactText(
  value: string,
  max = 72,
) {
  const clean = value
    .replace(/\s+/g, ' ')
    .trim();

  if (clean.length <= max) return clean;

  return clean.slice(0, max - 1).trimEnd() + '…';
}

function sessionEntity(
  row: Row,
): {
  entityType: ChronologyEntityType;
  entityId: string | null;
} {
  if (row.game_id) {
    return {
      entityType: 'GAME',
      entityId: String(row.game_id),
    };
  }

  if (row.media_id) {
    return {
      entityType: 'MEDIA',
      entityId: String(row.media_id),
    };
  }

  if (row.book_id) {
    return {
      entityType: 'BOOK',
      entityId: String(row.book_id),
    };
  }

  if (row.topic_id) {
    return {
      entityType: 'TOPIC',
      entityId: String(row.topic_id),
    };
  }

  return {
    entityType: 'ACTIVITY',
    entityId: asNullableString(row.activity_id),
  };
}

async function tableExists(
  database: Awaited<ReturnType<typeof getDatabase>>,
  name: string,
) {
  const row =
    await database.getFirstAsync<{ name: string }>(
      `SELECT name
         FROM sqlite_master
        WHERE type = 'table'
          AND name = ?
        LIMIT 1`,
      name,
    );

  return Boolean(row?.name);
}

export async function loadChronology(options?: {
  start?: string;
  end?: string;
}) {
  const database = await getDatabase();

  const hasFlags =
    await tableExists(
      database,
      'external_media_flags',
    );

  const mediaVisibility = hasFlags
    ? `
      WHERE NOT EXISTS (
        SELECT 1
          FROM external_media_flags f
         WHERE f.media_id = m.media_id
           AND f.source = 'TV_TIME'
           AND f.flag = 'NEBITNO'
      )
    `
    : '';

  const [
    sessionRows,
    entryRows,
    bookRows,
    mediaRows,
    gameRows,
  ] = await Promise.all([
    database.getAllAsync<Row>(
      `
      SELECT
        s.session_id,
        s.started_at,
        s.ended_at,
        a.activity_id,
        a.label,
        a.activity_type,
        a.book_id,
        a.topic_id,
        a.media_id,
        b.title AS book_title,
        m.title AS media_title,
        g.game_id,
        g.title AS game_title
      FROM time_sessions s
      JOIN activities a
        ON a.activity_id = s.activity_id
      LEFT JOIN books b
        ON b.book_id = a.book_id
      LEFT JOIN media_items m
        ON m.media_id = a.media_id
      LEFT JOIN games g
        ON g.playing_activity_id =
           a.activity_id
      ORDER BY s.started_at DESC
      `,
    ),

    database.getAllAsync<Row>(
      `
      SELECT
        entry_id,
        title,
        content,
        entry_type,
        book_id,
        topic_id,
        activity_id,
        created_at
      FROM entries
      ORDER BY created_at DESC
      `,
    ),

    database.getAllAsync<Row>(
      `
      SELECT
        book_id,
        title,
        author,
        started_on,
        finished_on
      FROM books
      WHERE started_on IS NOT NULL
         OR finished_on IS NOT NULL
      `,
    ),

    database.getAllAsync<Row>(
      `
      SELECT
        m.media_id,
        m.media_type,
        m.title,
        m.release_year,
        m.started_on,
        m.completed_on
      FROM media_items m
      ${mediaVisibility}
      `,
    ),

    database.getAllAsync<Row>(
      `
      SELECT
        game_id,
        title,
        platform,
        developer,
        started_on,
        finished_on
      FROM games
      WHERE started_on IS NOT NULL
         OR finished_on IS NOT NULL
      `,
    ),
  ]);

  const events: ChronologyEvent[] = [];

  for (const row of sessionRows) {
    const at = asNullableString(row.started_at);

    if (!at) continue;

    const endAt =
      asNullableString(row.ended_at);

    const entity = sessionEntity(row);

    const linkedTitle =
      asNullableString(row.game_title) ??
      asNullableString(row.media_title) ??
      asNullableString(row.book_title);

    events.push({
      id:
        'session:' +
        String(row.session_id),

      kind: 'SESSION',

      at,
      endAt,

      title:
        linkedTitle ??
        String(row.label ?? 'Aktivnost'),

      subtitle:
        linkedTitle
          ? String(row.label ?? '')
          : asNullableString(row.activity_type),

      entityType: entity.entityType,
      entityId: entity.entityId,

      activityType:
        asNullableString(row.activity_type),

      durationSeconds:
        durationSeconds(at, endAt),

      note: null,
    });
  }

  for (const row of entryRows) {
    const at = asNullableString(row.created_at);

    if (!at) continue;

    const content =
      String(row.content ?? '');

    events.push({
      id:
        'entry:' +
        String(row.entry_id),

      kind: 'ENTRY',

      at,
      endAt: null,

      title:
        asNullableString(row.title) ??
        compactText(content) ??
        'Zapis',

      subtitle:
        asNullableString(row.entry_type),

      entityType: 'ENTRY',
      entityId: String(row.entry_id),

      activityType: null,
      durationSeconds: null,
      note: compactText(content, 130),
    });
  }

  for (const row of bookRows) {
    const bookId = String(row.book_id);
    const title = String(row.title);
    const author =
      asNullableString(row.author);

    const started =
      asNullableString(row.started_on);

    const finished =
      asNullableString(row.finished_on);

    if (started) {
      events.push({
        id: `book-start:${bookId}`,
        kind: 'BOOK_STARTED',
        at: started,
        endAt: null,
        title,
        subtitle: author,
        entityType: 'BOOK',
        entityId: bookId,
        activityType: null,
        durationSeconds: null,
        note: null,
      });
    }

    if (finished) {
      events.push({
        id: `book-finish:${bookId}`,
        kind: 'BOOK_FINISHED',
        at: finished,
        endAt: null,
        title,
        subtitle: author,
        entityType: 'BOOK',
        entityId: bookId,
        activityType: null,
        durationSeconds: null,
        note: null,
      });
    }
  }

  for (const row of mediaRows) {
    const mediaId =
      String(row.media_id);

    const title =
      String(row.title);

    const subtitle = [
      asNullableString(row.media_type),
      asNullableString(row.release_year),
    ]
      .filter(Boolean)
      .join(' · ') || null;

    const started =
      asNullableString(row.started_on);

    const completed =
      asNullableString(row.completed_on);

    if (started) {
      events.push({
        id: `media-start:${mediaId}`,
        kind: 'MEDIA_STARTED',
        at: started,
        endAt: null,
        title,
        subtitle,
        entityType: 'MEDIA',
        entityId: mediaId,
        activityType: null,
        durationSeconds: null,
        note: null,
      });
    }

    if (completed) {
      events.push({
        id: `media-complete:${mediaId}`,
        kind: 'MEDIA_COMPLETED',
        at: completed,
        endAt: null,
        title,
        subtitle,
        entityType: 'MEDIA',
        entityId: mediaId,
        activityType: null,
        durationSeconds: null,
        note: null,
      });
    }
  }

  for (const row of gameRows) {
    const gameId =
      String(row.game_id);

    const title =
      String(row.title);

    const subtitle = [
      asNullableString(row.developer),
      asNullableString(row.platform),
    ]
      .filter(Boolean)
      .join(' · ') || null;

    const started =
      asNullableString(row.started_on);

    const finished =
      asNullableString(row.finished_on);

    if (started) {
      events.push({
        id: `game-start:${gameId}`,
        kind: 'GAME_STARTED',
        at: started,
        endAt: null,
        title,
        subtitle,
        entityType: 'GAME',
        entityId: gameId,
        activityType: null,
        durationSeconds: null,
        note: null,
      });
    }

    if (finished) {
      events.push({
        id: `game-finish:${gameId}`,
        kind: 'GAME_FINISHED',
        at: finished,
        endAt: null,
        title,
        subtitle,
        entityType: 'GAME',
        entityId: gameId,
        activityType: null,
        durationSeconds: null,
        note: null,
      });
    }
  }

  return events
    .filter((event) =>
      inRange(
        event,
        options?.start,
        options?.end,
      ),
    )
    .sort(
      (a, b) =>
        parseTime(b.at) -
        parseTime(a.at),
    );
}

export function groupChronologyByYear(
  events: ChronologyEvent[],
): ChronologyYear[] {
  const years =
    new Map<number, ChronologyEvent[]>();

  for (const event of events) {
    const year = eventYear(event);

    if (!year) continue;

    const current =
      years.get(year) ?? [];

    current.push(event);
    years.set(year, current);
  }

  return [...years.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, yearEvents]) => {
      const months =
        new Map<number, ChronologyEvent[]>();

      for (const event of yearEvents) {
        const month =
          eventMonth(event);

        const current =
          months.get(month) ?? [];

        current.push(event);
        months.set(month, current);
      }

      const monthGroups:
        ChronologyMonth[] =
        [...months.entries()]
          .sort(([a], [b]) => b - a)
          .map(
            ([month, monthEvents]) => ({
              key:
                String(year) +
                '-' +
                String(month + 1)
                  .padStart(2, '0'),

              year,
              month,

              label:
                monthNames[month] ??
                String(month + 1),

              events: monthEvents,

              eventCount:
                monthEvents.length,

              trackedSeconds:
                monthEvents.reduce(
                  (sum, event) =>
                    sum +
                    (event.kind === 'SESSION'
                      ? event.durationSeconds ?? 0
                      : 0),
                  0,
                ),
            }),
          );

      return {
        year,

        eventCount:
          yearEvents.length,

        trackedSeconds:
          yearEvents.reduce(
            (sum, event) =>
              sum +
              (event.kind === 'SESSION'
                ? event.durationSeconds ?? 0
                : 0),
            0,
          ),

        months: monthGroups,
      };
    });
}

function uniqueTitles(
  events: ChronologyEvent[],
  entityType: ChronologyEntityType,
) {
  return [
    ...new Set(
      events
        .filter(
          (event) =>
            event.entityType === entityType,
        )
        .map((event) => event.title.trim())
        .filter(Boolean),
    ),
  ];
}

export async function loadPeriodSnapshot(
  start: string,
  end: string,
): Promise<ChronologyPeriodSnapshot> {
  const events =
    await loadChronology({
      start,
      end,
    });

  return {
    start,
    end,

    eventCount: events.length,

    trackedSeconds:
      events.reduce(
        (sum, event) =>
          sum +
          (event.kind === 'SESSION'
            ? event.durationSeconds ?? 0
            : 0),
        0,
      ),

    sessionCount:
      events.filter(
        (event) =>
          event.kind === 'SESSION',
      ).length,

    entryCount:
      events.filter(
        (event) =>
          event.kind === 'ENTRY',
      ).length,

    books:
      uniqueTitles(events, 'BOOK'),

    media:
      uniqueTitles(events, 'MEDIA'),

    games:
      uniqueTitles(events, 'GAME'),

    activities:
      uniqueTitles(events, 'ACTIVITY'),
  };
}

function seasonalDay(
  value: string | Date,
) {
  const date =
    typeof value === 'string'
      ? new Date(parseTime(value))
      : value;

  // Leap year is deliberate so Feb 29 is representable.
  const normalized =
    Date.UTC(
      2000,
      date.getMonth(),
      date.getDate(),
    );

  const start =
    Date.UTC(2000, 0, 1);

  return Math.floor(
    (normalized - start) /
      86400000,
  );
}

function seasonalDistance(
  left: number,
  right: number,
) {
  const direct =
    Math.abs(left - right);

  return Math.min(
    direct,
    366 - direct,
  );
}

export function buildSeasonalMemories(
  events: ChronologyEvent[],
  referenceDate = new Date(),
  windowDays = 14,
): SeasonalMemoryGroup[] {
  const referenceYear =
    referenceDate.getFullYear();

  const referenceDay =
    seasonalDay(referenceDate);

  const grouped =
    new Map<number, ChronologyEvent[]>();

  for (const event of events) {
    const time = parseTime(event.at);

    if (!time) continue;

    const date = new Date(time);
    const year = date.getFullYear();

    if (year >= referenceYear) continue;

    if (
      seasonalDistance(
        seasonalDay(date),
        referenceDay,
      ) > windowDays
    ) {
      continue;
    }

    const current =
      grouped.get(year) ?? [];

    current.push(event);
    grouped.set(year, current);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, yearEvents]) => {
      const sorted =
        [...yearEvents].sort(
          (a, b) =>
            parseTime(a.at) -
            parseTime(b.at),
        );

      return {
        year,
        eventCount: sorted.length,
        // Keep the preview quiet.
        // Full chronology still contains everything.
        events: sorted.slice(0, 8),
      };
    });
}
