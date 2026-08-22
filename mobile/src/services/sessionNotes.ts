import { getDatabase } from '../storage/database';


export type SessionStoppedEvent = {
  sessionId: string;
  activityId: string;
};

type Listener = (event: SessionStoppedEvent) => void;

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
      'ON time_session_notes(modified_at DESC);'
  );

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
