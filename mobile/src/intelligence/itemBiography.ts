export type BiographyEntityKind =
  | 'BOOK'
  | 'MOVIE'
  | 'SERIES'
  | 'GAME';

export type BiographyEventKind =
  | 'ADDED'
  | 'STARTED'
  | 'SESSION'
  | 'PROGRESS'
  | 'COMPLETED'
  | 'DROPPED'
  | 'RESTARTED'
  | 'JINGLE_ON'
  | 'JINGLE_OFF'
  | 'NOTE'
  | 'STATUS'
  | 'COVER_CHANGED';

export type BiographyEventInput = {
  id: string;

  entityId: string;
  entityKind: BiographyEntityKind;

  kind: BiographyEventKind;

  occurredAt: string;

  label?: string | null;

  note?: string | null;

  durationSeconds?: number | null;

  progress?: number | null;

  status?: string | null;

  /**
   * Optional provenance:
   * manual / timer / TV Time / import / etc.
   */
  source?: string | null;
};

export type BiographyEvent =
  BiographyEventInput & {
    timestamp: number;
    dayKey: string;
    displayTitle: string;
    displayDetail: string | null;
};

export type ItemBiography = {
  entityId: string;
  entityKind: BiographyEntityKind;

  firstEventAt: string | null;
  lastEventAt: string | null;

  eventCount: number;
  activeDays: number;

  totalSessionSeconds: number;

  events: BiographyEvent[];
};

function validTimestamp(value: string) {
  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp)
    ? timestamp
    : null;
}

function dateKey(timestamp: number) {
  const date = new Date(timestamp);

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    date.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDuration(
  secondsRaw: number | null | undefined,
) {
  const seconds =
    Math.max(
      0,
      Math.round(secondsRaw ?? 0),
    );

  if (seconds <= 0) {
    return null;
  }

  const minutes =
    Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours =
    Math.floor(minutes / 60);

  const remainder =
    minutes % 60;

  if (remainder === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${remainder} min`;
}

function normalizeProgress(
  value: number | null | undefined,
) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(Number(value)),
    ),
  );
}

function eventPresentation(
  event: BiographyEventInput,
) {
  switch (event.kind) {
    case 'ADDED':
      return {
        title: 'Dodano u katalog',
        detail: event.label ?? null,
      };

    case 'STARTED':
      return {
        title: 'Započeto',
        detail: event.label ?? null,
      };

    case 'RESTARTED':
      return {
        title: 'Ponovno započeto',
        detail: event.label ?? null,
      };

    case 'SESSION': {
      const duration =
        formatDuration(
          event.durationSeconds,
        );

      return {
        title: 'Sesija',
        detail:
          event.note?.trim() ||
          duration ||
          event.label ||
          null,
      };
    }

    case 'PROGRESS': {
      const progress =
        normalizeProgress(
          event.progress,
        );

      return {
        title: 'Napredak',
        detail:
          progress !== null
            ? `${progress}%`
            : event.label ?? null,
      };
    }

    case 'COMPLETED':
      return {
        title: 'Završeno',
        detail: event.label ?? null,
      };

    case 'DROPPED':
      return {
        title: 'Odustao/la',
        detail: event.label ?? null,
      };

    case 'JINGLE_ON':
      return {
        title: 'Jingle',
        detail:
          event.note?.trim() ||
          event.label ||
          null,
      };

    case 'JINGLE_OFF':
      return {
        title: 'Maknuto iz Jingle',
        detail: event.label ?? null,
      };

    case 'NOTE':
      return {
        title: 'Bilješka',
        detail:
          event.note?.trim() ||
          event.label ||
          null,
      };

    case 'STATUS':
      return {
        title: 'Promjena statusa',
        detail:
          event.status ||
          event.label ||
          null,
      };

    case 'COVER_CHANGED':
      return {
        title: 'Promijenjena naslovnica',
        detail: event.label ?? null,
      };

    default:
      return {
        title:
          event.label ||
          'Aktivnost',
        detail: null,
      };
  }
}

function dedupeKey(
  event: BiographyEventInput,
  timestamp: number,
) {
  return [
    event.entityId,
    event.kind,
    timestamp,
    event.durationSeconds ?? '',
    event.progress ?? '',
    event.status ?? '',
    event.note?.trim() ?? '',
  ].join('|');
}


/**
 * itemBiographyV1
 *
 * PURE DOMAIN LOGIC.
 *
 * No SQLite.
 * No API.
 * No React.
 * No side effects.
 *
 * Storage adapters may feed this later,
 * but this module must never open a DB.
 */
export function buildItemBiography(
  eventsInput: BiographyEventInput[],
): ItemBiography | null {
  if (eventsInput.length === 0) {
    return null;
  }

  const normalized: BiographyEvent[] =
    [];

  const seen =
    new Set<string>();

  for (const input of eventsInput) {
    const timestamp =
      validTimestamp(
        input.occurredAt,
      );

    if (timestamp === null) {
      continue;
    }

    const key =
      dedupeKey(
        input,
        timestamp,
      );

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    const presentation =
      eventPresentation(input);

    normalized.push({
      ...input,

      timestamp,

      dayKey:
        dateKey(timestamp),

      displayTitle:
        presentation.title,

      displayDetail:
        presentation.detail,
    });
  }

  if (normalized.length === 0) {
    return null;
  }

  normalized.sort(
    (a, b) =>
      a.timestamp -
      b.timestamp,
  );

  const first =
    normalized[0];

  const last =
    normalized[
      normalized.length - 1
    ];

  if (!first || !last) {
    return null;
  }

  const activeDays =
    new Set(
      normalized.map(
        (event) => event.dayKey,
      ),
    ).size;

  const totalSessionSeconds =
    normalized.reduce(
      (sum, event) => {
        if (
          event.kind !== 'SESSION'
        ) {
          return sum;
        }

        return (
          sum +
          Math.max(
            0,
            Number(
              event.durationSeconds ??
                0,
            ),
          )
        );
      },
      0,
    );

  return {
    entityId: first.entityId,
    entityKind:
      first.entityKind,

    firstEventAt:
      first.occurredAt,

    lastEventAt:
      last.occurredAt,

    eventCount:
      normalized.length,

    activeDays,

    totalSessionSeconds,

    events: normalized,
  };
}


/**
 * Useful for UI where several things happened
 * on the same day.
 */
export function groupBiographyByDay(
  biography: ItemBiography,
) {
  const groups: Array<{
    dayKey: string;
    events: BiographyEvent[];
  }> = [];

  for (
    const event of biography.events
  ) {
    const previous =
      groups[
        groups.length - 1
      ];

    if (
      previous &&
      previous.dayKey ===
        event.dayKey
    ) {
      previous.events.push(event);
      continue;
    }

    groups.push({
      dayKey: event.dayKey,
      events: [event],
    });
  }

  return groups;
}


/**
 * Small summary for catalogue/details UI later.
 */
export function summarizeBiography(
  biography: ItemBiography,
) {
  const sessions =
    biography.events.filter(
      (event) =>
        event.kind === 'SESSION',
    ).length;

  const jingles =
    biography.events.filter(
      (event) =>
        event.kind === 'JINGLE_ON',
    ).length;

  const notes =
    biography.events.filter(
      (event) =>
        event.kind === 'NOTE' ||
        (
          event.kind === 'SESSION' &&
          Boolean(event.note?.trim())
        ),
    ).length;

  return {
    eventCount:
      biography.eventCount,

    activeDays:
      biography.activeDays,

    sessionCount:
      sessions,

    noteCount:
      notes,

    jingleCount:
      jingles,

    totalSessionSeconds:
      biography.totalSessionSeconds,
  };
}
