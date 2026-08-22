import type { BookResponse } from './book';

export type MetadataProvider = 'OPEN_LIBRARY' | 'GOOGLE_BOOKS';

export type BookMetadataSource = {
  provider: MetadataProvider;
  externalId: string;
};

export type BookMetadataCandidate = {
  title: string | null;
  authors: string[];
  isbn10: string | null;
  isbn13: string | null;
  publishedYear: number | null;
  publisher: string | null;
  pageCount: number | null;
  description: string | null;
  coverUrl: string | null;
  sources: BookMetadataSource[];
};

export type BookMetadataSearchResponse = {
  query: string;
  results: BookMetadataCandidate[];
  warnings: string[];
};

export type DuplicateReason = 'ISBN' | 'TITLE_AUTHOR';

export type BookMetadataDuplicate = {
  bookId: string;
  title: string;
  author: string;
  isbn: string;
  reason: DuplicateReason;
};

export type BookMetadataIsbnResponse = {
  isbn: string;
  candidate: BookMetadataCandidate | null;
  duplicates: BookMetadataDuplicate[];
  warnings: string[];
};

export type BookImportAction =
  | 'CREATE'
  | 'UPDATE_EXISTING'
  | 'ALREADY_IMPORTED'
  | 'BLOCKED';

export type BookImportPreviewRequest = {
  source: BookMetadataSource;
  targetBookId?: string;
};

export type BookImportPreviewResponse = {
  candidate: BookMetadataCandidate;
  action: BookImportAction;
  existingBook: BookResponse | null;
  duplicates: BookMetadataDuplicate[];
  changedBibliographicFields: string[];
  protectedPersonalFields: string[];
  confirmationRequired: boolean;
  importable: boolean;
  warnings: string[];
};

export type BookImportConfirmRequest = BookImportPreviewRequest & {
  confirmMetadataUpdate: boolean;
};

export type BookImportResultResponse = {
  action: Exclude<BookImportAction, 'BLOCKED'>;
  book: BookResponse;
  changedBibliographicFields: string[];
  protectedPersonalFields: string[];
};

export const metadataProviderLabels: Record<MetadataProvider, string> = {
  OPEN_LIBRARY: 'Open Library',
  GOOGLE_BOOKS: 'Google Books',
};
