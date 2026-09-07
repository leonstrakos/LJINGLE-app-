import { getAuthToken } from '../auth/sessionStore';
import type {
  ReceivedJingle,
  SocialCatalogue,
  SocialCollectionSnapshot,
  SocialEntitySnapshot,
  SocialEntrySnapshot,
  // ljinglePortalCleanMineSharedEntriesR1
  SocialProfile,
  SocialSearchResult,
  SocialMemoryCapsuleSnapshot,
} from '../types/social';

const API_ROOT = (
  process.env.EXPO_PUBLIC_LJINGLE_API_URL?.trim() ||
  process.env.EXPO_PUBLIC_SYNC_API_URL?.trim() ||
  'https://heraldsofthelion.org/ljingle-api'
).replace(/\/+$/, '');

// ljinglePortalAvatarMobileR1
export function socialImageSource(value: string | null | undefined) {
  const clean = value?.trim();
  if (!clean) return null;
  // ljinglePortalAvatarInternalUrlAuthR6
  const external = clean.toLowerCase().startsWith('https://');
  const uri = external
    ? clean
    : API_ROOT + (clean.startsWith('/') ? clean : '/' + clean);
  const internal = !external || uri.startsWith(API_ROOT + '/');
  const token = internal ? getAuthToken() : null;
  return token
    ? { uri, headers: { Authorization: 'Bearer ' + token } }
    : { uri };
}

export class SocialApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = 'SocialApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  if (!token) throw new SocialApiError('Prijavi se za pristup Jingle Portalu.', 401, 'UNAUTHORIZED');

  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', 'Bearer ' + token);
  if (options.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(API_ROOT + path, { ...options, headers });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }

  if (!response.ok) {
    const record = body && typeof body === 'object' ? body as Record<string, unknown> : null;
    throw new SocialApiError(
      typeof record?.message === 'string' ? record.message : 'Jingle Portal nije dostupan.',
      response.status,
      typeof record?.code === 'string' ? record.code : null,
    );
  }

  return body as T;
}

// ljinglePortalDirectSendTrueCapsuleR2:api
export const socialApi = {
  me: () => request<{ profile: SocialProfile }>('/social/me'),

  updateProfile: (payload: {
    displayName: string;
    bio?: string | null;
    avatarUrl?: string | null;
    discoverable: boolean;
  }) => request<{ profile: SocialProfile }>('/social/me', {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),

  uploadAvatar: (payload: {
    base64: string;
    mimeType: string | null;
    fileName: string | null;
  }) => request<{ profile: SocialProfile }>('/social/me/avatar', {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),

  deleteAvatar: () => request<{ profile: SocialProfile }>('/social/me/avatar', {
    method: 'DELETE',
  }),

  publishProjection: (payload: {
    entities: SocialEntitySnapshot[];
    collections: SocialCollectionSnapshot[];
    entries: SocialEntrySnapshot[];
  }) => request<{ profile: SocialProfile; publishedAt: string }>('/social/projection', {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),

  search: (query: string, limit = 30) => {
    const params = new URLSearchParams({ q: query.trim(), limit: String(limit) });
    return request<{ results: SocialSearchResult[] }>('/social/search?' + params.toString());
  },

  profile: (username: string) =>
    request<{ profile: SocialProfile }>('/social/users/' + encodeURIComponent(username)),

  catalogue: (username: string) =>
    request<SocialCatalogue>('/social/users/' + encodeURIComponent(username) + '/catalogue'),

  sendJingle: (payload: {
    recipientUsername: string;
    entityType: SocialEntitySnapshot['kind'] | 'COLLECTION' | 'CAPSULE';
    entity: SocialEntitySnapshot | SocialCollectionSnapshot | SocialMemoryCapsuleSnapshot;
    message?: string | null;
    clientRequestId: string;
  }) => request<{ id: string; createdAt: string }>('/jingles/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  received: () => request<{ jingles: ReceivedJingle[] }>('/jingles/received'),

  setJingleStatus: (id: string, status: 'ACCEPTED' | 'DISMISSED') =>
    request<{ jingle: ReceivedJingle }>('/jingles/' + encodeURIComponent(id) + '/status', {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
};
