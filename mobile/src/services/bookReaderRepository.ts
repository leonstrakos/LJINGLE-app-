import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { getDatabase } from '../storage/database';
import { getAuthToken } from '../auth/sessionStore';
import { saveBookReadingPageDirect } from './sessionNotes';
import type {
  BookDocument,
  BookDocumentFormat,
  BookReaderTheme,
  ReaderAnchorPreview,
  ReaderEntryAnchor,
  ReaderBookmark,
} from '../types/reader';

const READER_DIRECTORY_NAME = 'book-reader';
// ljingleReaderServerMirrorMobileR1
const READER_ASSET_API_ROOT = (
  process.env.EXPO_PUBLIC_LJINGLE_API_URL?.trim() ||
  process.env.EXPO_PUBLIC_SYNC_API_URL?.trim() ||
  'https://heraldsofthelion.org/ljingle-api'
).replace(/\/+$/, '');

let remoteDeleteFlush: Promise<void> | null = null;

type DocumentRow = {
  document_id: string;
  book_id: string;
  format: BookDocumentFormat;
  uri: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  current_page: number | null;
  total_pages: number | null;
  epub_locator: string | null;
  progress: number;
  reader_theme: BookReaderTheme;
  created_at: string;
  modified_at: string;
};

type ReaderDatabase = Awaited<ReturnType<typeof getDatabase>>;

// ljingleCompletionSealReaderBookmarksR1:Repository
type BookmarkRow = {
  bookmark_id: string;
  document_id: string;
  book_id: string;
  format: BookDocumentFormat;
  page: number | null;
  epub_locator: string | null;
  created_at: string;
};

const readerBookmarkListeners = new Set<(bookId: string) => void>();

function emitReaderBookmarkChange(bookId: string) {
  for (const listener of readerBookmarkListeners) {
    try { listener(bookId); } catch {}
  }
}

export function subscribeReaderBookmarkChanges(
  listener: (bookId: string) => void,
) {
  readerBookmarkListeners.add(listener);
  return () => readerBookmarkListeners.delete(listener);
}

type AnchorRow = {
  anchor_id: string;
  entry_id: string;
  document_id: string;
  book_id: string;
  format: BookDocumentFormat;
  page: number | null;
  epub_locator: string | null;
  selected_text: string | null;
  selection_rects: string | null;
  created_at: string;
  entry_title: string | null;
  entry_content: string;
  entry_type: string;
};

function identifier(prefix: string) {
  return (
    prefix +
    '-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function mapDocument(row: DocumentRow): BookDocument {
  return {
    documentId: String(row.document_id),
    bookId: String(row.book_id),
    format: row.format,
    uri: String(row.uri),
    fileName: String(row.file_name),
    mimeType: row.mime_type ?? null,
    sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
    currentPage: row.current_page == null ? null : Number(row.current_page),
    totalPages: row.total_pages == null ? null : Number(row.total_pages),
    epubLocator: row.epub_locator ?? null,
    progress: clampProgress(Number(row.progress)),
    readerTheme: row.reader_theme === 'NIGHT' ? 'NIGHT' : 'DAY',
    createdAt: String(row.created_at),
    modifiedAt: String(row.modified_at),
  };
}

function mapBookmark(row: BookmarkRow): ReaderBookmark {
  return {
    bookmarkId: String(row.bookmark_id),
    documentId: String(row.document_id),
    bookId: String(row.book_id),
    format: row.format,
    page: row.page == null ? null : Number(row.page),
    epubLocator: row.epub_locator ?? null,
    createdAt: String(row.created_at),
  };
}

function mapAnchor(row: AnchorRow): ReaderEntryAnchor {
  let selectionRects: ReaderEntryAnchor['selectionRects'] = [];
  if (row.selection_rects) {
    try {
      const parsed = JSON.parse(row.selection_rects);
      if (Array.isArray(parsed)) {
        selectionRects = parsed.filter((value) => value && Number.isFinite(Number(value.page)) && typeof value.rect === 'string');
      }
    } catch {
      selectionRects = [];
    }
  }
  return {
    anchorId: String(row.anchor_id),
    entryId: String(row.entry_id),
    documentId: String(row.document_id),
    bookId: String(row.book_id),
    format: row.format,
    page: row.page == null ? null : Number(row.page),
    epubLocator: row.epub_locator ?? null,
    selectedText: row.selected_text ?? null,
    selectionRects,
    createdAt: String(row.created_at),
    entryTitle: row.entry_title ?? null,
    entryContent: String(row.entry_content),
    entryType: String(row.entry_type),
  };
}

async function databaseWithReader() {
  const database = await getDatabase();

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS book_documents (
      document_id TEXT PRIMARY KEY NOT NULL,
      book_id TEXT NOT NULL UNIQUE,
      format TEXT NOT NULL CHECK(format IN ('PDF', 'EPUB')),
      uri TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER,
      current_page INTEGER,
      total_pages INTEGER,
      epub_locator TEXT,
      progress INTEGER NOT NULL DEFAULT 0,
      reader_theme TEXT NOT NULL DEFAULT 'DAY' CHECK(reader_theme IN ('DAY', 'NIGHT')),
      created_at TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reader_entry_anchors (
      anchor_id TEXT PRIMARY KEY NOT NULL,
      entry_id TEXT NOT NULL UNIQUE,
      document_id TEXT NOT NULL,
      book_id TEXT NOT NULL,
      format TEXT NOT NULL CHECK(format IN ('PDF', 'EPUB')),
      page INTEGER,
      epub_locator TEXT,
      selected_text TEXT,
      selection_rects TEXT,
      created_at TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      FOREIGN KEY (entry_id) REFERENCES entries(entry_id) ON DELETE CASCADE,
      FOREIGN KEY (document_id) REFERENCES book_documents(document_id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_reader_entry_anchors_document
      ON reader_entry_anchors(document_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reader_entry_anchors_book
      ON reader_entry_anchors(book_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS reader_bookmarks (
      bookmark_id TEXT PRIMARY KEY NOT NULL,
      document_id TEXT NOT NULL,
      book_id TEXT NOT NULL,
      format TEXT NOT NULL CHECK(format IN ('PDF', 'EPUB')),
      page INTEGER,
      epub_locator TEXT,
      created_at TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES book_documents(document_id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_reader_bookmarks_book
      ON reader_bookmarks(book_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reader_bookmarks_document
      ON reader_bookmarks(document_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS reader_document_remote_deletes (
      book_id TEXT PRIMARY KEY NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  scheduleRemoteDeleteFlush(database);

  try {
    await database.runAsync('ALTER TABLE reader_entry_anchors ADD COLUMN selection_rects TEXT');
  } catch {
    // Existing database already has the additive column.
  }

  return database;
}

function safeExtension(name: string, format: BookDocumentFormat) {
  const match = name.match(/\.([a-zA-Z0-9]{1,8})$/);
  if (match) return '.' + match[1]!.toLowerCase();
  return format === 'PDF' ? '.pdf' : '.epub';
}

function inferFormat(fileName: string, mimeType: string | null): BookDocumentFormat | null {
  const normalizedName = fileName.trim().toLowerCase();
  const normalizedMime = String(mimeType ?? '').toLowerCase();

  if (normalizedName.endsWith('.pdf') || normalizedMime === 'application/pdf') {
    return 'PDF';
  }
  if (
    normalizedName.endsWith('.epub') ||
    normalizedMime === 'application/epub+zip'
  ) {
    return 'EPUB';
  }
  return null;
}

async function deleteOwnedDocument(uri: string) {
  if (!FileSystem.documentDirectory) return;
  const ownedPrefix = FileSystem.documentDirectory + READER_DIRECTORY_NAME + '/';
  if (!uri.startsWith(ownedPrefix)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

async function persistPickedDocument(
  sourceUri: string,
  fileName: string,
  format: BookDocumentFormat,
) {
  if (!FileSystem.documentDirectory) {
    throw new Error('Lokalna mapa aplikacije nije dostupna.');
  }

  const directory = FileSystem.documentDirectory + READER_DIRECTORY_NAME + '/';
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  const destination =
    directory + identifier('book') + safeExtension(fileName, format);

  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  return destination;
}


function readerAssetUrl(bookId: string) {
  return (
    READER_ASSET_API_ROOT +
    '/reader-assets/book/' +
    encodeURIComponent(bookId)
  );
}

function readerServerHeaders() {
  const token = getAuthToken();
  return token
    ? { Authorization: 'Bearer ' + token }
    : null;
}

async function remoteReaderStatus(bookId: string) {
  const headers = readerServerHeaders();
  if (!headers) return null;

  try {
    const response = await fetch(readerAssetUrl(bookId), {
      method: 'HEAD',
      headers,
    });

    if (response.status === 404) {
      return { exists: false, sizeBytes: null as number | null };
    }

    if (!response.ok) return null;

    const size = Number(
      response.headers.get('X-LJINGLE-SIZE') ||
      response.headers.get('Content-Length') ||
      0,
    );

    return {
      exists: true,
      sizeBytes: Number.isFinite(size) && size > 0 ? size : null,
    };
  } catch {
    return null;
  }
}

async function uploadReaderDocumentToServer(
  document: BookDocument,
  force = false,
) {
  const headers = readerServerHeaders();
  if (!headers || !document.uri) return false;

  const info = await FileSystem.getInfoAsync(document.uri).catch(() => null);
  if (!info?.exists || info.isDirectory) return false;

  const localSize = Number(info.size ?? document.sizeBytes ?? 0);

  if (!force) {
    const remote = await remoteReaderStatus(document.bookId);
    if (
      remote?.exists &&
      localSize > 0 &&
      remote.sizeBytes === localSize
    ) {
      return true;
    }
  }

  const result = await FileSystem.uploadAsync(
    readerAssetUrl(document.bookId),
    document.uri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        ...headers,
        'Content-Type':
          document.mimeType ||
          (document.format === 'PDF'
            ? 'application/pdf'
            : 'application/epub+zip'),
        'X-LJINGLE-FORMAT': document.format,
        'X-LJINGLE-FILE-NAME': encodeURIComponent(document.fileName),
      },
    },
  );

  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      'Reader server mirror returned HTTP ' + result.status + '.',
    );
  }

  return true;
}

async function restoreReaderDocumentFromServer(
  database: ReaderDatabase,
  row: DocumentRow,
) {
  const headers = readerServerHeaders();
  if (!headers || !FileSystem.documentDirectory) return null;

  const directory = FileSystem.documentDirectory + READER_DIRECTORY_NAME + '/';
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  const destination =
    directory +
    identifier('restored-' + String(row.document_id).slice(0, 20)) +
    safeExtension(String(row.file_name), row.format);

  try {
    const result = await FileSystem.downloadAsync(
      readerAssetUrl(String(row.book_id)),
      destination,
      { headers },
    );

    if (result.status < 200 || result.status >= 300) {
      await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
      return null;
    }

    const info = await FileSystem.getInfoAsync(destination).catch(() => null);
    if (!info?.exists || info.isDirectory || Number(info.size ?? 0) <= 0) {
      await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
      return null;
    }

    // URI is device-local transport metadata, not reading progress. Do not bump
    // modified_at just because a new phone reconstructed its local copy.
    await database.runAsync(
      'UPDATE book_documents SET uri=?, size_bytes=? WHERE document_id=?',
      destination,
      Number(info.size ?? row.size_bytes ?? 0) || null,
      String(row.document_id),
    );

    return mapDocument({
      ...row,
      uri: destination,
      size_bytes: Number(info.size ?? row.size_bytes ?? 0) || null,
    });
  } catch {
    await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
    return null;
  }
}

async function deleteReaderDocumentFromServer(bookId: string) {
  const headers = readerServerHeaders();
  if (!headers) return false;

  const response = await fetch(readerAssetUrl(bookId), {
    method: 'DELETE',
    headers,
  });

  if (response.status === 204 || response.status === 404) return true;
  if (!response.ok) {
    throw new Error('Reader server delete returned HTTP ' + response.status + '.');
  }
  return true;
}

async function flushRemoteReaderDeletes(database: ReaderDatabase) {
  const headers = readerServerHeaders();
  if (!headers) return;

  const rows = await database.getAllAsync<{ book_id: string }>(
    'SELECT book_id FROM reader_document_remote_deletes ORDER BY created_at ASC LIMIT 20',
  );

  for (const row of rows) {
    const bookId = String(row.book_id);
    try {
      const deleted = await deleteReaderDocumentFromServer(bookId);
      if (!deleted) return;
      await database.runAsync(
        'DELETE FROM reader_document_remote_deletes WHERE book_id=?',
        bookId,
      );
    } catch {
      return;
    }
  }
}

function scheduleRemoteDeleteFlush(database: ReaderDatabase) {
  if (remoteDeleteFlush) return;
  remoteDeleteFlush = flushRemoteReaderDeletes(database)
    .catch(() => undefined)
    .finally(() => {
      remoteDeleteFlush = null;
    });
}

export async function getBookDocument(bookId: string) {
  const database = await databaseWithReader();
  const row = await database.getFirstAsync<DocumentRow>(
    'SELECT * FROM book_documents WHERE book_id = ?',
    bookId,
  );
  if (!row) return null;

  const info = await FileSystem.getInfoAsync(String(row.uri)).catch(() => null);
  if (info?.exists && !info.isDirectory) {
    const document = mapDocument(row);
    // Cheap HEAD first; bytes upload only if the private server copy is absent
    // or has a different size.
    void uploadReaderDocumentToServer(document, false).catch(() => undefined);
    return document;
  }

  return restoreReaderDocumentFromServer(database, row);
}

export async function pickAndAttachBookDocument(bookId: string) {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'application/epub+zip'],
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset) return null;

  const fileName = asset.name || 'knjiga';
  const format = inferFormat(fileName, asset.mimeType ?? null);
  if (!format) {
    throw new Error('Odaberi PDF ili EPUB datoteku.');
  }

  const uri = await persistPickedDocument(asset.uri, fileName, format);
  const database = await databaseWithReader();
  await database.runAsync(
    'DELETE FROM reader_document_remote_deletes WHERE book_id=?',
    bookId,
  ).catch(() => undefined);
  const existing = await database.getFirstAsync<DocumentRow>(
    'SELECT * FROM book_documents WHERE book_id = ?',
    bookId,
  );
  const now = new Date().toISOString();
  const documentId = existing?.document_id
    ? String(existing.document_id)
    : identifier('doc');

  try {
    await database.runAsync(
      `INSERT INTO book_documents
       (document_id, book_id, format, uri, file_name, mime_type, size_bytes,
        current_page, total_pages, epub_locator, progress, reader_theme,
        created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 'DAY', ?, ?)
       ON CONFLICT(book_id) DO UPDATE SET
         format=excluded.format,
         uri=excluded.uri,
         file_name=excluded.file_name,
         mime_type=excluded.mime_type,
         size_bytes=excluded.size_bytes,
         current_page=NULL,
         total_pages=NULL,
         epub_locator=NULL,
         progress=0,
         modified_at=excluded.modified_at`,
      documentId,
      bookId,
      format,
      uri,
      fileName,
      asset.mimeType ?? null,
      asset.size ?? null,
      existing?.created_at ?? now,
      now,
    );

  } catch (error) {
    await deleteOwnedDocument(uri).catch(() => undefined);
    throw error;
  }

  if (existing?.document_id) {
    // Existing LJingle entries remain; only stale locations from the replaced
    // file are removed.
    await database.runAsync(
      'DELETE FROM reader_entry_anchors WHERE document_id = ?',
      String(existing.document_id),
    ).catch(() => undefined);
    await database.runAsync(
      'DELETE FROM reader_bookmarks WHERE document_id = ?',
      String(existing.document_id),
    ).catch(() => undefined);
    emitReaderBookmarkChange(bookId);
  }

  if (existing?.uri && String(existing.uri) !== uri) {
    await deleteOwnedDocument(String(existing.uri)).catch(() => undefined);
  }

  const attached = await getBookDocument(bookId);
  if (attached) {
    void uploadReaderDocumentToServer(attached, true).catch(() => undefined);
  }
  return attached;
}

export async function removeBookDocument(bookId: string) {
  const database = await databaseWithReader();
  const existing = await database.getFirstAsync<DocumentRow>(
    'SELECT * FROM book_documents WHERE book_id = ?',
    bookId,
  );

  await database.runAsync(
    'INSERT INTO reader_document_remote_deletes (book_id, created_at) VALUES (?, ?) ' +
      'ON CONFLICT(book_id) DO UPDATE SET created_at=excluded.created_at',
    bookId,
    new Date().toISOString(),
  );

  await database.runAsync('DELETE FROM reader_bookmarks WHERE book_id = ?', bookId).catch(() => undefined);
  await database.runAsync('DELETE FROM book_documents WHERE book_id = ?', bookId);
  emitReaderBookmarkChange(bookId);
  if (existing?.uri) {
    await deleteOwnedDocument(String(existing.uri)).catch(() => undefined);
  }

  scheduleRemoteDeleteFlush(database);
}

export async function saveBookDocumentTheme(
  documentId: string,
  readerTheme: BookReaderTheme,
) {
  const database = await databaseWithReader();
  await database.runAsync(
    'UPDATE book_documents SET reader_theme=?, modified_at=? WHERE document_id=?',
    readerTheme,
    new Date().toISOString(),
    documentId,
  );
}

export async function savePdfPosition(
  documentId: string,
  bookId: string,
  page: number,
  totalPages: number,
) {
  const safePage = Math.max(1, Math.round(page));
  const safeTotal = Math.max(safePage, Math.round(totalPages));
  const progress = clampProgress((safePage / safeTotal) * 100);
  const database = await databaseWithReader();
  const now = new Date().toISOString();

  await database.runAsync(
    `UPDATE book_documents
     SET current_page=?, total_pages=?, progress=?, modified_at=?
     WHERE document_id=? AND book_id=?`,
    safePage,
    safeTotal,
    progress,
    now,
    documentId,
    bookId,
  );

  await database.runAsync(
    `UPDATE books
     SET total_pages=?, modified_at=?
     WHERE book_id=?`,
    safeTotal,
    now,
    bookId,
  );
  await saveBookReadingPageDirect(bookId, safePage);
}

export async function saveEpubPosition(
  documentId: string,
  bookId: string,
  locator: string,
  progressValue: number,
) {
  const progress = clampProgress(
    progressValue <= 1 ? progressValue * 100 : progressValue,
  );
  const database = await databaseWithReader();
  const now = new Date().toISOString();

  await database.runAsync(
    `UPDATE book_documents
     SET epub_locator=?, progress=?, modified_at=?
     WHERE document_id=? AND book_id=?`,
    locator || null,
    progress,
    now,
    documentId,
    bookId,
  );

  await database.runAsync(
    `UPDATE books
     SET progress=?,
         reading_status=CASE WHEN reading_status='LATER' THEN 'IN_PROGRESS' ELSE reading_status END,
         modified_at=?
     WHERE book_id=?`,
    progress,
    now,
    bookId,
  );
}

export async function saveReaderEntryAnchor(input: {
  entryId: string;
  documentId: string;
  bookId: string;
  format: BookDocumentFormat;
  page?: number | null;
  epubLocator?: string | null;
  selectedText?: string | null;
  selectionRects?: ReaderEntryAnchor['selectionRects'] | null;
}) {
  const database = await databaseWithReader();
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO reader_entry_anchors
     (anchor_id, entry_id, document_id, book_id, format, page, epub_locator,
      selected_text, selection_rects, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(entry_id) DO UPDATE SET
       document_id=excluded.document_id,
       book_id=excluded.book_id,
       format=excluded.format,
       page=excluded.page,
       epub_locator=excluded.epub_locator,
       selected_text=excluded.selected_text,
       selection_rects=excluded.selection_rects,
       modified_at=excluded.modified_at`,
    identifier('anchor'),
    input.entryId,
    input.documentId,
    input.bookId,
    input.format,
    input.page ?? null,
    input.epubLocator ?? null,
    input.selectedText?.trim() || null,
    input.selectionRects && input.selectionRects.length > 0 ? JSON.stringify(input.selectionRects) : null,
    now,
    now,
  );
}

export async function getReaderBookmarks(bookId: string) {
  const database = await databaseWithReader();
  const rows = await database.getAllAsync<BookmarkRow>(
    `SELECT * FROM reader_bookmarks
     WHERE book_id = ?
     ORDER BY CASE WHEN page IS NULL THEN 1 ELSE 0 END, page ASC, created_at ASC`,
    bookId,
  );
  return rows.map(mapBookmark);
}

export async function hasReaderBookmarks(bookId: string) {
  const database = await databaseWithReader();
  const row = await database.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM reader_bookmarks WHERE book_id = ?',
    bookId,
  );
  return Number(row?.total ?? 0) > 0;
}

export async function toggleReaderBookmark(input: {
  documentId: string;
  bookId: string;
  format: BookDocumentFormat;
  page?: number | null;
  epubLocator?: string | null;
}) {
  const database = await databaseWithReader();
  const page = input.format === 'PDF'
    ? Math.max(1, Math.round(Number(input.page) || 1))
    : null;
  const epubLocator = input.format === 'EPUB'
    ? String(input.epubLocator ?? '').trim() || null
    : null;

  if (input.format === 'EPUB' && !epubLocator) {
    throw new Error('EPUB mjesto još nije dostupno za bookmark.');
  }

  const existing = input.format === 'PDF'
    ? await database.getFirstAsync<BookmarkRow>(
        'SELECT * FROM reader_bookmarks WHERE document_id = ? AND page = ?',
        input.documentId,
        page,
      )
    : await database.getFirstAsync<BookmarkRow>(
        'SELECT * FROM reader_bookmarks WHERE document_id = ? AND epub_locator = ?',
        input.documentId,
        epubLocator,
      );

  if (existing) {
    await database.runAsync(
      'DELETE FROM reader_bookmarks WHERE bookmark_id = ?',
      existing.bookmark_id,
    );
    emitReaderBookmarkChange(input.bookId);
    return { bookmarked: false, bookmark: null as ReaderBookmark | null };
  }

  const now = new Date().toISOString();
  const bookmarkId = identifier('bookmark');
  await database.runAsync(
    `INSERT INTO reader_bookmarks
      (bookmark_id, document_id, book_id, format, page, epub_locator, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    bookmarkId,
    input.documentId,
    input.bookId,
    input.format,
    page,
    epubLocator,
    now,
    now,
  );

  emitReaderBookmarkChange(input.bookId);
  return {
    bookmarked: true,
    bookmark: {
      bookmarkId,
      documentId: input.documentId,
      bookId: input.bookId,
      format: input.format,
      page,
      epubLocator,
      createdAt: now,
    } satisfies ReaderBookmark,
  };
}

export async function removeReaderBookmark(bookmarkId: string, bookId: string) {
  const database = await databaseWithReader();
  await database.runAsync(
    'DELETE FROM reader_bookmarks WHERE bookmark_id = ? AND book_id = ?',
    bookmarkId,
    bookId,
  );
  emitReaderBookmarkChange(bookId);
}

export async function getReaderNotes(documentId: string) {
  const database = await databaseWithReader();
  const rows = await database.getAllAsync<AnchorRow>(
    `SELECT
       a.*,
       e.title AS entry_title,
       e.content AS entry_content,
       e.entry_type AS entry_type
     FROM reader_entry_anchors a
     JOIN entries e ON e.entry_id = a.entry_id
     WHERE a.document_id = ?
     ORDER BY a.created_at DESC`,
    documentId,
  );
  return rows.map(mapAnchor);
}

export async function getReaderAnchorPreviews(entryIds: string[]) {
  const ids = Array.from(new Set(entryIds.filter(Boolean)));
  if (ids.length === 0) return {} as Record<string, ReaderAnchorPreview>;

  const database = await databaseWithReader();
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await database.getAllAsync<{
    anchor_id: string;
    entry_id: string;
    document_id: string;
    book_id: string;
    format: BookDocumentFormat;
    page: number | null;
    epub_locator: string | null;
    selected_text: string | null;
    selection_rects: string | null;
  }>(
    `SELECT anchor_id, entry_id, document_id, book_id, format, page,
            epub_locator, selected_text, selection_rects
     FROM reader_entry_anchors
     WHERE entry_id IN (${placeholders})`,
    ...ids,
  );

  return rows.reduce<Record<string, ReaderAnchorPreview>>((result, row) => {
    result[String(row.entry_id)] = {
      anchorId: String(row.anchor_id),
      entryId: String(row.entry_id),
      documentId: String(row.document_id),
      bookId: String(row.book_id),
      format: row.format,
      page: row.page == null ? null : Number(row.page),
      epubLocator: row.epub_locator ?? null,
      selectedText: row.selected_text ?? null,
      selectionRects: row.selection_rects ? (() => {
        try {
          const parsed = JSON.parse(row.selection_rects);
          return Array.isArray(parsed) ? parsed.filter((value) => value && Number.isFinite(Number(value.page)) && typeof value.rect === 'string') : [];
        } catch {
          return [];
        }
      })() : [],
    };
    return result;
  }, {});
}
