import { emitSessionStopped } from '../services/sessionNotes'; // sessionNotesV1
import type { SQLiteDatabase } from 'expo-sqlite';

import type { ActivityTimerResponse, TimeSessionResponse } from '../types/activity';
import type { BookRequest, BookResponse, PagedBooks } from '../types/book';
import type { Entry, EntryRequest } from '../types/entry';
import type { HistorySession, HistorySessionPage } from '../types/history';
import type {
  MediaRequest,
  MediaResponse,
  MediaTimerResponse,
} from '../types/media';
import type { DailyActivityTime, DailyTimeResponse } from '../types/stats';
import type {
  TopicActivityRequest,
  TopicActivityResponse,
  TopicRequest,
  TopicResponse,
} from '../types/topic';
import type { GameRequest, GameResponse } from '../games/types/game';
import type {
  CollectionDetail,
  CollectionItem,
  CollectionRequest,
  CollectionSummary,
  EntityLink,
  EntityReference,
  EntityReferenceType,
  RelationType,
} from '../types/collection';
import { getDatabase } from './database';

type SqlRow = Record<string, string | number | null>;

export class LocalApiFailure extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'LocalApiFailure';
  }
}

function identifier() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function requiredText(value: unknown, label: string) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new LocalApiFailure(`${label} je obvezan.`, 400);
  return text;
}

function booleanValue(value: unknown) {
  return value ? 1 : 0;
}

function mapBook(row: SqlRow): BookResponse {
  return {
    bookId: String(row.book_id),
    title: String(row.title),
    author: String(row.author),
    isbn: String(row.isbn),
    publishedYear: Number(row.published_year),
    readingStatus: row.reading_status as BookResponse['readingStatus'],
    progress: Number(row.progress),
    enjoyment: row.enjoyment as BookResponse['enjoyment'],
    favourite: Boolean(row.favourite),
    startedOn: row.started_on as string | null,
    finishedOn: row.finished_on as string | null,
  };
}

function mapTopic(row: SqlRow): TopicResponse {
  return {
    topicId: String(row.topic_id),
    name: String(row.name),
    description: row.description as string | null,
    activityCount: Number(row.activity_count ?? 0),
    createdAt: String(row.created_at),
    modifiedAt: String(row.modified_at),
  };
}

function mapTopicActivity(row: SqlRow): TopicActivityResponse {
  return {
    activityId: String(row.activity_id),
    label: String(row.label),
    activityType: row.activity_type as TopicActivityResponse['activityType'],
    bookId: row.book_id as string | null,
    topicId: row.topic_id as string | null,
    createdAt: String(row.created_at),
    modifiedAt: String(row.modified_at),
  };
}

function mapGame(row: SqlRow): GameResponse {
  return {
    gameId: String(row.game_id),
    title: String(row.title),
    developer: row.developer as string | null,
    platform: String(row.platform),
    releaseYear: row.release_year === null ? null : Number(row.release_year),
    gameStatus: row.game_status as GameResponse['gameStatus'],
    progress: Number(row.progress),
    enjoyment: row.enjoyment as GameResponse['enjoyment'],
    favourite: Boolean(row.favourite),
    // gamesNotesImportV1
    dnf: Boolean(row.dnf),
    startedOn: row.started_on as string | null,
    finishedOn: row.finished_on as string | null,
    igdbId: row.igdb_id === null ? null : Number(row.igdb_id),
    coverUrl: row.cover_url as string | null,
    playingActivityId: row.playing_activity_id as string | null,
  };
}

function mapMedia(row: SqlRow): MediaResponse {
  return {
    mediaId: String(row.media_id),
    mediaType: row.media_type as MediaResponse['mediaType'],
    tmdbId: row.tmdb_id === null ? null : Number(row.tmdb_id),
    title: String(row.title),
    originalTitle: row.original_title as string | null,
    overview: row.overview as string | null,
    posterPath: row.poster_path as string | null,
    backdropPath: row.backdrop_path as string | null,
    releaseYear: row.release_year === null ? null : Number(row.release_year),
    watchStatus: row.watch_status as MediaResponse['watchStatus'],
    progress: Number(row.progress),
    enjoyment: row.enjoyment as MediaResponse['enjoyment'],
    favourite: Boolean(row.favourite),
    startedOn: row.started_on as string | null,
    completedOn: row.completed_on as string | null,
  };
}

function mapEntry(row: SqlRow): Entry {
  return {
    entryId: String(row.entry_id),
    title: row.title as string | null,
    content: String(row.content),
    type: row.entry_type as Entry['type'],
    bookId: row.book_id as string | null,
    topicId: row.topic_id as string | null,
    activityId: row.activity_id as string | null,
    createdAt: String(row.created_at),
    modifiedAt: String(row.modified_at),
  };
}

async function rowOr404(database: SQLiteDatabase, table: string, column: string, id: string) {
  const allowed = new Set(['books:book_id', 'topics:topic_id', 'games:game_id', 'media_items:media_id']);
  if (!allowed.has(`${table}:${column}`)) throw new LocalApiFailure('Neispravan lokalni upit.');
  const row = await database.getFirstAsync<SqlRow>(
    `SELECT * FROM ${table} WHERE ${column} = ?`,
    id,
  );
  if (!row) throw new LocalApiFailure('Traženi zapis ne postoji.', 404);
  return row;
}

function parsePayload<T>(options?: RequestInit): T {
  if (typeof options?.body !== 'string') return {} as T;
  try {
    return JSON.parse(options.body) as T;
  } catch {
    throw new LocalApiFailure('Podaci zahtjeva nisu valjani.');
  }
}

async function timerForActivity(
  database: SQLiteDatabase,
  activityId: string,
): Promise<ActivityTimerResponse> {
  const activity = await database.getFirstAsync<SqlRow>(
    'SELECT * FROM activities WHERE activity_id = ?',
    activityId,
  );
  if (!activity) throw new LocalApiFailure('Aktivnost ne postoji.', 404);

  const sessions = await database.getAllAsync<SqlRow>(
    'SELECT * FROM time_sessions WHERE activity_id = ? ORDER BY started_at DESC',
    activityId,
  );
  const now = Date.now();
  const active = sessions.find((session) => session.ended_at === null) ?? null;
  const completedSeconds = sessions
    .filter((session) => session.ended_at !== null)
    .reduce(
      (sum, session) =>
        sum +
        Math.max(
          0,
          Math.floor(
            (Date.parse(String(session.ended_at)) - Date.parse(String(session.started_at))) / 1000,
          ),
        ),
      0,
    );
  const activeSeconds = active
    ? Math.max(0, Math.floor((now - Date.parse(String(active.started_at))) / 1000))
    : 0;

  return {
    activityId,
    label: String(activity.label),
    activityType: activity.activity_type as ActivityTimerResponse['activityType'],
    bookId: activity.book_id as string | null,
    topicId: activity.topic_id as string | null,
    running: active !== null,
    activeSessionId: active ? String(active.session_id) : null,
    activeStartedAt: active ? String(active.started_at) : null,
    completedSeconds,
    totalSeconds: completedSeconds + activeSeconds,
  };
}

async function startActivity(database: SQLiteDatabase, activityId: string) {
  // tvtimeV3FastRecentDismiss — restarting makes it eligible for Continue again.
  await database.runAsync('DELETE FROM activity_recent_dismissals WHERE activity_id = ?', activityId);
  const existing = await database.getFirstAsync<SqlRow>(
    'SELECT session_id FROM time_sessions WHERE activity_id = ? AND ended_at IS NULL',
    activityId,
  );
  if (!existing) {
    const now = nowIso();
    await database.runAsync(
      `INSERT INTO time_sessions
        (session_id, activity_id, started_at, ended_at, created_at, modified_at)
       VALUES (?, ?, ?, NULL, ?, ?)`,
      identifier(),
      activityId,
      now,
      now,
      now,
    );
  }
  return timerForActivity(database, activityId);
}

async function stopActivity(database: SQLiteDatabase, activityId: string) {
  // sessionNotesV1 ? capture exact session before ending it.
  const activeSession = await database.getFirstAsync<{ session_id: string }>(
    'SELECT session_id FROM time_sessions WHERE activity_id = ? AND ended_at IS NULL',
    activityId,
  );

  const now = nowIso();

  await database.runAsync(
    'UPDATE time_sessions SET ended_at = ?, modified_at = ? WHERE activity_id = ? AND ended_at IS NULL',
    now,
    now,
    activityId,
  );

  if (activeSession?.session_id) {
    emitSessionStopped({
      sessionId: String(activeSession.session_id),
      activityId,
    });
  }

  return timerForActivity(database, activityId);
}

async function ensureReadingActivity(database: SQLiteDatabase, bookId: string) {
  const existing = await database.getFirstAsync<SqlRow>(
    `SELECT * FROM activities WHERE book_id = ? AND activity_type = 'READING'`,
    bookId,
  );
  if (existing) return String(existing.activity_id);
  const book = await rowOr404(database, 'books', 'book_id', bookId);
  const id = identifier();
  const now = nowIso();
  await database.runAsync(
    `INSERT INTO activities
      (activity_id, label, activity_type, book_id, topic_id, media_id, created_at, modified_at)
     VALUES (?, ?, 'READING', ?, NULL, NULL, ?, ?)`,
    id,
    `Čitanje — ${String(book.title)}`,
    bookId,
    now,
    now,
  );
  return id;
}

async function ensureGameActivity(database: SQLiteDatabase, gameId: string) {
  const game = await rowOr404(database, 'games', 'game_id', gameId);
  if (game.playing_activity_id) return String(game.playing_activity_id);
  const id = identifier();
  const now = nowIso();
  await database.runAsync(
    `INSERT INTO activities
      (activity_id, label, activity_type, book_id, topic_id, media_id, created_at, modified_at)
     VALUES (?, ?, 'PLAYING', NULL, NULL, NULL, ?, ?)`,
    id,
    `Igranje — ${String(game.title)}`,
    now,
    now,
  );
  await database.runAsync(
    'UPDATE games SET playing_activity_id = ?, modified_at = ? WHERE game_id = ?',
    id,
    now,
    gameId,
  );
  return id;
}

async function ensureMediaActivity(database: SQLiteDatabase, mediaId: string) {
  const existing = await database.getFirstAsync<SqlRow>(
    `SELECT * FROM activities WHERE media_id = ? AND activity_type = 'WATCHING'`,
    mediaId,
  );
  if (existing) return String(existing.activity_id);
  const media = await rowOr404(database, 'media_items', 'media_id', mediaId);
  const id = identifier();
  const now = nowIso();
  await database.runAsync(
    `INSERT INTO activities
      (activity_id, label, activity_type, book_id, topic_id, media_id, created_at, modified_at)
     VALUES (?, ?, 'WATCHING', NULL, NULL, ?, ?, ?)`,
    id,
    `Gledanje — ${String(media.title)}`,
    mediaId,
    now,
    now,
  );
  return id;
}

function emptyTimer(label: string, type: ActivityTimerResponse['activityType'], bookId: string | null) {
  return {
    activityId: null,
    label,
    activityType: type,
    bookId,
    topicId: null,
    running: false,
    activeSessionId: null,
    activeStartedAt: null,
    completedSeconds: 0,
    totalSeconds: 0,
  } satisfies ActivityTimerResponse;
}

async function getReadingTimer(database: SQLiteDatabase, bookId: string) {
  const book = await rowOr404(database, 'books', 'book_id', bookId);
  const activity = await database.getFirstAsync<SqlRow>(
    `SELECT activity_id FROM activities WHERE book_id = ? AND activity_type = 'READING'`,
    bookId,
  );
  return activity
    ? timerForActivity(database, String(activity.activity_id))
    : emptyTimer(`Čitanje — ${String(book.title)}`, 'READING', bookId);
}

async function gameTimer(database: SQLiteDatabase, gameId: string) {
  const game = await rowOr404(database, 'games', 'game_id', gameId);
  return game.playing_activity_id
    ? timerForActivity(database, String(game.playing_activity_id))
    : emptyTimer(`Igranje — ${String(game.title)}`, 'PLAYING', null);
}

async function mediaTimer(database: SQLiteDatabase, mediaId: string): Promise<MediaTimerResponse> {
  const media = await rowOr404(database, 'media_items', 'media_id', mediaId);
  const activity = await database.getFirstAsync<SqlRow>(
    `SELECT activity_id FROM activities WHERE media_id = ? AND activity_type = 'WATCHING'`,
    mediaId,
  );
  const timer = activity
    ? await timerForActivity(database, String(activity.activity_id))
    : emptyTimer(`Gledanje — ${String(media.title)}`, 'WATCHING', null);
  return {
    activityId: timer.activityId,
    label: timer.label,
    activityType: 'WATCHING',
    mediaId,
    running: timer.running,
    activeSessionId: timer.activeSessionId,
    activeStartedAt: timer.activeStartedAt,
    completedSeconds: timer.completedSeconds,
    totalSeconds: timer.totalSeconds,
  };
}

function dateWindow(dateText?: string) {
  const fallback = new Date();
  const parts = dateText?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const start = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const yyyy = start.getFullYear();
  const mm = String(start.getMonth() + 1).padStart(2, '0');
  const dd = String(start.getDate()).padStart(2, '0');
  return { start: start.getTime(), end: end.getTime(), date: `${yyyy}-${mm}-${dd}` };
}

function overlapSeconds(startedAt: string, endedAt: string | null, start: number, end: number) {
  const from = Math.max(Date.parse(startedAt), start);
  const to = Math.min(endedAt ? Date.parse(endedAt) : Date.now(), end);
  return Math.max(0, Math.floor((to - from) / 1000));
}

async function dailyStats(database: SQLiteDatabase, url: URL): Promise<DailyTimeResponse> {
  const window = dateWindow(url.searchParams.get('date') ?? undefined);
  const zone = url.searchParams.get('zone') ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const rows = await database.getAllAsync<SqlRow>(
    `SELECT s.*, a.label, a.activity_type, a.book_id
     FROM time_sessions s JOIN activities a ON a.activity_id = s.activity_id
     WHERE s.started_at < ? AND (s.ended_at IS NULL OR s.ended_at > ?)
     ORDER BY s.started_at DESC`,
    new Date(window.end).toISOString(),
    new Date(window.start).toISOString(),
  );
  const activities = new Map<string, DailyActivityTime>();
  rows.forEach((row) => {
    const seconds = overlapSeconds(
      String(row.started_at),
      row.ended_at as string | null,
      window.start,
      window.end,
    );
    const activityId = String(row.activity_id);
    const current = activities.get(activityId);
    if (current) {
      current.seconds += seconds;
      current.running ||= row.ended_at === null;
    } else {
      activities.set(activityId, {
        activityId,
        label: String(row.label),
        activityType: String(row.activity_type),
        bookId: row.book_id as string | null,
        seconds,
        running: row.ended_at === null,
      });
    }
  });
  const result = Array.from(activities.values()).sort((left, right) => right.seconds - left.seconds);
  return {
    date: window.date,
    zone,
    totalSeconds: result.reduce((sum, item) => sum + item.seconds, 0),
    activities: result,
  };
}

async function history(database: SQLiteDatabase, url: URL): Promise<HistorySessionPage> {
  const page = Math.max(0, Number(url.searchParams.get('page') ?? 0));
  const size = Math.max(1, Number(url.searchParams.get('size') ?? 30));
  const requestedDate = url.searchParams.get('date') ?? undefined;
  const window = requestedDate ? dateWindow(requestedDate) : null;
  const rows = await database.getAllAsync<SqlRow>(
    `SELECT s.*, a.label AS activity_label, a.activity_type, a.book_id, a.topic_id
     FROM time_sessions s JOIN activities a ON a.activity_id = s.activity_id
     ORDER BY s.started_at DESC`,
  );
  const filtered = window
    ? rows.filter(
        (row) =>
          overlapSeconds(
            String(row.started_at),
            row.ended_at as string | null,
            window.start,
            window.end,
          ) > 0,
      )
    : rows;
  const totalElements = filtered.length;
  const content: HistorySession[] = filtered.slice(page * size, page * size + size).map((row) => ({
    sessionId: String(row.session_id),
    activityId: String(row.activity_id),
    activityLabel: String(row.activity_label),
    activityType: String(row.activity_type),
    bookId: row.book_id as string | null,
    topicId: row.topic_id as string | null,
    startedAt: String(row.started_at),
    endedAt: row.ended_at as string | null,
    durationSeconds: window
      ? overlapSeconds(
          String(row.started_at),
          row.ended_at as string | null,
          window.start,
          window.end,
        )
      : Math.max(
          0,
          Math.floor(
            ((row.ended_at ? Date.parse(String(row.ended_at)) : Date.now()) -
              Date.parse(String(row.started_at))) /
              1000,
          ),
        ),
    running: row.ended_at === null,
  }));
  const totalPages = Math.ceil(totalElements / size);
  return {
    content,
    page,
    size,
    totalElements,
    totalPages,
    first: page === 0,
    last: page >= Math.max(0, totalPages - 1),
  };
}

async function handleBooks(database: SQLiteDatabase, url: URL, method: string, options?: RequestInit) {
  const match = url.pathname.match(/^\/books\/([^/]+)$/);
  if (!match && method === 'GET') {
    const rows = await database.getAllAsync<SqlRow>('SELECT * FROM books ORDER BY title COLLATE NOCASE');
    const books = rows.map(mapBook);
    if (!url.searchParams.has('page') && !url.searchParams.has('size')) return books;
    const page = Math.max(0, Number(url.searchParams.get('page') ?? 0));
    const size = Math.max(1, Number(url.searchParams.get('size') ?? 10));
    const totalPages = Math.ceil(books.length / size);
    return {
      content: books.slice(page * size, page * size + size),
      page,
      size,
      totalElements: books.length,
      totalPages,
      first: page === 0,
      last: page >= Math.max(0, totalPages - 1),
    } satisfies PagedBooks;
  }
  if (!match && method === 'POST') {
    const payload = parsePayload<BookRequest>(options);
    const id = identifier();
    const now = nowIso();
    await database.runAsync(
      `INSERT INTO books
       (book_id, title, author, isbn, published_year, reading_status, progress, enjoyment,
        favourite, started_on, finished_on, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      requiredText(payload.title, 'Naslov'),
      requiredText(payload.author, 'Autor'),
      requiredText(payload.isbn, 'ISBN'),
      Number(payload.publishedYear),
      payload.readingStatus ?? 'LATER',
      Number(payload.progress ?? 0),
      payload.enjoyment ?? null,
      booleanValue(payload.favourite),
      payload.startedOn ?? null,
      payload.finishedOn ?? null,
      now,
      now,
    );
    return mapBook(await rowOr404(database, 'books', 'book_id', id));
  }
  if (!match) throw new LocalApiFailure('Nepoznata putanja.', 404);
  const id = decodeURIComponent(match[1]!);
  if (method === 'GET') return mapBook(await rowOr404(database, 'books', 'book_id', id));
  if (method === 'PUT') {
    await rowOr404(database, 'books', 'book_id', id);
    const payload = parsePayload<BookRequest>(options);
    const now = nowIso();
    await database.runAsync(
      `UPDATE books SET title=?, author=?, isbn=?, published_year=?, reading_status=?, progress=?,
       enjoyment=?, favourite=?, started_on=?, finished_on=?, modified_at=? WHERE book_id=?`,
      requiredText(payload.title, 'Naslov'),
      requiredText(payload.author, 'Autor'),
      requiredText(payload.isbn, 'ISBN'),
      Number(payload.publishedYear),
      payload.readingStatus,
      Number(payload.progress),
      payload.enjoyment ?? null,
      booleanValue(payload.favourite),
      payload.startedOn ?? null,
      payload.finishedOn ?? null,
      now,
      id,
    );
    await database.runAsync(
      `UPDATE activities SET label = ?, modified_at = ?
       WHERE book_id = ? AND activity_type = 'READING'`,
      `Čitanje — ${payload.title.trim()}`,
      now,
      id,
    );
    return mapBook(await rowOr404(database, 'books', 'book_id', id));
  }
  if (method === 'DELETE') {
    await rowOr404(database, 'books', 'book_id', id);
    await database.runAsync('DELETE FROM books WHERE book_id = ?', id);
    return undefined;
  }
  throw new LocalApiFailure('Metoda nije podržana.', 405);
}

async function handleTopics(database: SQLiteDatabase, url: URL, method: string, options?: RequestInit) {
  const activityMatch = url.pathname.match(/^\/topics\/([^/]+)\/activities$/);
  if (activityMatch) {
    const topicId = decodeURIComponent(activityMatch[1]!);
    await rowOr404(database, 'topics', 'topic_id', topicId);
    if (method === 'GET') {
      const rows = await database.getAllAsync<SqlRow>(
        'SELECT * FROM activities WHERE topic_id = ? ORDER BY label COLLATE NOCASE',
        topicId,
      );
      return rows.map(mapTopicActivity);
    }
    if (method === 'POST') {
      const payload = parsePayload<TopicActivityRequest>(options);
      const id = identifier();
      const now = nowIso();
      await database.runAsync(
        `INSERT INTO activities
         (activity_id, label, activity_type, book_id, topic_id, media_id, created_at, modified_at)
         VALUES (?, ?, ?, NULL, ?, NULL, ?, ?)`,
        id,
        requiredText(payload.label, 'Naziv aktivnosti'),
        payload.activityType,
        topicId,
        now,
        now,
      );
      const row = await database.getFirstAsync<SqlRow>(
        'SELECT * FROM activities WHERE activity_id = ?',
        id,
      );
      return mapTopicActivity(row!);
    }
  }

  const match = url.pathname.match(/^\/topics\/([^/]+)$/);
  const select = `SELECT t.*,
    (SELECT COUNT(*) FROM activities a WHERE a.topic_id = t.topic_id) AS activity_count
    FROM topics t`;
  if (!match && method === 'GET') {
    const rows = await database.getAllAsync<SqlRow>(`${select} ORDER BY t.name COLLATE NOCASE`);
    return rows.map(mapTopic);
  }
  if (!match && method === 'POST') {
    const payload = parsePayload<TopicRequest>(options);
    const id = identifier();
    const now = nowIso();
    try {
      await database.runAsync(
        `INSERT INTO topics (topic_id, name, description, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?)`,
        id,
        requiredText(payload.name, 'Naziv teme'),
        payload.description?.trim() || null,
        now,
        now,
      );
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes('unique')) {
        throw new LocalApiFailure('Tema s tim nazivom već postoji.', 409);
      }
      throw error;
    }
    return mapTopic((await database.getFirstAsync<SqlRow>(`${select} WHERE t.topic_id = ?`, id))!);
  }
  if (!match) throw new LocalApiFailure('Nepoznata putanja.', 404);
  const id = decodeURIComponent(match[1]!);
  if (method === 'GET') {
    const row = await database.getFirstAsync<SqlRow>(`${select} WHERE t.topic_id = ?`, id);
    if (!row) throw new LocalApiFailure('Tema ne postoji.', 404);
    return mapTopic(row);
  }
  if (method === 'PUT') {
    await rowOr404(database, 'topics', 'topic_id', id);
    const payload = parsePayload<TopicRequest>(options);
    await database.runAsync(
      'UPDATE topics SET name=?, description=?, modified_at=? WHERE topic_id=?',
      requiredText(payload.name, 'Naziv teme'),
      payload.description?.trim() || null,
      nowIso(),
      id,
    );
    const row = await database.getFirstAsync<SqlRow>(`${select} WHERE t.topic_id = ?`, id);
    return mapTopic(row!);
  }
  if (method === 'DELETE') {
    await rowOr404(database, 'topics', 'topic_id', id);
    await database.runAsync('DELETE FROM topics WHERE topic_id = ?', id);
    return undefined;
  }
  throw new LocalApiFailure('Metoda nije podržana.', 405);
}

async function handleActivities(database: SQLiteDatabase, url: URL, method: string) {
  // tvtimeV3FastRecentDismiss
  const dismissRecent = url.pathname.match(/^\/activities\/([^/]+)\/dismiss-recent$/);
  if (dismissRecent && method === 'POST') {
    const activityId = decodeURIComponent(dismissRecent[1]!);
    await timerForActivity(database, activityId);
    await database.runAsync(
      `INSERT INTO activity_recent_dismissals (activity_id, dismissed_at) VALUES (?, ?)
       ON CONFLICT(activity_id) DO UPDATE SET dismissed_at = excluded.dismissed_at`,
      activityId,
      nowIso(),
    );
    return undefined;
  }

  const reading = url.pathname.match(/^\/activities\/books\/([^/]+)\/reading(?:\/(start|stop))?$/);
  if (reading) {
    const bookId = decodeURIComponent(reading[1]!);
    if (!reading[2] && method === 'GET') return getReadingTimer(database, bookId);
    if (reading[2] === 'start' && method === 'POST') {
      return startActivity(database, await ensureReadingActivity(database, bookId));
    }
    if (reading[2] === 'stop' && method === 'POST') {
      const timer = await getReadingTimer(database, bookId);
      return timer.activityId ? stopActivity(database, timer.activityId) : timer;
    }
  }
  if (url.pathname === '/activities/active' && method === 'GET') {
    const rows = await database.getAllAsync<SqlRow>(
      `SELECT DISTINCT a.activity_id FROM activities a
       JOIN time_sessions s ON s.activity_id = a.activity_id
       WHERE s.ended_at IS NULL ORDER BY s.started_at DESC`,
    );
    return Promise.all(rows.map((row) => timerForActivity(database, String(row.activity_id))));
  }
  if (url.pathname === '/activities/recent' && method === 'GET') {
    const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') ?? 6)));
    const rows = await database.getAllAsync<SqlRow>(
      `SELECT a.activity_id, MAX(COALESCE(s.ended_at, s.started_at)) AS last_used
       FROM activities a JOIN time_sessions s ON s.activity_id = a.activity_id
       WHERE NOT EXISTS (
         SELECT 1 FROM time_sessions running
         WHERE running.activity_id = a.activity_id AND running.ended_at IS NULL
       )
         AND NOT EXISTS (
           SELECT 1 FROM activity_recent_dismissals d
           WHERE d.activity_id = a.activity_id
         )
         AND (
           (a.activity_type = 'READING' AND a.book_id IS NOT NULL)
           OR (a.activity_type = 'WATCHING' AND a.media_id IS NOT NULL)
           OR (a.activity_type = 'PLAYING' AND EXISTS (
             SELECT 1 FROM games g WHERE g.playing_activity_id = a.activity_id
           ))
           OR a.activity_type NOT IN ('READING', 'WATCHING', 'PLAYING')
         )
       GROUP BY a.activity_id ORDER BY last_used DESC LIMIT ?`,
      limit,
    );
    return Promise.all(rows.map((row) => timerForActivity(database, String(row.activity_id))));
  }
  const match = url.pathname.match(/^\/activities\/([^/]+)\/(start|stop|sessions)$/);
  if (!match) throw new LocalApiFailure('Nepoznata putanja.', 404);
  const activityId = decodeURIComponent(match[1]!);
  if (match[2] === 'start' && method === 'POST') return startActivity(database, activityId);
  if (match[2] === 'stop' && method === 'POST') return stopActivity(database, activityId);
  if (match[2] === 'sessions' && method === 'GET') {
    await timerForActivity(database, activityId);
    const rows = await database.getAllAsync<SqlRow>(
      'SELECT * FROM time_sessions WHERE activity_id = ? ORDER BY started_at DESC',
      activityId,
    );
    return rows.map(
      (row): TimeSessionResponse => ({
        sessionId: String(row.session_id),
        startedAt: String(row.started_at),
        endedAt: row.ended_at as string | null,
        durationSeconds: Math.max(
          0,
          Math.floor(
            ((row.ended_at ? Date.parse(String(row.ended_at)) : Date.now()) -
              Date.parse(String(row.started_at))) /
              1000,
          ),
        ),
        running: row.ended_at === null,
      }),
    );
  }
  throw new LocalApiFailure('Metoda nije podržana.', 405);
}

async function handleEntries(database: SQLiteDatabase, url: URL, method: string, options?: RequestInit) {
  const match = url.pathname.match(/^\/entries\/([^/]+)$/);
  if (!match && method === 'GET') {
    const filters: string[] = [];
    const params: string[] = [];
    const mapping = { bookId: 'book_id', topicId: 'topic_id', activityId: 'activity_id', type: 'entry_type' };
    Object.entries(mapping).forEach(([queryName, column]) => {
      const value = url.searchParams.get(queryName);
      if (value) {
        filters.push(`${column} = ?`);
        params.push(value);
      }
    });
    const rows = await database.getAllAsync<SqlRow>(
      `SELECT * FROM entries ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
       ORDER BY modified_at DESC`,
      ...params,
    );
    return rows.map(mapEntry);
  }
  if (!match && method === 'POST') {
    const payload = parsePayload<EntryRequest>(options);
    const id = identifier();
    const now = nowIso();
    await database.runAsync(
      `INSERT INTO entries
       (entry_id, title, content, entry_type, book_id, topic_id, activity_id, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      payload.title?.trim() || null,
      requiredText(payload.content, 'Sadržaj'),
      payload.type,
      payload.bookId ?? null,
      payload.topicId ?? null,
      payload.activityId ?? null,
      now,
      now,
    );
    return mapEntry((await database.getFirstAsync<SqlRow>('SELECT * FROM entries WHERE entry_id=?', id))!);
  }
  if (!match) throw new LocalApiFailure('Nepoznata putanja.', 404);
  const id = decodeURIComponent(match[1]!);
  const existing = await database.getFirstAsync<SqlRow>('SELECT * FROM entries WHERE entry_id=?', id);
  if (!existing) throw new LocalApiFailure('Zapis ne postoji.', 404);
  if (method === 'GET') return mapEntry(existing);
  if (method === 'PUT') {
    const payload = parsePayload<EntryRequest>(options);
    await database.runAsync(
      `UPDATE entries SET title=?, content=?, entry_type=?, book_id=?, topic_id=?, activity_id=?,
       modified_at=? WHERE entry_id=?`,
      payload.title?.trim() || null,
      requiredText(payload.content, 'Sadržaj'),
      payload.type,
      payload.bookId ?? null,
      payload.topicId ?? null,
      payload.activityId ?? null,
      nowIso(),
      id,
    );
    return mapEntry((await database.getFirstAsync<SqlRow>('SELECT * FROM entries WHERE entry_id=?', id))!);
  }
  if (method === 'DELETE') {
    await database.runAsync('DELETE FROM entries WHERE entry_id=?', id);
    return undefined;
  }
  throw new LocalApiFailure('Metoda nije podržana.', 405);
}

async function handleGames(database: SQLiteDatabase, url: URL, method: string, options?: RequestInit) {
  const timerMatch = url.pathname.match(/^\/games\/([^/]+)\/timer(?:\/(start|stop))?$/);
  if (timerMatch) {
    const gameId = decodeURIComponent(timerMatch[1]!);
    if (!timerMatch[2] && method === 'GET') return gameTimer(database, gameId);
    if (timerMatch[2] === 'start' && method === 'POST') {
      return startActivity(database, await ensureGameActivity(database, gameId));
    }
    if (timerMatch[2] === 'stop' && method === 'POST') {
      const timer = await gameTimer(database, gameId);
      return timer.activityId ? stopActivity(database, timer.activityId) : timer;
    }
  }
  // lazyGameCoversV1
  const metadataMatch = url.pathname.match(/^\/games\/([^/]+)\/metadata$/);
  if (metadataMatch) {
    if (method !== 'PATCH') throw new LocalApiFailure('Metoda nije podržana.', 405);
    const gameId = decodeURIComponent(metadataMatch[1]!);
    await rowOr404(database, 'games', 'game_id', gameId);
    const payload = parsePayload<{
      developer?: string | null;
      releaseYear?: number | null;
      igdbId?: number | null;
      coverUrl?: string | null;
    }>(options);
    const now = nowIso();
    await database.runAsync(
      `UPDATE games SET
         developer = CASE
           WHEN developer IS NULL OR TRIM(developer) = '' THEN ?
           ELSE developer
         END,
         release_year = COALESCE(release_year, ?),
         igdb_id = COALESCE(igdb_id, ?),
         cover_url = CASE
           WHEN cover_url IS NULL OR TRIM(cover_url) = '' THEN ?
           ELSE cover_url
         END,
         modified_at = ?
       WHERE game_id = ?`,
      payload.developer?.trim() || null,
      payload.releaseYear ?? null,
      payload.igdbId ?? null,
      payload.coverUrl?.trim() || null,
      now,
      gameId,
    );
    return mapGame(await rowOr404(database, 'games', 'game_id', gameId));
  }
  const match = url.pathname.match(/^\/games\/([^/]+)$/);
  if (!match && method === 'GET') {
    const status = url.searchParams.get('status');
    const rows = status
      ? await database.getAllAsync<SqlRow>(
          'SELECT * FROM games WHERE game_status=? ORDER BY title COLLATE NOCASE',
          status,
        )
      : await database.getAllAsync<SqlRow>('SELECT * FROM games ORDER BY title COLLATE NOCASE');
    return rows.map(mapGame);
  }
  if (!match && method === 'POST') {
    const payload = parsePayload<GameRequest>(options);
    const id = identifier();
    const now = nowIso();
    await database.runAsync(
      `INSERT INTO games
       (game_id, title, developer, platform, release_year, game_status, progress, enjoyment,
        favourite, started_on, finished_on, igdb_id, cover_url, playing_activity_id,
        created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      id,
      requiredText(payload.title, 'Naslov'),
      payload.developer?.trim() || null,
      requiredText(payload.platform, 'Platforma'),
      payload.releaseYear ?? null,
      payload.gameStatus,
      Number(payload.progress),
      payload.enjoyment ?? null,
      booleanValue(payload.favourite),
      payload.startedOn ?? null,
      payload.finishedOn ?? null,
      payload.igdbId ?? null,
      payload.coverUrl ?? null,
      now,
      now,
    );
    return mapGame(await rowOr404(database, 'games', 'game_id', id));
  }
  if (!match) throw new LocalApiFailure('Nepoznata putanja.', 404);
  const id = decodeURIComponent(match[1]!);
  if (method === 'GET') return mapGame(await rowOr404(database, 'games', 'game_id', id));
  if (method === 'PUT') {
    const existing = await rowOr404(database, 'games', 'game_id', id);
    const payload = parsePayload<GameRequest>(options);
    const now = nowIso();
    await database.runAsync(
      `UPDATE games SET title=?, developer=?, platform=?, release_year=?, game_status=?, progress=?,
       enjoyment=?, favourite=?, started_on=?, finished_on=?, igdb_id=?, cover_url=?, modified_at=?
       WHERE game_id=?`,
      requiredText(payload.title, 'Naslov'),
      payload.developer?.trim() || null,
      requiredText(payload.platform, 'Platforma'),
      payload.releaseYear ?? null,
      payload.gameStatus,
      Number(payload.progress),
      payload.enjoyment ?? null,
      booleanValue(payload.favourite),
      payload.startedOn ?? null,
      payload.finishedOn ?? null,
      payload.igdbId ?? null,
      payload.coverUrl ?? null,
      now,
      id,
    );
    if (existing.playing_activity_id) {
      await database.runAsync(
        'UPDATE activities SET label=?, modified_at=? WHERE activity_id=?',
        `Igranje — ${payload.title.trim()}`,
        now,
        String(existing.playing_activity_id),
      );
    }
    return mapGame(await rowOr404(database, 'games', 'game_id', id));
  }
  if (method === 'DELETE') {
    await rowOr404(database, 'games', 'game_id', id);
    await database.runAsync('DELETE FROM games WHERE game_id=?', id);
    return undefined;
  }
  throw new LocalApiFailure('Metoda nije podržana.', 405);
}

async function handleMedia(database: SQLiteDatabase, url: URL, method: string, options?: RequestInit) {
  // jingleCatalogueV3
  const favouriteMatch = url.pathname.match(/^\/media\/([^/]+)\/favourite$/);
  if (favouriteMatch) {
    if (method !== 'PATCH') throw new LocalApiFailure('Metoda nije podržana.', 405);
    const mediaId = decodeURIComponent(favouriteMatch[1]!);
    await rowOr404(database, 'media_items', 'media_id', mediaId);
    const payload = parsePayload<{ favourite: boolean }>(options);
    await database.runAsync(
      'UPDATE media_items SET favourite=?, modified_at=? WHERE media_id=?',
      booleanValue(payload.favourite),
      nowIso(),
      mediaId,
    );
    return mapMedia(await rowOr404(database, 'media_items', 'media_id', mediaId));
  }

  // lazyMoviePostersV5
  const metadataMatch = url.pathname.match(/^\/media\/([^/]+)\/metadata$/);
  if (metadataMatch) {
    if (method !== 'PATCH') throw new LocalApiFailure('Metoda nije podržana.', 405);
    const mediaId = decodeURIComponent(metadataMatch[1]!);
    await rowOr404(database, 'media_items', 'media_id', mediaId);
    const payload = parsePayload<{
      originalTitle?: string | null;
      overview?: string | null;
      posterPath?: string | null;
      backdropPath?: string | null;
      releaseYear?: number | null;
    }>(options);
    const now = nowIso();
    await database.runAsync(
      `UPDATE media_items SET
         original_title = CASE
           WHEN original_title IS NULL OR TRIM(original_title) = '' THEN ?
           ELSE original_title
         END,
         overview = CASE
           WHEN overview IS NULL OR TRIM(overview) = '' THEN ?
           ELSE overview
         END,
         poster_path = CASE
           WHEN poster_path IS NULL OR TRIM(poster_path) = '' THEN ?
           ELSE poster_path
         END,
         backdrop_path = CASE
           WHEN backdrop_path IS NULL OR TRIM(backdrop_path) = '' THEN ?
           ELSE backdrop_path
         END,
         release_year = COALESCE(release_year, ?),
         modified_at = ?
       WHERE media_id = ?`,
      payload.originalTitle?.trim() || null,
      payload.overview?.trim() || null,
      payload.posterPath?.trim() || null,
      payload.backdropPath?.trim() || null,
      payload.releaseYear ?? null,
      now,
      mediaId,
    );
    return mapMedia(await rowOr404(database, 'media_items', 'media_id', mediaId));
  }

  const timerMatch = url.pathname.match(/^\/media\/([^/]+)\/watching(?:\/(start|stop))?$/);
  if (timerMatch) {
    const mediaId = decodeURIComponent(timerMatch[1]!);
    if (!timerMatch[2] && method === 'GET') return mediaTimer(database, mediaId);
    if (timerMatch[2] === 'start' && method === 'POST') {
      await startActivity(database, await ensureMediaActivity(database, mediaId));
      return mediaTimer(database, mediaId);
    }
    if (timerMatch[2] === 'stop' && method === 'POST') {
      const timer = await mediaTimer(database, mediaId);
      if (timer.activityId) await stopActivity(database, timer.activityId);
      return mediaTimer(database, mediaId);
    }
  }
  const match = url.pathname.match(/^\/media\/([^/]+)$/);
  if (!match && method === 'GET') {
    const filters: string[] = [];
    const params: string[] = [];
    // catalogueNebitnoFilterV4
    // Nebitno is a recoverable flag, not a watch_status. Normal catalogue hides it;
    // the Nebitno chip asks for only flagged items.
    // jingleCatalogueV3
    if (url.searchParams.get('favourite') === '1') {
      filters.push('media_items.favourite = 1');
    }

    const ignored = url.searchParams.get('ignored');
    if (ignored === 'NEBITNO') {
      filters.push("EXISTS (SELECT 1 FROM external_media_flags f WHERE f.media_id = media_items.media_id AND f.source = 'TV_TIME' AND f.flag = 'NEBITNO')");
    } else if (url.searchParams.get('includeIgnored') !== '1') {
      filters.push("NOT EXISTS (SELECT 1 FROM external_media_flags f WHERE f.media_id = media_items.media_id AND f.source = 'TV_TIME' AND f.flag = 'NEBITNO')");
    }
    const mediaType = url.searchParams.get('mediaType');
    const status = url.searchParams.get('status');
    if (mediaType) {
      filters.push('media_type=?');
      params.push(mediaType);
    }
    if (status) {
      filters.push('watch_status=?');
      params.push(status);
    }
    const rows = await database.getAllAsync<SqlRow>(
      `SELECT * FROM media_items ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
       ORDER BY COALESCE(started_on, created_at) DESC, created_at DESC, title COLLATE NOCASE ASC`,
      ...params,
    );
    return rows.map(mapMedia);
  }
  if (!match && method === 'POST') {
    const payload = parsePayload<MediaRequest>(options);
    const id = identifier();
    const now = nowIso();
    await database.runAsync(
      `INSERT INTO media_items
       (media_id, media_type, tmdb_id, title, original_title, overview, poster_path,
        backdrop_path, release_year, watch_status, progress, enjoyment, favourite,
        started_on, completed_on, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      payload.mediaType,
      payload.tmdbId ?? null,
      requiredText(payload.title, 'Naslov'),
      payload.originalTitle ?? null,
      payload.overview ?? null,
      payload.posterPath ?? null,
      payload.backdropPath ?? null,
      payload.releaseYear ?? null,
      payload.watchStatus,
      Number(payload.progress),
      payload.enjoyment ?? null,
      booleanValue(payload.favourite),
      payload.startedOn ?? null,
      payload.completedOn ?? null,
      now,
      now,
    );
    return mapMedia(await rowOr404(database, 'media_items', 'media_id', id));
  }
  if (!match) throw new LocalApiFailure('Nepoznata putanja.', 404);
  const id = decodeURIComponent(match[1]!);
  if (method === 'GET') return mapMedia(await rowOr404(database, 'media_items', 'media_id', id));
  if (method === 'PUT') {
    await rowOr404(database, 'media_items', 'media_id', id);
    const payload = parsePayload<MediaRequest>(options);
    const now = nowIso();
    await database.runAsync(
      `UPDATE media_items SET media_type=?, tmdb_id=?, title=?, original_title=?, overview=?,
       poster_path=?, backdrop_path=?, release_year=?, watch_status=?, progress=?, enjoyment=?,
       favourite=?, started_on=?, completed_on=?, modified_at=? WHERE media_id=?`,
      payload.mediaType,
      payload.tmdbId ?? null,
      requiredText(payload.title, 'Naslov'),
      payload.originalTitle ?? null,
      payload.overview ?? null,
      payload.posterPath ?? null,
      payload.backdropPath ?? null,
      payload.releaseYear ?? null,
      payload.watchStatus,
      Number(payload.progress),
      payload.enjoyment ?? null,
      booleanValue(payload.favourite),
      payload.startedOn ?? null,
      payload.completedOn ?? null,
      now,
      id,
    );
    await database.runAsync(
      `UPDATE activities SET label=?, modified_at=?
       WHERE media_id=? AND activity_type='WATCHING'`,
      `Gledanje — ${payload.title.trim()}`,
      now,
      id,
    );
    return mapMedia(await rowOr404(database, 'media_items', 'media_id', id));
  }
  if (method === 'DELETE') {
    await rowOr404(database, 'media_items', 'media_id', id);
    await database.runAsync('DELETE FROM media_items WHERE media_id=?', id);
    return undefined;
  }
  throw new LocalApiFailure('Metoda nije podržana.', 405);
}

function localEntryTitle(row: SqlRow) {
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  if (title) return title;
  const content = String(row.content ?? '').replace(/\s+/g, ' ').trim();
  return content.length <= 60 ? content : `${content.slice(0, 57)}…`;
}

async function localEntityReference(
  database: SQLiteDatabase,
  entityType: EntityReferenceType,
  entityId: string,
): Promise<EntityReference> {
  if (entityType === 'BOOK') {
    const row = await database.getFirstAsync<SqlRow>('SELECT * FROM books WHERE book_id=?', entityId);
    if (!row) throw new LocalApiFailure('Knjiga ne postoji.', 404);
    return { entityType, entityId, title: String(row.title), subtitle: String(row.author) };
  }
  if (entityType === 'MEDIA') {
    const row = await database.getFirstAsync<SqlRow>('SELECT * FROM media_items WHERE media_id=?', entityId);
    if (!row) throw new LocalApiFailure('Film ili serija ne postoji.', 404);
    return { entityType, entityId, title: String(row.title), subtitle: String(row.media_type) };
  }
  if (entityType === 'GAME') {
    const row = await database.getFirstAsync<SqlRow>('SELECT * FROM games WHERE game_id=?', entityId);
    if (!row) throw new LocalApiFailure('Igra ne postoji.', 404);
    return { entityType, entityId, title: String(row.title), subtitle: String(row.platform) };
  }
  if (entityType === 'TOPIC') {
    const row = await database.getFirstAsync<SqlRow>('SELECT * FROM topics WHERE topic_id=?', entityId);
    if (!row) throw new LocalApiFailure('Tema ne postoji.', 404);
    return { entityType, entityId, title: String(row.name), subtitle: row.description as string | null };
  }
  const row = await database.getFirstAsync<SqlRow>('SELECT * FROM entries WHERE entry_id=?', entityId);
  if (!row) throw new LocalApiFailure('Zapis ne postoji.', 404);
  return { entityType: 'ENTRY', entityId, title: localEntryTitle(row), subtitle: String(row.entry_type) };
}

async function localEntityReferences(database: SQLiteDatabase, search: string) {
  const references: EntityReference[] = [];
  const books = await database.getAllAsync<SqlRow>('SELECT * FROM books ORDER BY title COLLATE NOCASE');
  books.forEach((row) => references.push({ entityType: 'BOOK', entityId: String(row.book_id), title: String(row.title), subtitle: String(row.author) }));
  const media = await database.getAllAsync<SqlRow>('SELECT * FROM media_items ORDER BY title COLLATE NOCASE');
  media.forEach((row) => references.push({ entityType: 'MEDIA', entityId: String(row.media_id), title: String(row.title), subtitle: String(row.media_type) }));
  const games = await database.getAllAsync<SqlRow>('SELECT * FROM games ORDER BY title COLLATE NOCASE');
  games.forEach((row) => references.push({ entityType: 'GAME', entityId: String(row.game_id), title: String(row.title), subtitle: String(row.platform) }));
  const topics = await database.getAllAsync<SqlRow>('SELECT * FROM topics ORDER BY name COLLATE NOCASE');
  topics.forEach((row) => references.push({ entityType: 'TOPIC', entityId: String(row.topic_id), title: String(row.name), subtitle: row.description as string | null }));
  const entries = await database.getAllAsync<SqlRow>('SELECT * FROM entries ORDER BY modified_at DESC');
  entries.forEach((row) => references.push({ entityType: 'ENTRY', entityId: String(row.entry_id), title: localEntryTitle(row), subtitle: String(row.entry_type) }));

  const normalized = search.trim().toLocaleLowerCase('hr');
  return references
    .filter((item) => !normalized || `${item.title} ${item.subtitle ?? ''} ${item.entityType}`.toLocaleLowerCase('hr').includes(normalized))
    .sort((left, right) => left.title.localeCompare(right.title, 'hr'))
    .slice(0, 120);
}

function mapCollectionSummary(row: SqlRow): CollectionSummary {
  return {
    collectionId: String(row.collection_id),
    name: String(row.name),
    description: row.description as string | null,
    symbol: row.symbol as string | null,
    itemCount: Number(row.item_count ?? 0),
  };
}

async function collectionSummary(database: SQLiteDatabase, collectionId: string) {
  const row = await database.getFirstAsync<SqlRow>(
    `SELECT c.*, (SELECT COUNT(*) FROM collection_items ci WHERE ci.collection_id=c.collection_id) AS item_count
     FROM collections c WHERE c.collection_id=?`,
    collectionId,
  );
  if (!row) throw new LocalApiFailure('Kolekcija ne postoji.', 404);
  return mapCollectionSummary(row);
}

async function collectionDetail(database: SQLiteDatabase, collectionId: string): Promise<CollectionDetail> {
  const summary = await collectionSummary(database, collectionId);
  const rows = await database.getAllAsync<SqlRow>(
    'SELECT * FROM collection_items WHERE collection_id=? ORDER BY position, created_at',
    collectionId,
  );
  const items: CollectionItem[] = [];
  for (const row of rows) {
    const entityType = String(row.entity_type) as EntityReferenceType;
    try {
      const reference = await localEntityReference(database, entityType, String(row.entity_id));
      items.push({
        itemId: String(row.item_id),
        entityType,
        entityId: String(row.entity_id),
        title: reference.title,
        subtitle: reference.subtitle,
        position: Number(row.position),
        addedAt: String(row.created_at),
      });
    } catch {
      // Ignore orphaned polymorphic items; the user can continue using the rest of the collection.
    }
  }
  return { ...summary, items };
}

async function handleCollections(
  database: SQLiteDatabase,
  url: URL,
  method: string,
  options?: RequestInit,
) {
  if (url.pathname === '/collections/for-entity' && method === 'GET') {
    const entityType = requiredText(url.searchParams.get('entityType'), 'Vrsta stavke') as EntityReferenceType;
    const entityId = requiredText(url.searchParams.get('entityId'), 'Identifikator stavke');
    await localEntityReference(database, entityType, entityId);
    const rows = await database.getAllAsync<SqlRow>(
      `SELECT c.*, (SELECT COUNT(*) FROM collection_items all_items WHERE all_items.collection_id=c.collection_id) AS item_count
       FROM collections c
       JOIN collection_items ci ON ci.collection_id=c.collection_id
       WHERE ci.entity_type=? AND ci.entity_id=?
       ORDER BY c.name COLLATE NOCASE`,
      entityType,
      entityId,
    );
    return rows.map(mapCollectionSummary);
  }

  const itemMatch = url.pathname.match(/^\/collections\/([^/]+)\/items\/([^/]+)$/);
  if (itemMatch && method === 'DELETE') {
    const collectionId = decodeURIComponent(itemMatch[1]!);
    const itemId = decodeURIComponent(itemMatch[2]!);
    await collectionSummary(database, collectionId);
    await database.runAsync('DELETE FROM collection_items WHERE collection_id=? AND item_id=?', collectionId, itemId);
    return undefined;
  }

  const addMatch = url.pathname.match(/^\/collections\/([^/]+)\/items$/);
  if (addMatch && method === 'POST') {
    const collectionId = decodeURIComponent(addMatch[1]!);
    await collectionSummary(database, collectionId);
    const payload = parsePayload<{ entityType: EntityReferenceType; entityId: string }>(options);
    const entityType = payload.entityType;
    const entityId = requiredText(payload.entityId, 'Identifikator stavke');
    const reference = await localEntityReference(database, entityType, entityId);
    const existing = await database.getFirstAsync<SqlRow>(
      'SELECT item_id FROM collection_items WHERE collection_id=? AND entity_type=? AND entity_id=?',
      collectionId,
      entityType,
      entityId,
    );
    if (existing) throw new LocalApiFailure('Ta je stavka već u kolekciji.', 409);
    const count = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM collection_items WHERE collection_id=?',
      collectionId,
    );
    const itemId = identifier();
    const now = nowIso();
    await database.runAsync(
      `INSERT INTO collection_items
       (item_id, collection_id, entity_type, entity_id, position, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      itemId,
      collectionId,
      entityType,
      entityId,
      Number(count?.count ?? 0),
      now,
      now,
    );
    return {
      itemId,
      entityType,
      entityId,
      title: reference.title,
      subtitle: reference.subtitle,
      position: Number(count?.count ?? 0),
      addedAt: now,
    } satisfies CollectionItem;
  }

  const match = url.pathname.match(/^\/collections\/([^/]+)$/);
  if (!match && method === 'GET') {
    const rows = await database.getAllAsync<SqlRow>(
      `SELECT c.*, (SELECT COUNT(*) FROM collection_items ci WHERE ci.collection_id=c.collection_id) AS item_count
       FROM collections c ORDER BY c.name COLLATE NOCASE`,
    );
    return rows.map(mapCollectionSummary);
  }
  if (!match && method === 'POST') {
    const payload = parsePayload<CollectionRequest>(options);
    const collectionId = identifier();
    const now = nowIso();
    try {
      await database.runAsync(
        'INSERT INTO collections (collection_id, name, description, symbol, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)',
        collectionId,
        requiredText(payload.name, 'Naziv kolekcije'),
        payload.description?.trim() || null,
        payload.symbol?.trim() || '◇',
        now,
        now,
      );
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes('unique')) {
        throw new LocalApiFailure('Kolekcija s tim nazivom već postoji.', 409);
      }
      throw error;
    }
    return collectionSummary(database, collectionId);
  }
  if (!match) throw new LocalApiFailure('Nepoznata putanja kolekcije.', 404);

  const collectionId = decodeURIComponent(match[1]!);
  if (method === 'GET') return collectionDetail(database, collectionId);
  if (method === 'PUT') {
    await collectionSummary(database, collectionId);
    const payload = parsePayload<CollectionRequest>(options);
    await database.runAsync(
      'UPDATE collections SET name=?, description=?, symbol=?, modified_at=? WHERE collection_id=?',
      requiredText(payload.name, 'Naziv kolekcije'),
      payload.description?.trim() || null,
      payload.symbol?.trim() || '◇',
      nowIso(),
      collectionId,
    );
    return collectionSummary(database, collectionId);
  }
  if (method === 'DELETE') {
    await collectionSummary(database, collectionId);
    await database.runAsync('DELETE FROM collections WHERE collection_id=?', collectionId);
    return undefined;
  }
  throw new LocalApiFailure('Metoda nije podržana.', 405);
}

function mapLocalLink(row: SqlRow, source: EntityReference, target: EntityReference): EntityLink {
  return {
    linkId: String(row.link_id),
    sourceType: String(row.source_type) as EntityReferenceType,
    sourceId: String(row.source_id),
    targetType: String(row.target_type) as EntityReferenceType,
    targetId: String(row.target_id),
    relationType: String(row.relation_type) as RelationType,
    note: row.note as string | null,
    source,
    target,
    createdAt: String(row.created_at),
  };
}

async function localLinkResponse(database: SQLiteDatabase, row: SqlRow) {
  const source = await localEntityReference(database, String(row.source_type) as EntityReferenceType, String(row.source_id));
  const target = await localEntityReference(database, String(row.target_type) as EntityReferenceType, String(row.target_id));
  return mapLocalLink(row, source, target);
}

async function handleEntityLinks(
  database: SQLiteDatabase,
  url: URL,
  method: string,
  options?: RequestInit,
) {
  const match = url.pathname.match(/^\/entity-links\/([^/]+)$/);
  if (match && method === 'DELETE') {
    await database.runAsync('DELETE FROM entity_links WHERE link_id=?', decodeURIComponent(match[1]!));
    return undefined;
  }
  if (url.pathname !== '/entity-links') throw new LocalApiFailure('Nepoznata putanja poveznice.', 404);
  if (method === 'GET') {
    const entityType = requiredText(url.searchParams.get('entityType'), 'Vrsta stavke') as EntityReferenceType;
    const entityId = requiredText(url.searchParams.get('entityId'), 'Identifikator stavke');
    await localEntityReference(database, entityType, entityId);
    const rows = await database.getAllAsync<SqlRow>(
      `SELECT * FROM entity_links
       WHERE (source_type=? AND source_id=?) OR (target_type=? AND target_id=?)
       ORDER BY created_at DESC`,
      entityType,
      entityId,
      entityType,
      entityId,
    );
    const links: EntityLink[] = [];
    for (const row of rows) {
      try { links.push(await localLinkResponse(database, row)); } catch { /* orphan */ }
    }
    return links;
  }
  if (method === 'POST') {
    const payload = parsePayload<{
      sourceType: EntityReferenceType;
      sourceId: string;
      targetType: EntityReferenceType;
      targetId: string;
      relationType: RelationType;
      note?: string | null;
    }>(options);
    const sourceId = requiredText(payload.sourceId, 'Izvor');
    const targetId = requiredText(payload.targetId, 'Odredište');
    if (payload.sourceType === payload.targetType && sourceId === targetId) {
      throw new LocalApiFailure('Stavka se ne može povezati sama sa sobom.');
    }
    await localEntityReference(database, payload.sourceType, sourceId);
    await localEntityReference(database, payload.targetType, targetId);
    const linkId = identifier();
    const now = nowIso();
    try {
      await database.runAsync(
        `INSERT INTO entity_links
         (link_id, source_type, source_id, target_type, target_id, relation_type, note, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        linkId,
        payload.sourceType,
        sourceId,
        payload.targetType,
        targetId,
        payload.relationType ?? 'RELATED',
        payload.note?.trim() || null,
        now,
        now,
      );
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes('unique')) {
        throw new LocalApiFailure('Ta poveznica već postoji.', 409);
      }
      throw error;
    }
    const row = await database.getFirstAsync<SqlRow>('SELECT * FROM entity_links WHERE link_id=?', linkId);
    return localLinkResponse(database, row!);
  }
  throw new LocalApiFailure('Metoda nije podržana.', 405);
}

export async function localApiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const database = await getDatabase();
  const url = new URL(path, 'https://local.life-catalogue');
  const method = (options?.method ?? 'GET').toUpperCase();
  let result: unknown;

  if (url.pathname === '/books' || url.pathname.startsWith('/books/')) {
    result = await handleBooks(database, url, method, options);
  } else if (url.pathname === '/topics' || url.pathname.startsWith('/topics/')) {
    result = await handleTopics(database, url, method, options);
  } else if (url.pathname.startsWith('/activities/')) {
    result = await handleActivities(database, url, method);
  } else if (url.pathname === '/entries' || url.pathname.startsWith('/entries/')) {
    result = await handleEntries(database, url, method, options);
  } else if (url.pathname === '/games' || url.pathname.startsWith('/games/')) {
    result = await handleGames(database, url, method, options);
  } else if (url.pathname === '/media' || url.pathname.startsWith('/media/')) {
    result = await handleMedia(database, url, method, options);
  } else if (url.pathname === '/collections' || url.pathname.startsWith('/collections/')) {
    result = await handleCollections(database, url, method, options);
  } else if (url.pathname === '/entity-links' || url.pathname.startsWith('/entity-links/')) {
    result = await handleEntityLinks(database, url, method, options);
  } else if (url.pathname === '/entity-references' && method === 'GET') {
    result = await localEntityReferences(database, url.searchParams.get('query') ?? '');
  } else if (url.pathname === '/stats/daily' && method === 'GET') {
    result = await dailyStats(database, url);
  } else if (url.pathname === '/history/sessions' && method === 'GET') {
    result = await history(database, url);
  } else {
    throw new LocalApiFailure('Nepoznata lokalna putanja.', 404);
  }

  return result as T;
}
