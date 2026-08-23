import { getDatabase } from './database';

// aroundSameTimeV1
// Read-only temporal inference.
// NEVER write entity_links from this module.
// NEVER open SQLite independently.

export type TemporalRelationEntityType =
  | 'BOOK'
  | 'MEDIA'
  | 'GAME';

export type TemporalNeighbourKind =
  | 'BOOK'
  | 'MOVIE'
  | 'SERIES'
  | 'GAME';

export type TemporalNeighbour = {
  entityType:
    TemporalRelationEntityType;

  entityId: string;

  kind:
    TemporalNeighbourKind;

  title: string;

  distanceDays: number;

  deltaDays: number;

  evidenceCount: number;
};

type Row =
  Record<string, unknown>;

type TimelineEntity = {
  entityType:
    TemporalRelationEntityType;

  entityId: string;

  kind:
    TemporalNeighbourKind;

  title: string;

  moments: number[];
};

const DAY_MS =
  24 * 60 * 60 * 1000;

function text(
  value: unknown,
) {
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

  return null;
}

function timestamp(
  value: unknown,
) {
  const raw =
    text(value);

  if (!raw) {
    return null;
  }

  const parsed =
    Date.parse(raw);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function mediaKind(
  value: unknown,
): 'MOVIE' | 'SERIES' {
  return String(value ?? '')
    .toUpperCase() === 'SERIES'
    ? 'SERIES'
    : 'MOVIE';
}

function entityKey(
  type: TemporalRelationEntityType,
  id: string,
) {
  return type + ':' + id;
}

function addMoment(
  target: TimelineEntity,
  value: unknown,
) {
  const parsed =
    timestamp(value);

  if (parsed === null) {
    return;
  }

  if (
    !target.moments.includes(parsed)
  ) {
    target.moments.push(parsed);
  }
}

function nearestMoments(
  target: TimelineEntity,
  candidate: TimelineEntity,
) {
  let bestAbsolute =
    Number.POSITIVE_INFINITY;

  let bestSigned = 0;

  for (
    const targetTime of
    target.moments
  ) {
    for (
      const candidateTime of
      candidate.moments
    ) {
      const signed =
        candidateTime -
        targetTime;

      const absolute =
        Math.abs(signed);

      if (
        absolute <
        bestAbsolute
      ) {
        bestAbsolute =
          absolute;

        bestSigned =
          signed;
      }
    }
  }

  return {
    absolute:
      bestAbsolute,

    signed:
      bestSigned,
  };
}

export async function loadAroundSameTime(
  entityType:
    TemporalRelationEntityType,
  entityId: string,
  options: {
    windowDays?: number;
    limit?: number;
  } = {},
): Promise<TemporalNeighbour[]> {
  const database =
    await getDatabase();

  const windowDays =
    Math.max(
      1,
      options.windowDays ??
        45,
    );

  const limit =
    Math.max(
      1,
      options.limit ??
        5,
    );

  const [
    books,
    media,
    games,
    sessions,
    episodes,
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
          s.started_at,
          s.ended_at,
          a.book_id,
          a.media_id,
          g.game_id
        FROM time_sessions s

        JOIN activities a
          ON a.activity_id =
             s.activity_id

        LEFT JOIN games g
          ON g.playing_activity_id =
             a.activity_id

        WHERE
          a.book_id IS NOT NULL
          OR a.media_id IS NOT NULL
          OR g.game_id IS NOT NULL
      `,
    ),

    database.getAllAsync<Row>(
      `
        SELECT
          media_id,
          watched_at
        FROM series_episodes
        WHERE
          watched = 1
          AND watched_at IS NOT NULL
      `,
    ),
  ]);

  const entities =
    new Map<
      string,
      TimelineEntity
    >();

  function register(
    entity:
      TimelineEntity,
  ) {
    entities.set(
      entityKey(
        entity.entityType,
        entity.entityId,
      ),
      entity,
    );

    return entity;
  }

  for (const row of books) {
    const id =
      text(row.book_id);

    const title =
      text(row.title);

    if (!id || !title) {
      continue;
    }

    const entity =
      register({
        entityType:
          'BOOK',

        entityId:
          id,

        kind:
          'BOOK',

        title,

        moments: [],
      });

    addMoment(
      entity,
      row.started_on,
    );

    addMoment(
      entity,
      row.finished_on,
    );
  }

  for (const row of media) {
    const id =
      text(row.media_id);

    const title =
      text(row.title);

    if (!id || !title) {
      continue;
    }

    const entity =
      register({
        entityType:
          'MEDIA',

        entityId:
          id,

        kind:
          mediaKind(
            row.media_type,
          ),

        title,

        moments: [],
      });

    addMoment(
      entity,
      row.started_on,
    );

    addMoment(
      entity,
      row.completed_on,
    );
  }

  for (const row of games) {
    const id =
      text(row.game_id);

    const title =
      text(row.title);

    if (!id || !title) {
      continue;
    }

    const entity =
      register({
        entityType:
          'GAME',

        entityId:
          id,

        kind:
          'GAME',

        title,

        moments: [],
      });

    addMoment(
      entity,
      row.started_on,
    );

    addMoment(
      entity,
      row.finished_on,
    );
  }

  for (const row of sessions) {
    const bookId =
      text(row.book_id);

    const mediaId =
      text(row.media_id);

    const gameId =
      text(row.game_id);

    const entity =
      bookId
        ? entities.get(
            entityKey(
              'BOOK',
              bookId,
            ),
          )
        : mediaId
          ? entities.get(
              entityKey(
                'MEDIA',
                mediaId,
              ),
            )
          : gameId
            ? entities.get(
                entityKey(
                  'GAME',
                  gameId,
                ),
              )
            : null;

    if (!entity) {
      continue;
    }

    addMoment(
      entity,
      row.started_at,
    );

    addMoment(
      entity,
      row.ended_at,
    );
  }

  for (const row of episodes) {
    const mediaId =
      text(row.media_id);

    if (!mediaId) {
      continue;
    }

    const entity =
      entities.get(
        entityKey(
          'MEDIA',
          mediaId,
        ),
      );

    if (!entity) {
      continue;
    }

    addMoment(
      entity,
      row.watched_at,
    );
  }

  const target =
    entities.get(
      entityKey(
        entityType,
        entityId,
      ),
    );

  // No real chronological evidence:
  // no soft relation should be invented.
  if (
    !target ||
    target.moments.length === 0
  ) {
    return [];
  }

  const maxDistance =
    windowDays *
    DAY_MS;

  const neighbours:
    TemporalNeighbour[] =
      [];

  for (
    const candidate of
    entities.values()
  ) {
    if (
      candidate.entityType ===
        entityType &&
      candidate.entityId ===
        entityId
    ) {
      continue;
    }

    if (
      candidate.moments.length ===
      0
    ) {
      continue;
    }

    const nearest =
      nearestMoments(
        target,
        candidate,
      );

    if (
      !Number.isFinite(
        nearest.absolute,
      ) ||
      nearest.absolute >
        maxDistance
    ) {
      continue;
    }

    neighbours.push({
      entityType:
        candidate.entityType,

      entityId:
        candidate.entityId,

      kind:
        candidate.kind,

      title:
        candidate.title,

      distanceDays:
        Math.round(
          nearest.absolute /
          DAY_MS,
        ),

      deltaDays:
        Math.round(
          nearest.signed /
          DAY_MS,
        ),

      evidenceCount:
        candidate.moments.length,
    });
  }

  return neighbours
    .sort((a, b) => {
      if (
        a.distanceDays !==
        b.distanceDays
      ) {
        return (
          a.distanceDays -
          b.distanceDays
        );
      }

      if (
        b.evidenceCount !==
        a.evidenceCount
      ) {
        return (
          b.evidenceCount -
          a.evidenceCount
        );
      }

      return a.title
        .localeCompare(
          b.title,
          'hr',
        );
    })
    .slice(
      0,
      limit,
    );
}
