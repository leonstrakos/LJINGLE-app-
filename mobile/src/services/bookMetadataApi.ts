import type {
  BookImportConfirmRequest,
  BookImportPreviewRequest,
  BookImportPreviewResponse,
  BookImportResultResponse,
  BookMetadataCandidate,
  BookMetadataDuplicate,
  BookMetadataIsbnResponse,
  BookMetadataSearchResponse,
  BookMetadataSource,
  MetadataProvider,
} from '../types/bookMetadata';
import type { BookResponse } from '../types/book';
import { ApiError, onlineApiRequest } from './apiClient';
import { bookApi } from './bookApi';

const protectedPersonalFields = [
  'readingStatus',
  'progress',
  'enjoyment',
  'favourite',
  'startedOn',
  'finishedOn',
  'activities',
  'timeHistory',
];

function normalizeIsbn(value: string | null | undefined) {
  return (value ?? '').replace(/[^0-9X]/gi, '').toUpperCase();
}

function preferredIsbn(candidate: BookMetadataCandidate) {
  const isbn13 = normalizeIsbn(candidate.isbn13);
  if (isbn13.length === 13) return isbn13;
  const isbn10 = normalizeIsbn(candidate.isbn10);
  return isbn10.length === 10 ? isbn10 : '';
}

function authorText(candidate: BookMetadataCandidate) {
  return candidate.authors.map((author) => author.trim()).filter(Boolean).join(', ');
}

function findDuplicates(candidate: BookMetadataCandidate, books: BookResponse[]) {
  const isbn = preferredIsbn(candidate);
  const title = candidate.title?.trim().toLocaleLowerCase('hr') ?? '';
  const author = authorText(candidate).toLocaleLowerCase('hr');

  return books.flatMap((book): BookMetadataDuplicate[] => {
    const reason =
      isbn && normalizeIsbn(book.isbn) === isbn
        ? 'ISBN'
        : title &&
            book.title.trim().toLocaleLowerCase('hr') === title &&
            book.author.trim().toLocaleLowerCase('hr') === author
          ? 'TITLE_AUTHOR'
          : null;
    return reason
      ? [{ bookId: book.bookId, title: book.title, author: book.author, isbn: book.isbn, reason }]
      : [];
  });
}

function changedFields(existing: BookResponse, candidate: BookMetadataCandidate) {
  const fields: string[] = [];
  if (existing.title !== candidate.title?.trim()) fields.push('title');
  if (existing.author !== authorText(candidate)) fields.push('author');
  if (normalizeIsbn(existing.isbn) !== preferredIsbn(candidate)) fields.push('isbn');
  if (existing.publishedYear !== candidate.publishedYear) fields.push('publishedYear');
  return fields;
}

async function localPreview(
  candidate: BookMetadataCandidate,
  targetBookId?: string,
): Promise<BookImportPreviewResponse> {
  const books = await bookApi.getAll();
  const duplicates = findDuplicates(candidate, books);
  const warnings: string[] = [];
  if (!candidate.title?.trim()) warnings.push('Izvor ne sadrži naslov.');
  if (!authorText(candidate)) warnings.push('Izvor ne sadrži autora.');
  if (!preferredIsbn(candidate)) warnings.push('Izvor ne sadrži ISBN-10 ili ISBN-13.');
  if (candidate.publishedYear === null) warnings.push('Izvor ne sadrži valjanu godinu izdanja.');

  if (warnings.length > 0) {
    return {
      candidate,
      action: 'BLOCKED',
      existingBook: null,
      duplicates,
      changedBibliographicFields: [],
      protectedPersonalFields,
      confirmationRequired: false,
      importable: false,
      warnings,
    };
  }

  const existing = targetBookId
    ? books.find((book) => book.bookId === targetBookId) ?? null
    : duplicates.length === 1
      ? books.find((book) => book.bookId === duplicates[0]!.bookId) ?? null
      : null;
  if (!existing && duplicates.length > 1) {
    return {
      candidate,
      action: 'BLOCKED',
      existingBook: null,
      duplicates,
      changedBibliographicFields: [],
      protectedPersonalFields,
      confirmationRequired: false,
      importable: false,
      warnings: ['Pronađeno je više mogućih duplikata.'],
    };
  }
  if (!existing) {
    return {
      candidate,
      action: 'CREATE',
      existingBook: null,
      duplicates,
      changedBibliographicFields: ['title', 'author', 'isbn', 'publishedYear'],
      protectedPersonalFields,
      confirmationRequired: false,
      importable: true,
      warnings: [],
    };
  }
  const changedBibliographicFields = changedFields(existing, candidate);
  return {
    candidate,
    action: changedBibliographicFields.length ? 'UPDATE_EXISTING' : 'ALREADY_IMPORTED',
    existingBook: existing,
    duplicates,
    changedBibliographicFields,
    protectedPersonalFields,
    confirmationRequired: changedBibliographicFields.length > 0,
    importable: true,
    warnings: [],
  };
}

export const bookMetadataApi = {
  search: (query: string, provider?: MetadataProvider, limit = 20) => {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    if (provider) {
      params.set('provider', provider);
    }
    return onlineApiRequest<BookMetadataSearchResponse>(`/book-metadata/search?${params.toString()}`);
  },

  lookupIsbn: (isbn: string) =>
    onlineApiRequest<BookMetadataIsbnResponse>(
      `/book-metadata/isbn/${encodeURIComponent(isbn)}`,
    ),

  reconcile: (sources: BookMetadataSource[]) =>
    onlineApiRequest<BookMetadataCandidate>('/book-metadata/reconcile', {
      method: 'POST',
      body: JSON.stringify({ sources }),
    }),

  async previewImport(payload: BookImportPreviewRequest) {
    const remotePreview = await onlineApiRequest<BookImportPreviewResponse>(
      '/book-metadata/imports/preview',
      {
      method: 'POST',
      body: JSON.stringify(payload),
      },
    );
    return localPreview(remotePreview.candidate, payload.targetBookId);
  },

  async confirmImport(payload: BookImportConfirmRequest): Promise<BookImportResultResponse> {
    const preview = await this.previewImport(payload);
    if (!preview.importable || preview.action === 'BLOCKED') {
      throw new ApiError(preview.warnings.join(' ') || 'Knjigu nije moguće uvesti.');
    }
    if (preview.action === 'UPDATE_EXISTING' && !payload.confirmMetadataUpdate) {
      throw new ApiError('Bibliografske promjene moraju biti potvrđene.');
    }
    const candidate = preview.candidate;
    const bibliographic = {
      title: candidate.title!.trim(),
      author: authorText(candidate),
      isbn: preferredIsbn(candidate),
      publishedYear: candidate.publishedYear!,
    };
    if (preview.action === 'CREATE') {
      const book = await bookApi.create({
        ...bibliographic,
        readingStatus: 'LATER',
        progress: 0,
        enjoyment: null,
        favourite: false,
        startedOn: null,
        finishedOn: null,
      });
      return {
        action: 'CREATE',
        book,
        changedBibliographicFields: preview.changedBibliographicFields,
        protectedPersonalFields,
      };
    }
    const existing = preview.existingBook!;
    const book =
      preview.action === 'UPDATE_EXISTING'
        ? await bookApi.update(existing.bookId, { ...existing, ...bibliographic })
        : existing;
    return {
      action: preview.action,
      book,
      changedBibliographicFields: preview.changedBibliographicFields,
      protectedPersonalFields,
    };
  },
};
