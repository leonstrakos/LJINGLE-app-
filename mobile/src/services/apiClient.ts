import { API_BASE_URL } from '../config/api';
import { localApiRequest, LocalApiFailure } from '../storage/localApi';

type ApiErrorPayload = {
  message?: string;
  fieldErrors?: Record<string, string>;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isLocalPath(path: string) {
  const pathname = path.split('?')[0] ?? path;
  if (pathname.startsWith('/book-metadata/')) return false;
  if (pathname.startsWith('/games/metadata/')) return false;
  if (pathname.startsWith('/media/tmdb/')) return false;

  return [
    '/books',
    '/topics',
    '/activities',
    '/entries',
    '/games',
    '/media',
    '/stats',
    '/history',
    '/collections',
    '/entity-links',
    '/entity-references',
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function onlineApiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      let payload: ApiErrorPayload = {};
      try {
        payload = (await response.json()) as ApiErrorPayload;
      } catch {
        // Backend nije vratio JSON; koristimo generičku poruku ispod.
      }

      throw new ApiError(
        payload.message ?? `Zahtjev nije uspio (${response.status}).`,
        response.status,
        payload.fieldErrors,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Online pretraga je trajala predugo. Provjerite internetsku vezu.');
    }
    throw new ApiError(
      'Online pretraga trenutačno nije dostupna. Lokalni katalog i timeri i dalje rade.',
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  if (!isLocalPath(path)) return onlineApiRequest<T>(path, options);

  try {
    return await localApiRequest<T>(path, options);
  } catch (error) {
    if (error instanceof LocalApiFailure) {
      throw new ApiError(error.message, error.status, error.fieldErrors);
    }
    if (error instanceof Error) {
      throw new ApiError(error.message);
    }
    throw new ApiError('Lokalni zapis nije uspio.');
  }
}
