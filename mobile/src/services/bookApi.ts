import type {
  BookRequest,
  BookResponse,
  PagedBooks,
} from '../types/book';
import { apiRequest } from './apiClient';

export { ApiError } from './apiClient';

export const bookApi = {
  getAll: () => apiRequest<BookResponse[]>('/books'),

  getPage: (page = 0, size = 10) =>
    apiRequest<PagedBooks>(`/books?page=${page}&size=${size}`),

  getById: (bookId: string) => apiRequest<BookResponse>(`/books/${bookId}`),

  create: (payload: BookRequest) =>
    apiRequest<BookResponse>('/books', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (bookId: string, payload: BookRequest) =>
    apiRequest<BookResponse>(`/books/${bookId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // // catalogueJingleProgressSemanticsV1:BookJingle
  setFavourite: (
    bookId: string,
    favourite: boolean,
  ) =>
    apiRequest<BookResponse>(
      `/books/${encodeURIComponent(bookId)}/favourite`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          favourite,
        }),
      },
    ),

  remove: (bookId: string) =>
    apiRequest<void>(`/books/${bookId}`, {
      method: 'DELETE',
    }),
};

// catalogueJingleProgressSemanticsV1
