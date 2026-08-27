import {
  getAuthToken,
} from '../auth/sessionStore';
import type {
  LjingleAuthSession,
  LjingleRegistration,
  LjingleUser,
} from '../auth/types';

const AUTH_BASE =
  (
    process.env.EXPO_PUBLIC_LJINGLE_API_URL?.trim() ||
    process.env.EXPO_PUBLIC_SYNC_API_URL?.trim() ||
    'https://heraldsofthelion.org/ljingle-api'
  ).replace(/\/+$/, '') + '/auth';

export class LjingleAuthError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(
    message: string,
    status: number,
    code: string | null,
  ) {
    super(message);
    this.name = 'LjingleAuthError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  explicitToken?: string | null,
): Promise<T> {
  const token =
    explicitToken === undefined
      ? getAuthToken()
      : explicitToken;

  const headers = new Headers(options.headers);

  headers.set('Accept', 'application/json');

  if (
    options.body != null &&
    !headers.has('Content-Type')
  ) {
    headers.set(
      'Content-Type',
      'application/json',
    );
  }

  if (token) {
    headers.set(
      'Authorization',
      'Bearer ' + token,
    );
  }

  const response = await fetch(
    AUTH_BASE + path,
    {
      ...options,
      headers,
    },
  );

  const text = await response.text();

  let body: unknown = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const record =
      body &&
      typeof body === 'object'
        ? (body as Record<string, unknown>)
        : null;

    const message =
      typeof record?.message === 'string'
        ? record.message
        : 'LJingle authentication failed.';

    const code =
      typeof record?.code === 'string'
        ? record.code
        : null;

    throw new LjingleAuthError(
      message,
      response.status,
      code,
    );
  }

  return body as T;
}

export const authApi = {
  login(
    login: string,
    password: string,
  ) {
    return request<LjingleAuthSession>(
      '/login',
      {
        method: 'POST',
        body: JSON.stringify({
          login: login.trim(),
          password,
        }),
      },
      null,
    );
  },

  register(input: LjingleRegistration) {
    return request<LjingleAuthSession>(
      '/register',
      {
        method: 'POST',
        body: JSON.stringify({
          email: input.email.trim(),
          username: input.username.trim(),
          password: input.password,
          inviteCode: input.inviteCode.trim(),
        }),
      },
      null,
    );
  },

  async me() {
    const result =
      await request<{ user: LjingleUser }>(
        '/me',
      );

    return result.user;
  },

  logout() {
    return request<{ loggedOut?: boolean }>(
      '/logout',
      {
        method: 'POST',
      },
    );
  },

  logoutToken(token: string) {
    return request<{ loggedOut?: boolean }>(
      '/logout',
      {
        method: 'POST',
      },
      token,
    );
  },
};
