import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'ljingle.auth.token.v1';
const INSTALL_OWNER_KEY = 'ljingle.install.owner.v1';

let tokenCache: string | null = null;
let installOwnerCache: string | null = null;
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
    };
  }

  if (Platform.OS === 'web') {
    tokenCache = webGet(TOKEN_KEY);
    installOwnerCache = webGet(INSTALL_OWNER_KEY);
  } else {
    const [token, owner] = await Promise.all([
      nativeGet(TOKEN_KEY),
      nativeGet(INSTALL_OWNER_KEY),
    ]);

    tokenCache = token;
    installOwnerCache = owner;
  }

  restored = true;

  return {
    token: tokenCache,
    installOwnerId: installOwnerCache,
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
