import { getDatabase } from '../storage/database';
import type {
  LjinglePortablePackage,
} from '../types/portablePackage';

const BRIDGE_API_BASE =
  (
    process.env.EXPO_PUBLIC_SYNC_API_URL ||
    'https://heraldsofthelion.org/ljingle-api'
  ).replace(/\/$/, '');

// forkBBridgeAuthV2
const BRIDGE_BOOTSTRAP_KEY =
  process.env.EXPO_PUBLIC_BRIDGE_BOOTSTRAP_KEY?.trim() ?? '';

type Row = Record<
  string,
  string | number | null | undefined
>;

export type BridgeIdentity = {
  bridgeId: string;
  bridgeToken: string;
  createdAt: string;
};

export type BridgeMessage = {
  messageId: string;
  fromBridgeId: string;
  toBridgeId: string;
  createdAt: string;
  title: string;
  kind: string;
  package: LjinglePortablePackage;
};

function normalizeBridgeCode(
  value: string,
) {
  const clean = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (clean.length !== 8) {
    return '';
  }

  return (
    clean.slice(0, 4) +
    '-' +
    clean.slice(4)
  );
}

async function ensureSchema() {
  const database =
    await getDatabase();

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS bridge_identity (
      identity_key TEXT PRIMARY KEY,
      bridge_id TEXT NOT NULL,
      bridge_token TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bridge_preferences (
      preference_key TEXT PRIMARY KEY,
      preference_value TEXT
    );
  `);

  return database;
}

function bootstrapHeaders() {
  return BRIDGE_BOOTSTRAP_KEY
    ? {
        'X-LJINGLE-BRIDGE-BOOTSTRAP-KEY':
          BRIDGE_BOOTSTRAP_KEY,
      }
    : {};
}

async function identityHeaders() {
  const identity =
    await getBridgeIdentity();

  if (!identity) {
    throw new Error(
      'Bridge nije aktiviran.',
    );
  }

  return {
    'X-LJINGLE-BRIDGE-ID':
      identity.bridgeId,
    'X-LJINGLE-BRIDGE-TOKEN':
      identity.bridgeToken,
  };
}

async function request<T>(
  route: string,
  init: RequestInit = {},
  identity = false,
): Promise<T> {
  const baseHeaders = identity
    ? await identityHeaders()
    : bootstrapHeaders();

  const headers = new Headers();

  for (const [key, value] of Object.entries(
    baseHeaders,
  )) {
    if (value) {
      headers.set(key, String(value));
    }
  }

  if (init.body) {
    headers.set(
      'Content-Type',
      'application/json',
    );
  }

  if (init.headers) {
    new Headers(init.headers).forEach(
      (value, key) => {
        headers.set(key, value);
      },
    );
  }

  const response = await fetch(
    BRIDGE_API_BASE + route,
    {
      ...init,
      headers,
    },
  );

  const text =
    await response.text();

  let body: unknown = null;

  try {
    body = text
      ? JSON.parse(text)
      : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      body &&
      typeof body === 'object' &&
      'message' in body
        ? String(
            (
              body as {
                message?: unknown;
              }
            ).message ||
              'Bridge request failed.',
          )
        : 'Bridge request failed (' +
          response.status +
          ').';

    if (message === 'Bridge bootstrap key rejected.') {
      throw new Error(
        'Bridge registration key nije prihvaćen. Provjeri EXPO_PUBLIC_BRIDGE_BOOTSTRAP_KEY naspram VPS LJINGLE_BRIDGE_BOOTSTRAP_KEY pa restartaj Metro s -c.',
      );
    }

    throw new Error(message);
  }

  return body as T;
}

export async function getBridgeIdentity() {
  const database =
    await ensureSchema();

  const row =
    await database.getFirstAsync<Row>(
      `SELECT bridge_id,
              bridge_token,
              created_at
         FROM bridge_identity
        WHERE identity_key='self'
        LIMIT 1`,
    );

  if (
    !row?.bridge_id ||
    !row?.bridge_token
  ) {
    return null;
  }

  return {
    bridgeId:
      String(row.bridge_id),
    bridgeToken:
      String(row.bridge_token),
    createdAt:
      String(
        row.created_at || '',
      ),
  } satisfies BridgeIdentity;
}

export async function activateBridge() {
  const existing =
    await getBridgeIdentity();

  if (existing) return existing;

  const created =
    await request<BridgeIdentity>(
      '/bridge/register',
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );

  const database =
    await ensureSchema();

  await database.runAsync(
    `INSERT OR REPLACE INTO bridge_identity
      (identity_key, bridge_id,
       bridge_token, created_at)
     VALUES ('self', ?, ?, ?)`,
    created.bridgeId,
    created.bridgeToken,
    created.createdAt,
  );

  return created;
}

export async function getBridgePeerCode() {
  const database =
    await ensureSchema();

  const row =
    await database.getFirstAsync<Row>(
      `SELECT preference_value
         FROM bridge_preferences
        WHERE preference_key='peer_code'
        LIMIT 1`,
    );

  return row?.preference_value
    ? String(
        row.preference_value,
      )
    : '';
}

export async function setBridgePeerCode(
  value: string,
) {
  const code =
    normalizeBridgeCode(value);

  if (!code) {
    throw new Error(
      'Bridge code mora imati 8 znakova.',
    );
  }

  const database =
    await ensureSchema();

  await database.runAsync(
    `INSERT OR REPLACE INTO bridge_preferences
      (preference_key, preference_value)
     VALUES ('peer_code', ?)`,
    code,
  );

  return code;
}

export async function sendBridgePackage(
  toBridgeId: string,
  pack: LjinglePortablePackage,
) {
  const code =
    normalizeBridgeCode(
      toBridgeId,
    );

  if (!code) {
    throw new Error(
      'Recipient Bridge code nije valjan.',
    );
  }

  return request<{
    messageId: string;
    toBridgeId: string;
    createdAt: string;
  }>(
    '/bridge/send',
    {
      method: 'POST',
      body: JSON.stringify({
        toBridgeId: code,
        package: pack,
      }),
    },
    true,
  );
}

export async function sendPackageToSavedBridge(
  pack: LjinglePortablePackage,
) {
  await activateBridge();

  const peer =
    await getBridgePeerCode();

  if (!peer) {
    throw new Error(
      'Prvo spremi recipient code u Settings → Bridge.',
    );
  }

  return sendBridgePackage(
    peer,
    pack,
  );
}

export async function listBridgeInbox() {
  await activateBridge();

  const result =
    await request<{
      messages: BridgeMessage[];
    }>(
      '/bridge/inbox',
      {
        method: 'GET',
      },
      true,
    );

  return result.messages;
}

export async function dismissBridgeMessage(
  messageId: string,
) {
  await request<{ ok: true }>(
    '/bridge/messages/' +
      encodeURIComponent(
        messageId,
      ),
    {
      method: 'DELETE',
    },
    true,
  );
}
