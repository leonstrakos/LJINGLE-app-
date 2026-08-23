import { getDatabase } from './database';

// backdatedSessionsV1
// Creates real historical time_sessions.
// No new schema.
// No independent SQLite opener.

export type BackdatedEntityType =
  | 'BOOK'
  | 'MEDIA'
  | 'GAME';

export type BackdatedSessionInput = {
  entityType: BackdatedEntityType;
  entityId: string;
  startedAt: string;
  durationMinutes: number;
};

export type BackdatedSessionResult = {
  sessionId: string;
  activityId: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
};

type Database =
  Awaited<
    ReturnType<typeof getDatabase>
  >;

type Row =
  Record<
    string,
    string | number | null
  >;

function makeId(prefix: string) {
  return (
    prefix +
    '-' +
    Date.now().toString(36) +
    '-' +
    Math.random()
      .toString(36)
      .slice(2, 10)
  );
}

function validDate(value: string) {
  const parsed =
    new Date(value);

  return Number.isNaN(
    parsed.getTime(),
  )
    ? null
    : parsed;
}

async function ensureBookActivity(
  database: Database,
  bookId: string,
) {
  const existing =
    await database.getFirstAsync<Row>(
      `
        SELECT activity_id
        FROM activities
        WHERE
          book_id = ?
          AND activity_type = 'READING'
        LIMIT 1
      `,
      bookId,
    );

  if (existing?.activity_id) {
    return String(
      existing.activity_id,
    );
  }

  const book =
    await database.getFirstAsync<Row>(
      `
        SELECT title
        FROM books
        WHERE book_id = ?
      `,
      bookId,
    );

  if (!book?.title) {
    throw new Error(
      'Knjiga više ne postoji.'
    );
  }

  const activityId =
    makeId('activity');

  const now =
    new Date().toISOString();

  await database.runAsync(
    `
      INSERT INTO activities (
        activity_id,
        label,
        activity_type,
        book_id,
        topic_id,
        media_id,
        created_at,
        modified_at
      )
      VALUES (
        ?,
        ?,
        'READING',
        ?,
        NULL,
        NULL,
        ?,
        ?
      )
    `,
    activityId,
    String(book.title),
    bookId,
    now,
    now,
  );

  return activityId;
}

async function ensureMediaActivity(
  database: Database,
  mediaId: string,
) {
  const existing =
    await database.getFirstAsync<Row>(
      `
        SELECT activity_id
        FROM activities
        WHERE
          media_id = ?
          AND activity_type = 'WATCHING'
        LIMIT 1
      `,
      mediaId,
    );

  if (existing?.activity_id) {
    return String(
      existing.activity_id,
    );
  }

  const media =
    await database.getFirstAsync<Row>(
      `
        SELECT title
        FROM media_items
        WHERE media_id = ?
      `,
      mediaId,
    );

  if (!media?.title) {
    throw new Error(
      'Film ili serija više ne postoji.'
    );
  }

  const activityId =
    makeId('activity');

  const now =
    new Date().toISOString();

  await database.runAsync(
    `
      INSERT INTO activities (
        activity_id,
        label,
        activity_type,
        book_id,
        topic_id,
        media_id,
        created_at,
        modified_at
      )
      VALUES (
        ?,
        ?,
        'WATCHING',
        NULL,
        NULL,
        ?,
        ?,
        ?
      )
    `,
    activityId,
    String(media.title),
    mediaId,
    now,
    now,
  );

  return activityId;
}

async function ensureGameActivity(
  database: Database,
  gameId: string,
) {
  const game =
    await database.getFirstAsync<Row>(
      `
        SELECT
          title,
          playing_activity_id
        FROM games
        WHERE game_id = ?
      `,
      gameId,
    );

  if (!game?.title) {
    throw new Error(
      'Igra više ne postoji.'
    );
  }

  if (
    game.playing_activity_id
  ) {
    return String(
      game.playing_activity_id,
    );
  }

  const activityId =
    makeId('activity');

  const now =
    new Date().toISOString();

  await database.runAsync(
    `
      INSERT INTO activities (
        activity_id,
        label,
        activity_type,
        book_id,
        topic_id,
        media_id,
        created_at,
        modified_at
      )
      VALUES (
        ?,
        ?,
        'PLAYING',
        NULL,
        NULL,
        NULL,
        ?,
        ?
      )
    `,
    activityId,
    String(game.title),
    now,
    now,
  );

  await database.runAsync(
    `
      UPDATE games
      SET
        playing_activity_id = ?,
        modified_at = ?
      WHERE game_id = ?
    `,
    activityId,
    now,
    gameId,
  );

  return activityId;
}

async function ensureActivity(
  database: Database,
  entityType: BackdatedEntityType,
  entityId: string,
) {
  if (entityType === 'BOOK') {
    return ensureBookActivity(
      database,
      entityId,
    );
  }

  if (entityType === 'MEDIA') {
    return ensureMediaActivity(
      database,
      entityId,
    );
  }

  return ensureGameActivity(
    database,
    entityId,
  );
}

export async function createBackdatedSession(
  input: BackdatedSessionInput,
): Promise<BackdatedSessionResult> {
  const database =
    await getDatabase();

  const started =
    validDate(
      input.startedAt,
    );

  if (!started) {
    throw new Error(
      'Datum ili vrijeme nisu valjani.'
    );
  }

  const durationMinutes =
    Math.trunc(
      Number(
        input.durationMinutes,
      ),
    );

  if (
    !Number.isFinite(
      durationMinutes,
    ) ||
    durationMinutes < 1
  ) {
    throw new Error(
      'Trajanje mora biti barem 1 minuta.'
    );
  }

  if (
    durationMinutes >
    24 * 60
  ) {
    throw new Error(
      'Jedna sesija ne može trajati više od 24 sata.'
    );
  }

  const ended =
    new Date(
      started.getTime() +
        durationMinutes *
          60 *
          1000,
    );

  const now =
    new Date();

  if (
    ended.getTime() >
    now.getTime() +
      60 * 1000
  ) {
    throw new Error(
      'Backdated sesija ne može završiti u budućnosti.'
    );
  }

  const activityId =
    await ensureActivity(
      database,
      input.entityType,
      input.entityId,
    );

  const startedAt =
    started.toISOString();

  const endedAt =
    ended.toISOString();

  const overlap =
    await database.getFirstAsync<Row>(
      `
        SELECT session_id
        FROM time_sessions
        WHERE
          activity_id = ?
          AND julianday(started_at) <
              julianday(?)
          AND julianday(
                COALESCE(
                  ended_at,
                  ?
                )
              ) >
              julianday(?)
        LIMIT 1
      `,
      activityId,
      endedAt,
      now.toISOString(),
      startedAt,
    );

  if (overlap?.session_id) {
    throw new Error(
      'Ta aktivnost već ima sesiju koja se preklapa s ovim vremenom.'
    );
  }

  const sessionId =
    makeId('session');

  const createdAt =
    now.toISOString();

  await database.runAsync(
    `
      INSERT INTO time_sessions (
        session_id,
        activity_id,
        started_at,
        ended_at,
        created_at,
        modified_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    sessionId,
    activityId,
    startedAt,
    endedAt,
    createdAt,
    createdAt,
  );

  return {
    sessionId,
    activityId,
    startedAt,
    endedAt,
    durationMinutes,
  };
}
