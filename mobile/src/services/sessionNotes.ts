import { getDatabase } from '../storage/database';

export type SessionStoppedEvent = {
  sessionId: string;
  activityId: string;
};

export type SessionCompletionEntityType =
  | 'BOOK'
  | 'MEDIA'
  | 'GAME'
  | 'TOPIC'
  | 'ENTRY'
  | 'FREQUENCY';

export type SessionCompletionEntity = {
  entityType: SessionCompletionEntityType;
  entityId: string;
  title: string;
  subtitle: string | null;
  source: 'ACTIVITY' | 'SESSION';
};

export type SessionBookPosition = {
  bookId: string;
  title: string;
  currentPage: number | null;
};

export type SessionCompletionDetails = {
  sessionId: string;
  activityId: string;
  activityLabel: string;
  activityType: string;
  contexts: SessionCompletionEntity[];
  book: SessionBookPosition | null;
};

type Listener = (event: SessionStoppedEvent) => void;
type Row = Record<string, string | number | null>;

const listeners = new Set<Listener>();

export function emitSessionStopped(event: SessionStoppedEvent) {
  listeners.forEach((listener) => listener(event));
}

export function subscribeSessionStopped(listener: Listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

async function databaseWithSessionNotes() {
  const database = await getDatabase() /* sqliteSingleConnectionV1 */;

  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS time_session_notes (' +
      'session_id TEXT PRIMARY KEY NOT NULL,' +
      'note TEXT NOT NULL,' +
      'created_at TEXT NOT NULL,' +
      'modified_at TEXT NOT NULL,' +
      'FOREIGN KEY (session_id) REFERENCES time_sessions(session_id) ON DELETE CASCADE' +
    ');' +
    'CREATE INDEX IF NOT EXISTS idx_time_session_notes_modified ' +
      'ON time_session_notes(modified_at DESC);',
  );

  return database;
}

async function databaseWithSessionIntelligence() {
  const database = await databaseWithSessionNotes();

  // sessionIntelligenceV1
  // Page number is intentionally stored separately from books.progress.
  // books.progress is a percentage; page 44 must never silently become 44%.
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS book_reading_positions (
      book_id TEXT PRIMARY KEY NOT NULL,
      current_page INTEGER NOT NULL CHECK(current_page >= 1),
      updated_from_session_id TEXT,
      created_at TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
      FOREIGN KEY (updated_from_session_id) REFERENCES time_sessions(session_id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_book_reading_positions_modified
      ON book_reading_positions(modified_at DESC);
  `);

  return database;
}

export async function saveSessionNote(sessionId: string, rawNote: string) {
  const note = rawNote.trim();

  if (!sessionId || !note) return;

  const database = await databaseWithSessionNotes();
  const now = new Date().toISOString();

  await database.runAsync(
    'INSERT INTO time_session_notes ' +
      '(session_id, note, created_at, modified_at) ' +
      'VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT(session_id) DO UPDATE SET ' +
      'note = excluded.note, modified_at = excluded.modified_at',
    sessionId,
    note,
    now,
    now,
  );
}

export async function getSessionNotes(sessionIds: string[]) {
  const ids = Array.from(new Set(sessionIds.filter(Boolean)));

  if (ids.length === 0) {
    return {} as Record<string, string>;
  }

  const database = await databaseWithSessionNotes();
  const placeholders = ids.map(() => '?').join(', ');

  const rows = await database.getAllAsync<{
    session_id: string;
    note: string;
  }>(
    'SELECT session_id, note FROM time_session_notes WHERE session_id IN (' +
      placeholders +
    ')',
    ...ids,
  );

  return rows.reduce<Record<string, string>>((result, row) => {
    result[String(row.session_id)] = String(row.note);
    return result;
  }, {});
}

function entryTitle(row: Row) {
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  if (title) return title;

  const content = String(row.content ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  return content.length <= 60
    ? content
    : `${content.slice(0, 57)}…`;
}

async function resolveEntity(
  database: Awaited<ReturnType<typeof getDatabase>>,
  entityType: SessionCompletionEntityType,
  entityId: string,
  source: SessionCompletionEntity['source'],
): Promise<SessionCompletionEntity | null> {
  if (entityType === 'BOOK') {
    const row = await database.getFirstAsync<Row>(
      'SELECT book_id, title, author FROM books WHERE book_id = ?',
      entityId,
    );
    return row
      ? {
          entityType,
          entityId,
          title: String(row.title),
          subtitle: row.author == null ? null : String(row.author),
          source,
        }
      : null;
  }

  if (entityType === 'MEDIA') {
    const row = await database.getFirstAsync<Row>(
      'SELECT media_id, title, media_type FROM media_items WHERE media_id = ?',
      entityId,
    );
    return row
      ? {
          entityType,
          entityId,
          title: String(row.title),
          subtitle: row.media_type == null ? null : String(row.media_type),
          source,
        }
      : null;
  }

  if (entityType === 'GAME') {
    const row = await database.getFirstAsync<Row>(
      'SELECT game_id, title, platform FROM games WHERE game_id = ?',
      entityId,
    );
    return row
      ? {
          entityType,
          entityId,
          title: String(row.title),
          subtitle: row.platform == null ? null : String(row.platform),
          source,
        }
      : null;
  }

  if (entityType === 'TOPIC') {
    const row = await database.getFirstAsync<Row>(
      'SELECT topic_id, name, description FROM topics WHERE topic_id = ?',
      entityId,
    );
    return row
      ? {
          entityType,
          entityId,
          title: String(row.name),
          subtitle: row.description == null ? null : String(row.description),
          source,
        }
      : null;
  }

  if (entityType === 'FREQUENCY') {
    const row = await database.getFirstAsync<Row>(
      'SELECT track_id, title, artist FROM audio_tracks WHERE track_id = ?',
      entityId,
    );
    return row
      ? {
          entityType,
          entityId,
          title: String(row.title),
          subtitle: row.artist == null ? null : String(row.artist),
          source,
        }
      : null;
  }

  const row = await database.getFirstAsync<Row>(
    'SELECT entry_id, title, content, entry_type FROM entries WHERE entry_id = ?',
    entityId,
  );

  return row
    ? {
        entityType: 'ENTRY',
        entityId,
        title: entryTitle(row),
        subtitle: row.entry_type == null ? null : String(row.entry_type),
        source,
      }
    : null;
}

function contextKey(entity: Pick<SessionCompletionEntity, 'entityType' | 'entityId'>) {
  return `${entity.entityType}:${entity.entityId}`;
}

export async function getSessionCompletionDetails(
  sessionId: string,
  activityId: string,
): Promise<SessionCompletionDetails> {
  const database = await databaseWithSessionIntelligence();

  const session = await database.getFirstAsync<Row>(
    `SELECT
       s.session_id,
       a.activity_id,
       a.label,
       a.activity_type,
       a.book_id,
       a.topic_id,
       a.media_id
     FROM time_sessions s
     JOIN activities a ON a.activity_id = s.activity_id
     WHERE s.session_id = ? AND a.activity_id = ?`,
    sessionId,
    activityId,
  );

  if (!session) {
    throw new Error('Spremljena sesija više nije dostupna.');
  }

  const contexts: SessionCompletionEntity[] = [];
  const seen = new Set<string>();

  const add = (entity: SessionCompletionEntity | null) => {
    if (!entity) return;
    const key = contextKey(entity);
    if (seen.has(key)) return;
    seen.add(key);
    contexts.push(entity);
  };

  if (session.book_id) {
    add(
      await resolveEntity(
        database,
        'BOOK',
        String(session.book_id),
        'ACTIVITY',
      ),
    );
  }

  if (session.media_id) {
    add(
      await resolveEntity(
        database,
        'MEDIA',
        String(session.media_id),
        'ACTIVITY',
      ),
    );
  }

  const game = await database.getFirstAsync<Row>(
    'SELECT game_id FROM games WHERE playing_activity_id = ?',
    activityId,
  );
  if (game?.game_id) {
    add(
      await resolveEntity(
        database,
        'GAME',
        String(game.game_id),
        'ACTIVITY',
      ),
    );
  }

  if (session.topic_id) {
    add(
      await resolveEntity(
        database,
        'TOPIC',
        String(session.topic_id),
        'ACTIVITY',
      ),
    );
  }

  const topicRows = await database.getAllAsync<Row>(
    `SELECT topic_id
     FROM topic_activity_links
     WHERE activity_id = ?
     ORDER BY position, created_at`,
    activityId,
  );
  for (const row of topicRows) {
    if (!row.topic_id) continue;
    add(
      await resolveEntity(
        database,
        'TOPIC',
        String(row.topic_id),
        'ACTIVITY',
      ),
    );
  }

  const directRows = await database.getAllAsync<Row>(
    `SELECT entity_type, entity_id
     FROM session_contexts
     WHERE session_id = ?
     ORDER BY created_at`,
    sessionId,
  );

  for (const row of directRows) {
    const entityType = String(row.entity_type) as SessionCompletionEntityType;
    if (
      !['BOOK', 'MEDIA', 'GAME', 'TOPIC', 'ENTRY', 'FREQUENCY'].includes(
        entityType,
      )
    ) {
      continue;
    }

    add(
      await resolveEntity(
        database,
        entityType,
        String(row.entity_id),
        'SESSION',
      ),
    );
  }

  const bookEntity = contexts.find((item) => item.entityType === 'BOOK');
  let book: SessionBookPosition | null = null;

  if (bookEntity) {
    const position = await database.getFirstAsync<{ current_page: number }>(
      'SELECT current_page FROM book_reading_positions WHERE book_id = ?',
      bookEntity.entityId,
    );

    book = {
      bookId: bookEntity.entityId,
      title: bookEntity.title,
      currentPage:
        position?.current_page == null
          ? null
          : Number(position.current_page),
    };
  }

  return {
    sessionId,
    activityId,
    activityLabel: String(session.label),
    activityType: String(session.activity_type),
    contexts,
    book,
  };
}

export async function saveBookReadingPage(
  sessionId: string | null,
  bookId: string,
  page: number,
) {
  if (!Number.isInteger(page) || page < 1 || page > 100000) {
    throw new Error('Stranica mora biti cijeli broj između 1 i 100000.');
  }

  const database = await databaseWithSessionIntelligence();
  const book = await database.getFirstAsync<{ book_id: string }>(
    'SELECT book_id FROM books WHERE book_id = ?',
    bookId,
  );

  if (!book) {
    throw new Error('Knjiga više nije dostupna.');
  }

  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO book_reading_positions
      (book_id, current_page, updated_from_session_id, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(book_id) DO UPDATE SET
       current_page = excluded.current_page,
       updated_from_session_id = excluded.updated_from_session_id,
       modified_at = excluded.modified_at`,
    bookId,
    page,
    sessionId,
    now,
    now,
  );

  // A page number is not a percentage. We only make the status smarter here;
  // books.progress remains untouched until total-page data exists.
  await database.runAsync(
    `UPDATE books
     SET reading_status = CASE
           WHEN reading_status = 'LATER' THEN 'IN_PROGRESS'
           ELSE reading_status
         END,
         modified_at = ?
     WHERE book_id = ?`,
    now,
    bookId,
  );


  const bookColumns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(books)');
  const bookColumnNames = new Set(bookColumns.map((column) => String(column.name)));
  if (!bookColumnNames.has('current_page')) {
    await database.execAsync('ALTER TABLE books ADD COLUMN current_page INTEGER');
  }
  if (!bookColumnNames.has('total_pages')) {
    await database.execAsync('ALTER TABLE books ADD COLUMN total_pages INTEGER');
  }

  await database.runAsync(
    `UPDATE books
     SET current_page = ?,
         progress = CASE
           WHEN total_pages IS NOT NULL AND total_pages > 0
           THEN MIN(100, MAX(0, ROUND((? * 100.0) / total_pages)))
           ELSE progress
         END,
         reading_status = CASE
           WHEN reading_status = 'LATER' THEN 'IN_PROGRESS'
           ELSE reading_status
         END,
         modified_at = ?
     WHERE book_id = ?`,
    page,
    page,
    now,
    bookId,
  );
}

export async function saveBookReadingPageDirect(
  bookId: string,
  page: number,
) {
  return saveBookReadingPage(null, bookId, page);
}

