import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import type { LjingleUser } from './types';

// authOfflineLocalFirstV1

const TOKEN_KEY = 'ljingle.auth.token.v1';
const INSTALL_OWNER_KEY = 'ljingle.install.owner.v1';
const USER_KEY = 'ljingle.auth.user.v1';

let tokenCache: string | null = null;
let installOwnerCache: string | null = null;
let userCache: LjingleUser | null = null;
let restored = false;

function webGet(key: string) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function webSet(key: string, value: string | null) {
  try {
    if (value == null) {
      globalThis.localStorage?.removeItem(key);
    } else {
      globalThis.localStorage?.setItem(key, value);
    }
  } catch {
    // Auth state remains memory-only when browser storage is unavailable.
  }
}

async function nativeGet(key: string) {
  return SecureStore.getItemAsync(key);
}

async function nativeSet(
  key: string,
  value: string | null,
) {
  if (value == null) {
    await SecureStore.deleteItemAsync(key);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

export async function restoreAuthCache() {
  if (restored) {
    return {
      token: tokenCache,
      installOwnerId: installOwnerCache,
      user: userCache,
    };
  }

  let rawUser: string | null = null;

  if (Platform.OS === 'web') {
    tokenCache = webGet(TOKEN_KEY);
    installOwnerCache = webGet(INSTALL_OWNER_KEY);
    rawUser = webGet(USER_KEY);
  } else {
    const [token, owner, storedUser] = await Promise.all([
      nativeGet(TOKEN_KEY),
      nativeGet(INSTALL_OWNER_KEY),
      nativeGet(USER_KEY),
    ]);

    tokenCache = token;
    installOwnerCache = owner;
    rawUser = storedUser;
  }

  if (rawUser) {
    try {
      const parsed = JSON.parse(rawUser) as Partial<LjingleUser>;
      if (
        typeof parsed.id === 'string' &&
        typeof parsed.email === 'string' &&
        typeof parsed.username === 'string'
      ) {
        userCache = parsed as LjingleUser;
      }
    } catch {
      userCache = null;
    }
  }

  restored = true;

  return {
    token: tokenCache,
    installOwnerId: installOwnerCache,
    user: userCache,
  };
}

export function getAuthToken() {
  return tokenCache;
}

export function getInstallOwnerId() {
  return installOwnerCache;
}

export async function setAuthToken(
  token: string | null,
) {
  tokenCache = token;

  if (Platform.OS === 'web') {
    webSet(TOKEN_KEY, token);
  } else {
    await nativeSet(TOKEN_KEY, token);
  }
}

export async function setAuthUser(
  user: LjingleUser | null,
) {
  userCache = user;
  const serialized = user ? JSON.stringify(user) : null;

  if (Platform.OS === 'web') {
    webSet(USER_KEY, serialized);
  } else {
    await nativeSet(USER_KEY, serialized);
  }
}

export class InstallOwnerMismatchError extends Error {
  constructor() {
    super(
      'Ovaj LJingle installation već pripada drugom računu. ' +
        'Radi zaštite lokalne SQLite baze promjena računa je blokirana.',
    );
    this.name = 'InstallOwnerMismatchError';
  }
}

export async function claimInstallOwner(
  userId: string,
) {
  const clean = userId.trim();

  if (!clean) {
    throw new Error('Invalid authenticated user id.');
  }

  if (installOwnerCache && installOwnerCache !== clean) {
    throw new InstallOwnerMismatchError();
  }

  if (installOwnerCache === clean) {
    return;
  }

  installOwnerCache = clean;

  if (Platform.OS === 'web') {
    webSet(INSTALL_OWNER_KEY, clean);
  } else {
    await nativeSet(INSTALL_OWNER_KEY, clean);
  }
}
