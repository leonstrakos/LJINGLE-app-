export type BookDocumentFormat = 'PDF' | 'EPUB';

export type BookReaderTheme = 'DAY' | 'NIGHT';

export type ReaderSelectionRect = {
  page: number;
  rect: string;
};

export type BookDocument = {
  documentId: string;
  bookId: string;
  format: BookDocumentFormat;
  uri: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  currentPage: number | null;
  totalPages: number | null;
  epubLocator: string | null;
  progress: number;
  readerTheme: BookReaderTheme;
  createdAt: string;
  modifiedAt: string;
};

// ljingleCompletionSealReaderBookmarksR1:ReaderBookmarkType
export type ReaderBookmark = {
  bookmarkId: string;
  documentId: string;
  bookId: string;
  format: BookDocumentFormat;
  page: number | null;
  epubLocator: string | null;
  createdAt: string;
};

export type ReaderEntryAnchor = {
  anchorId: string;
  entryId: string;
  documentId: string;
  bookId: string;
  format: BookDocumentFormat;
  page: number | null;
  epubLocator: string | null;
  selectedText: string | null;
  selectionRects: ReaderSelectionRect[];
  createdAt: string;
  entryTitle: string | null;
  entryContent: string;
  entryType: string;
};

export type ReaderAnchorPreview = Pick<
  ReaderEntryAnchor,
  | 'anchorId'
  | 'entryId'
  | 'bookId'
  | 'documentId'
  | 'format'
  | 'page'
  | 'epubLocator'
  | 'selectedText'
  | 'selectionRects'
>;
