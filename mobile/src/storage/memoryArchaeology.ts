import { getDatabase } from './database';

import {
  rankForgottenThings as rankForgotten,
  pickForgottenThing,
  type ForgottenEntityKind,
  type ForgottenThing,
  type ForgottenThingInput,
} from '../intelligence/forgottenThings';

import {
  reconstructMoment as buildReconstruction,
  describeReconstruction,
  type MomentReconstruction,
  type ReconstructionEventInput,
} from '../intelligence/reconstruction';

import {
  buildEras,
} from '../intelligence/eras';

import {
  getJingleReason,
  type JingleReasonEntityType,
} from './jingleReasons';

// memoryArchaeologyV1
// Archaeology is an orchestration/read-model layer.
// It NEVER opens SQLite. Canonical getDatabase() only.

type Row =
  Record<string, unknown>;

type EntityStats = {
  seconds: number;
  sessions: number;
  lastAt: string | null;
};

type EntityMeta = {
  id: string;
  kind:
    | 'BOOK'
    | 'MOVIE'
    | 'SERIES'
    | 'GAME';
  title: string;
  favourite: boolean;
  startedAt: string | null;
  completedAt: string | null;
};

export type LostSignal = {
  item: ForgottenThing;

  targetAt: string;

  jingleReason: string | null;

  reconstruction:
    MomentReconstruction;

  reconstructionLines: string[];

  nearbyTrackIds: string[];

  nearbyTitles: string[];
};

function firstText(
  row: Row,
  keys: string[],
) {
  for (const key of keys) {
    const value =
      row[key];

    if (
      typeof value === 'string' &&
      value.trim()
    ) {
      return value.trim();
    }

    if (
      typeof value === 'number' &&
      Number.isFinite(value)
    ) {
      return String(value);
    }
  }

  return null;
}

function firstNumber(
  row: Row,
  keys: string[],
) {
  for (const key of keys) {
    const value =
      row[key];

    if (
      typeof value === 'number' &&
      Number.isFinite(value)
    ) {
      return value;
    }

    if (
      typeof value === 'string' &&
      value.trim() &&
      Number.isFinite(
        Number(value)
      )
    ) {
      return Number(value);
    }
  }

  return null;
}

function firstDate(
  row: Row,
  keys: string[],
) {
  for (const key of keys) {
    const value =
      firstText(
        row,
        [key],
      );

    if (!value) {
      continue;
    }

    const time =
      Date.parse(value);

    if (
      Number.isFinite(time)
    ) {
      return new Date(time)
        .toISOString();
    }
  }

  return null;
}

function boolValue(
  value: unknown,
) {
  if (
    value === true ||
    value === 1 ||
    value === '1'
  ) {
    return true;
  }

  if (
    typeof value === 'string'
  ) {
    return [
      'TRUE',
      'YES',
      'DA',
    ].includes(
      value.trim().toUpperCase(),
    );
  }

  return false;
}

function favouriteOf(
  row: Row,
) {
  return boolValue(
    row.favourite ??
    row.favorite ??
    row.is_favourite ??
    row.is_favorite,
  );
}

function mediaKind(
  row: Row,
): 'MOVIE' | 'SERIES' {
  const value =
    (
      firstText(
        row,
        [
          'media_type',
          'type',
          'kind',
        ],
      ) ?? ''
    ).toUpperCase();

  return value === 'SERIES'
    ? 'SERIES'
    : 'MOVIE';
}

function isActive(
  row: Row,
) {
  const statuses =
    Object.entries(row)
      .filter(([key]) =>
        key
          .toLowerCase()
          .includes('status')
      )
      .map(([, value]) =>
        String(value ?? '')
          .trim()
          .toUpperCase()
      );

  return statuses.some(
    (status) =>
      [
        'READING',
        'WATCHING',
        'PLAYING',
        'IN_PROGRESS',
        'CURRENT',
        'ACTIVE',
      ].includes(status),
  );
}

function progressOf(
  row: Row,
) {
  const direct =
    firstNumber(
      row,
      [
        'progress_percent',
        'progress_percentage',
        'progress',
      ],
    );

  if (direct !== null) {
    return Math.max(
      0,
      Math.min(
        100,
        direct,
      ),
    );
  }

  const currentPage =
    firstNumber(
      row,
      [
        'current_page',
        'pages_read',
      ],
    );

  const totalPages =
    firstNumber(
      row,
      [
        'page_count',
        'total_pages',
      ],
    );

  if (
    currentPage !== null &&
    totalPages &&
    totalPages > 0
  ) {
    return Math.max(
      0,
      Math.min(
        100,
        (currentPage / totalPages) *
          100,
      ),
    );
  }

  const watched =
    firstNumber(
      row,
      [
        'episodes_watched',
        'watched_episodes',
      ],
    );

  const totalEpisodes =
    firstNumber(
      row,
      [
        'total_episodes',
        'episode_count',
      ],
    );

  if (
    watched !== null &&
    totalEpisodes &&
    totalEpisodes > 0
  ) {
    return Math.max(
      0,
      Math.min(
        100,
        (watched / totalEpisodes) *
          100,
      ),
    );
  }

  return 0;
}

function laterDate(
  first: string | null,
  second: string | null,
) {
  if (!first) return second;
  if (!second) return first;

  return Date.parse(first) >=
    Date.parse(second)
    ? first
    : second;
}

function sessionSeconds(
  startedAt: string | null,
  endedAt: string | null,
) {
  if (
    !startedAt ||
    !endedAt
  ) {
    return 0;
  }

  const start =
    Date.parse(startedAt);

  const end =
    Date.parse(endedAt);

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start
  ) {
    return 0;
  }

  return Math.floor(
    (end - start) / 1000,
  );
}

function keyFor(
  kind: string,
  id: string,
) {
  return kind + ':' + id;
}

function eventEntity(
  row: Row,
  mediaById: Map<string, Row>,
  gameByActivity:
    Map<string, Row>,
) {
  const bookId =
    firstText(
      row,
      [
        '_book_id',
        'book_id',
      ],
    );

  if (bookId) {
    return {
      kind: 'BOOK' as const,
      id: bookId,
    };
  }

  const mediaId =
    firstText(
      row,
      [
        '_media_id',
        'media_id',
      ],
    );

  if (mediaId) {
    return {
      kind:
        mediaKind(
          mediaById.get(mediaId) ??
            {},
        ),
      id: mediaId,
    };
  }

  const activityId =
    firstText(
      row,
      [
        '_activity_id',
        'activity_id',
      ],
    );

  if (activityId) {
    const game =
      gameByActivity.get(
        activityId,
      );

    const gameId =
      game
        ? firstText(
            game,
            ['game_id', 'id'],
          )
        : null;

    if (gameId) {
      return {
        kind: 'GAME' as const,
        id: gameId,
      };
    }
  }

  return null;
}

function jingleType(
  kind:
    ForgottenEntityKind,
): JingleReasonEntityType | null {
  if (kind === 'BOOK') {
    return 'BOOK';
  }

  if (kind === 'GAME') {
    return 'GAME';
  }

  if (
    kind === 'MOVIE' ||
    kind === 'SERIES'
  ) {
    return 'MEDIA';
  }

  return null;
}

export async function loadLostSignal():
  Promise<LostSignal | null> {
  const database =
    await getDatabase();

  const [
    books,
    media,
    games,
    sessions,
    entries,
    soundtrackLinks,
  ] = await Promise.all([
    database.getAllAsync<Row>(
      'SELECT * FROM books',
    ),

    database.getAllAsync<Row>(
      'SELECT * FROM media_items',
    ),

    database.getAllAsync<Row>(
      'SELECT * FROM games',
    ),

    database.getAllAsync<Row>(
      `
        SELECT
          s.*,
          a.activity_id AS _activity_id,
          a.label AS _activity_label,
          a.activity_type AS _activity_type,
          a.book_id AS _book_id,
          a.media_id AS _media_id
        FROM time_sessions s
        JOIN activities a
          ON a.activity_id = s.activity_id
        ORDER BY s.started_at ASC
      `,
    ),

    database.getAllAsync<Row>(
      `
        SELECT
          e.*,
          a.activity_id AS _activity_id,
          a.book_id AS _book_id,
          a.media_id AS _media_id
        FROM entries e
        LEFT JOIN activities a
          ON a.activity_id = e.activity_id
        ORDER BY e.created_at ASC
      `,
    ),

    database.getAllAsync<Row>(
      'SELECT * FROM entry_soundtracks',
    ),
  ]);

  const mediaById =
    new Map<string, Row>();

  for (const row of media) {
    const id =
      firstText(
        row,
        ['media_id', 'id'],
      );

    if (id) {
      mediaById.set(id, row);
    }
  }

  const gameByActivity =
    new Map<string, Row>();

  for (const row of games) {
    const activityId =
      firstText(
        row,
        [
          'playing_activity_id',
          'activity_id',
        ],
      );

    if (activityId) {
      gameByActivity.set(
        activityId,
        row,
      );
    }
  }

  const stats =
    new Map<
      string,
      EntityStats
    >();

  for (
    let index = 0;
    index < sessions.length;
    index++
  ) {
    const row =
      sessions[index] ?? {};

    const entity =
      eventEntity(
        row,
        mediaById,
        gameByActivity,
      );

    if (!entity) {
      continue;
    }

    const startedAt =
      firstDate(
        row,
        ['started_at'],
      );

    const endedAt =
      firstDate(
        row,
        ['ended_at'],
      );

    const interactionAt =
      endedAt ??
      startedAt;

    const key =
      keyFor(
        entity.kind,
        entity.id,
      );

    const current =
      stats.get(key) ?? {
        seconds: 0,
        sessions: 0,
        lastAt: null,
      };

    current.seconds +=
      sessionSeconds(
        startedAt,
        endedAt,
      );

    current.sessions += 1;

    current.lastAt =
      laterDate(
        current.lastAt,
        interactionAt,
      );

    stats.set(
      key,
      current,
    );
  }

  const entityMeta =
    new Map<
      string,
      EntityMeta
    >();

  const candidates:
    ForgottenThingInput[] =
      [];

  function addCandidate(
    row: Row,
    kind:
      | 'BOOK'
      | 'MOVIE'
      | 'SERIES'
      | 'GAME',
    id: string,
    title: string,
  ) {
    const key =
      keyFor(kind, id);

    const measured =
      stats.get(key);

    const createdAt =
      firstDate(
        row,
        ['created_at'],
      );

    const startedAt =
      firstDate(
        row,
        [
          'started_at',
          'start_date',
          'started_date',
        ],
      );

    const completedAt =
      firstDate(
        row,
        [
          'completed_at',
          'finished_at',
          'finish_date',
          'completed_date',
        ],
      );

    const lastInteractionAt =
      measured?.lastAt ??
      completedAt ??
      startedAt ??
      createdAt ??
      firstDate(
        row,
        ['modified_at', 'updated_at'],
      );

    const favourite =
      favouriteOf(row);

    candidates.push({
      id,
      kind,
      title,
      createdAt,
      startedAt,
      completedAt,
      lastInteractionAt,
      totalMinutes:
        (measured?.seconds ?? 0) /
        60,
      sessionCount:
        measured?.sessions ?? 0,
      progress:
        progressOf(row),
      favourite,
      active:
        isActive(row),
    });

    entityMeta.set(
      key,
      {
        id,
        kind,
        title,
        favourite,
        startedAt,
        completedAt,
      },
    );
  }

  for (const row of books) {
    const id =
      firstText(
        row,
        ['book_id', 'id'],
      );

    const title =
      firstText(
        row,
        ['title', 'name'],
      );

    if (id && title) {
      addCandidate(
        row,
        'BOOK',
        id,
        title,
      );
    }
  }

  for (const row of media) {
    const id =
      firstText(
        row,
        ['media_id', 'id'],
      );

    const title =
      firstText(
        row,
        ['title', 'name'],
      );

    if (id && title) {
      addCandidate(
        row,
        mediaKind(row),
        id,
        title,
      );
    }
  }

  for (const row of games) {
    const id =
      firstText(
        row,
        ['game_id', 'id'],
      );

    const title =
      firstText(
        row,
        ['title', 'name'],
      );

    if (id && title) {
      addCandidate(
        row,
        'GAME',
        id,
        title,
      );
    }
  }

  const ranked =
    rankForgotten(candidates, {
      now: new Date(),
      minimumDormantDays: 60,
      includeActive: false,
      limit: 40,
    });

  const picked =
    pickForgottenThing(
      ranked,
    );

  if (!picked) {
    return null;
  }

  const targetAt =
    picked.lastInteractionAt ??
    picked.completedAt ??
    picked.startedAt ??
    picked.createdAt;

  if (!targetAt) {
    return null;
  }

  const events:
    ReconstructionEventInput[] =
      [];

  for (
    let index = 0;
    index < sessions.length;
    index++
  ) {
    const row =
      sessions[index] ?? {};

    const entity =
      eventEntity(
        row,
        mediaById,
        gameByActivity,
      );

    if (!entity) {
      continue;
    }

    const startedAt =
      firstDate(
        row,
        ['started_at'],
      );

    if (!startedAt) {
      continue;
    }

    const endedAt =
      firstDate(
        row,
        ['ended_at'],
      );

    const meta =
      entityMeta.get(
        keyFor(
          entity.kind,
          entity.id,
        ),
      );

    events.push({
      id:
        firstText(
          row,
          ['session_id', 'id'],
        ) ??
        'session-' + index,

      occurredAt:
        startedAt,

      kind:
        'SESSION',

      entityKind:
        entity.kind,

      entityId:
        entity.id,

      title:
        meta?.title ??
        firstText(
          row,
          ['_activity_label'],
        ) ??
        'Aktivnost',

      durationSeconds:
        sessionSeconds(
          startedAt,
          endedAt,
        ),

      activeFrom:
        meta?.startedAt ??
        null,

      activeUntil:
        meta?.completedAt ??
        null,

      favourite:
        meta?.favourite ??
        false,
    });
  }

  for (const [
    key,
    meta,
  ] of entityMeta) {
    if (meta.startedAt) {
      events.push({
        id:
          'started-' + key,
        occurredAt:
          meta.startedAt,
        kind:
          'STARTED',
        entityKind:
          meta.kind,
        entityId:
          meta.id,
        title:
          meta.title,
        activeFrom:
          meta.startedAt,
        activeUntil:
          meta.completedAt,
        favourite:
          meta.favourite,
      });
    }

    if (meta.completedAt) {
      events.push({
        id:
          'completed-' + key,
        occurredAt:
          meta.completedAt,
        kind:
          'COMPLETED',
        entityKind:
          meta.kind,
        entityId:
          meta.id,
        title:
          meta.title,
        activeFrom:
          meta.startedAt,
        activeUntil:
          meta.completedAt,
        favourite:
          meta.favourite,
      });
    }
  }

  const entryDates =
    new Map<
      string,
      string
    >();

  const entryEntityKeys =
    new Map<
      string,
      string
    >();

  for (
    let index = 0;
    index < entries.length;
    index++
  ) {
    const row =
      entries[index] ?? {};

    const entryId =
      firstText(
        row,
        ['entry_id', 'id'],
      );

    const occurredAt =
      firstDate(
        row,
        [
          'occurred_at',
          'created_at',
          'modified_at',
        ],
      );

    if (
      !entryId ||
      !occurredAt
    ) {
      continue;
    }

    entryDates.set(
      entryId,
      occurredAt,
    );

    const entity =
      eventEntity(
        row,
        mediaById,
        gameByActivity,
      );

    const content =
      firstText(
        row,
        ['content', 'body', 'text'],
      );

    const title =
      firstText(
        row,
        ['title'],
      ) ??
      content?.slice(0, 70) ??
      'Zapis';

    const meta =
      entity
        ? entityMeta.get(
            keyFor(
              entity.kind,
              entity.id,
            ),
          )
        : null;

    if (entity) {
      entryEntityKeys.set(
        entryId,
        keyFor(
          entity.kind,
          entity.id,
        ),
      );
    }

    events.push({
      id:
        'entry-' + entryId,

      occurredAt,

      kind:
        'ENTRY',

      entityKind:
        entity?.kind ??
        null,

      entityId:
        entity?.id ??
        null,

      title,

      note:
        content ?? null,

      favourite:
        meta?.favourite ??
        false,
    });
  }

  const eras =
    buildEras(
      events.filter(
        (event) =>
          Boolean(
            event.entityKind &&
            event.entityId,
          ),
      ) as any,
    );

  const reconstruction =
    buildReconstruction(
      events,
      eras,
      new Date(targetAt),
      {
      windowDays: 45,
      maxBefore: 4,
      maxAfter: 4,
      maxActiveItems: 6,
      maxNotes: 5,
    });

  // archaeologyTypeFixV1
  if (!reconstruction) {
    return null;
  }

  const reasonType =
    jingleType(
      picked.kind,
    );

  const reason =
    reasonType
      ? await getJingleReason(
          reasonType,
          picked.id,
        )
      : null;

  const targetMs =
    Date.parse(targetAt);

  const nearbyTrackIds =
    Array.from(
      new Set(
        soundtrackLinks
          .filter((link) => {
            const entryId =
              firstText(
                link,
                ['entry_id'],
              );

            if (!entryId) {
              return false;
            }

            const linkedEntity =
              entryEntityKeys.get(
                entryId,
              );

            if (
              linkedEntity ===
              keyFor(
                picked.kind,
                picked.id,
              )
            ) {
              return true;
            }

            const entryAt =
              entryDates.get(
                entryId,
              );

            if (!entryAt) {
              return false;
            }

            const distance =
              Math.abs(
                Date.parse(entryAt) -
                targetMs,
              );

            return (
              distance <=
              45 *
                24 *
                60 *
                60 *
                1000
            );
          })
          .map((link) =>
            firstText(
              link,
              ['track_id'],
            ),
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          ),
      ),
    );

  const nearbyTitles =
    Array.from(
      new Set([
        ...reconstruction.activeItems
          .map(
            (item) =>
              item.title,
          ),

        ...reconstruction.before
          .map(
            (event) =>
              event.title,
          ),

        ...reconstruction.after
          .map(
            (event) =>
              event.title,
          ),
      ]),
    )
      .filter(
        (title) =>
          title !==
          picked.title,
      )
      .slice(0, 5);

  return {
    item:
      picked,

    targetAt,

    jingleReason:
      reason?.reason ??
      null,

    reconstruction,

    reconstructionLines:
      describeReconstruction(
        reconstruction,
      ),

    nearbyTrackIds,

    nearbyTitles,
  };
}
