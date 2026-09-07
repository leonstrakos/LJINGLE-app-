import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import {
  exportLocalData,
  importLocalData,
} from '../storage/backup';
import { getAuthToken } from '../auth/sessionStore';
import {
  ApiError,
  onlineApiRequest,
} from './apiClient';

// cloudSyncV1

export type CloudSyncReason =
  | 'APP_OPEN'
  | 'BACKGROUND'
  | 'PERIODIC'
  | 'MANUAL'
  | 'MANUAL_FORCE';

export type CloudSyncOutcome =
  | 'disabled'
  | 'synced'
  | 'uploaded'
  | 'cloud-newer'
  | 'conflict'
  | 'offline'
  | 'wifi-only'
  | 'error';

export type CloudSnapshotMeta = {
  revision: number;
  createdAt: string | null;
  deviceId: string;
  contentHash: string;
  schemaVersion: number;
  reason: string;
  backupBytes: number;
};

export type CloudSyncState = {
  deviceId: string;

  automatic: boolean;
  wifiOnly: boolean;

  lastSyncedHash: string | null;
  lastRevision: number | null;
  lastSyncedAt: string | null;

  lastOutcome: CloudSyncOutcome;
  lastError: string | null;
};

export type CloudSyncResult = {
  outcome: CloudSyncOutcome;
  state: CloudSyncState;
  manifest: CloudSnapshotMeta | null;
  localHash?: string;
};

const WEB_STORAGE_KEY =
  'ljingle_cloud_sync_v1';

const STATE_FILENAME =
  'ljingle-cloud-sync-v1.json';

// forkD3MobileAuthSecureStoreV1
const SYNC_API_BASE_URL =
  (
    process.env.EXPO_PUBLIC_SYNC_API_URL?.trim() ||
    'https://heraldsofthelion.org/ljingle-api'
  ).replace(/\/+$/, '');

let running:
  | Promise<CloudSyncResult>
  | null = null;

// checkpointRestoreDatabaseLockV1
let restoring: Promise<{ state: CloudSyncState; recoveryUri: string | null }> | null = null;

function freshState(): CloudSyncState {
  return {
    deviceId: '',
    automatic: true,
    wifiOnly: false,
    lastSyncedHash: null,
    lastRevision: null,
    lastSyncedAt: null,
    lastOutcome: 'disabled',
    lastError: null,
  };
}

function identifier() {
  return (
    'lj-' +
    Date.now().toString(36) +
    '-' +
    Math.random()
      .toString(36)
      .slice(2, 12)
  );
}

async function loadState(): Promise<CloudSyncState> {
  let parsed: Partial<CloudSyncState> = {};

  try {
    if (Platform.OS === 'web') {
      const text =
        globalThis.localStorage?.getItem(
          WEB_STORAGE_KEY,
        );

      if (text) {
        parsed =
          JSON.parse(text) as Partial<CloudSyncState>;
      }
    } else if (FileSystem.documentDirectory) {
      const uri =
        FileSystem.documentDirectory +
        STATE_FILENAME;

      const info =
        await FileSystem.getInfoAsync(uri);

      if (info.exists) {
        parsed =
          JSON.parse(
            await FileSystem.readAsStringAsync(uri),
          ) as Partial<CloudSyncState>;
      }
    }
  } catch {
    parsed = {};
  }

  const state: CloudSyncState = {
    ...freshState(),
    ...parsed,
  };

  if (!state.deviceId) {
    state.deviceId = identifier();
    await saveState(state);
  }

  return state;
}

async function saveState(
  state: CloudSyncState,
) {
  const text = JSON.stringify(state);

  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(
      WEB_STORAGE_KEY,
      text,
    );
    return;
  }

  if (!FileSystem.documentDirectory) {
    return;
  }

  await FileSystem.writeAsStringAsync(
    FileSystem.documentDirectory +
      STATE_FILENAME,
    text,
  );
}

export async function getCloudSyncState() {
  return loadState();
}

export async function setCloudSyncPreferences(
  next: Partial<
    Pick<
      CloudSyncState,
      'automatic' | 'wifiOnly'
    >
  >,
) {
  const state = await loadState();

  const updated: CloudSyncState = {
    ...state,
    ...next,
  };

  await saveState(updated);

  return updated;
}

function authHeaders():
  Record<string, string> {
  const token = getAuthToken();

  if (!token) {
    throw new Error(
      'Cloud Sync requires a signed-in LJingle account.',
    );
  }

  return {
    Authorization: 'Bearer ' + token,
  };
}

function normalizeBackupForHash(
  text: string,
) {
  const root =
    JSON.parse(text) as Record<string, unknown>;

  // Export timestamp is intentionally ignored:
  // exporting the same DB twice must produce the same
  // content fingerprint.
  delete root.exportedAt;

  return JSON.stringify(root);
}

function fingerprint(
  value: string,
) {
  // Two independent 32-bit hashes.
  // This is change detection, not password crypto.
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    const code =
      value.charCodeAt(index);

    a = Math.imul(
      a ^ code,
      16777619,
    );

    b = Math.imul(
      b ^ code,
      2246822519,
    );
  }

  return (
    (a >>> 0)
      .toString(16)
      .padStart(8, '0') +
    (b >>> 0)
      .toString(16)
      .padStart(8, '0')
  );
}

async function localSnapshot() {
  const backupJson =
    await exportLocalData();

  const parsed =
    JSON.parse(backupJson) as {
      version?: number;
    };

  return {
    backupJson,
    contentHash:
      fingerprint(
        normalizeBackupForHash(
          backupJson,
        ),
      ),
    schemaVersion:
      typeof parsed.version === 'number'
        ? parsed.version
        : 2,
  };
}

async function networkAllowed(
  state: CloudSyncState,
): Promise<
  'yes' | 'offline' | 'wifi-only'
> {
  if (Platform.OS === 'web') {
    return 'yes';
  }

  const network =
    await NetInfo.fetch();

  if (
    network.isConnected === false ||
    network.isInternetReachable === false
  ) {
    return 'offline';
  }

  if (
    state.wifiOnly &&
    network.type !== 'wifi' &&
    network.type !== 'ethernet'
  ) {
    return 'wifi-only';
  }

  return 'yes';
}

export async function getCloudManifest():
  Promise<CloudSnapshotMeta | null> {
  const result =
    await onlineApiRequest<
      CloudSnapshotMeta | undefined
    >(
      SYNC_API_BASE_URL + '/sync/manifest',
      {
        headers: authHeaders(),
      },
    );

  return result ?? null;
}

export async function listCloudSnapshots(
  limit = 30,
) {
  return onlineApiRequest<
    CloudSnapshotMeta[]
  >(
    SYNC_API_BASE_URL + '/sync/snapshots?limit=' +
      Math.max(
        1,
        Math.min(100, limit),
      ),
    {
      headers: authHeaders(),
    },
  );
}

export async function deleteCloudSnapshot(
  revision: number,
) {
  if (!Number.isInteger(revision) || revision < 1) {
    throw new Error('Neispravan cloud revision.');
  }

  const result = await onlineApiRequest<{
    deleted: boolean;
    revision: number;
  }>(
    SYNC_API_BASE_URL +
      '/sync/snapshots/' +
      revision,
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
  );

  return result;
}

async function upload(
  state: CloudSyncState,
  reason: string,
  local: Awaited<
    ReturnType<typeof localSnapshot>
  >,
) {
  const meta =
    await onlineApiRequest<
      CloudSnapshotMeta
    >(
      SYNC_API_BASE_URL + '/sync/snapshots',
      {
        method: 'POST',
        headers: {
          ...authHeaders(),

          'X-LJINGLE-DEVICE-ID':
            state.deviceId,

          'X-LJINGLE-CONTENT-HASH':
            local.contentHash,

          'X-LJINGLE-SCHEMA-VERSION':
            String(
              local.schemaVersion,
            ),

          'X-LJINGLE-SYNC-REASON':
            reason,
        },

        // Raw LJingle backup JSON.
        // No double-encoding giant JSON string.
        body: local.backupJson,
      },
    );

  const updated: CloudSyncState = {
    ...state,

    lastSyncedHash:
      meta.contentHash,

    lastRevision:
      meta.revision,

    lastSyncedAt:
      meta.createdAt ??
      new Date().toISOString(),

    lastOutcome: 'uploaded',
    lastError: null,
  };

  await saveState(updated);

  return {
    outcome:
      'uploaded' as const,
    state: updated,
    manifest: meta,
    localHash:
      local.contentHash,
  };
}

// namedPhoneCanonicalUpgradeV2
export async function forceUploadNamedCheckpoint(
  label: string,
): Promise<CloudSyncResult> {
  const clean = label
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 32);

  if (!clean) {
    throw new Error('Upiši naziv checkpointa.');
  }

  // Wait for an already-running background/manual sync instead of racing it.
  if (running) {
    try {
      await running;
    } catch {
      // Existing sync already records its own failure state.
    }
  }

  let state = await loadState();
  const allowed = await networkAllowed(state);

  if (allowed !== 'yes') {
    const updated = {
      ...state,
      lastOutcome: allowed,
      lastError: null,
    };

    await saveState(updated);

    return {
      outcome: allowed,
      state: updated,
      manifest: null,
    };
  }

  try {
    const local = await localSnapshot();
    // Server already persists X-LJINGLE-SYNC-REASON in snapshot .meta.json.
    return await upload(state, clean, local);
  } catch (caught) {
    const message =
      caught instanceof Error
        ? caught.message
        : 'Cloud Sync nije uspio.';

    const outcome: CloudSyncOutcome =
      caught instanceof ApiError
        ? 'offline'
        : 'error';

    state = {
      ...state,
      lastOutcome: outcome,
      lastError: message,
    };

    await saveState(state);

    return {
      outcome,
      state,
      manifest: null,
    };
  }
}


async function run(
  reason: CloudSyncReason,
  automatic: boolean,
  forceUpload: boolean,
): Promise<CloudSyncResult> {
  let state =
    await loadState();

  if (
    automatic &&
    !state.automatic
  ) {
    return {
      outcome: 'disabled',
      state,
      manifest: null,
    };
  }

  const allowed =
    await networkAllowed(state);

  if (allowed !== 'yes') {
    const updated = {
      ...state,
      lastOutcome: allowed,
      lastError: null,
    };

    await saveState(updated);

    return {
      outcome: allowed,
      state: updated,
      manifest: null,
    };
  }

  try {
    // Network check first: cheap manifest request.
    const manifest =
      await getCloudManifest();

    const local =
      await localSnapshot();

    if (
      forceUpload ||
      manifest == null
    ) {
      return upload(
        state,
        reason,
        local,
      );
    }

    if (
      manifest.contentHash ===
      local.contentHash
    ) {
      state = {
        ...state,

        lastSyncedHash:
          manifest.contentHash,

        lastRevision:
          manifest.revision,

        lastSyncedAt:
          manifest.createdAt ??
          state.lastSyncedAt,

        lastOutcome: 'synced',
        lastError: null,
      };

      await saveState(state);

      return {
        outcome: 'synced',
        state,
        manifest,
        localHash:
          local.contentHash,
      };
    }

    const base =
      state.lastSyncedHash;

    if (
      base &&
      manifest.contentHash !== base
    ) {
      // Another device/server changed after our
      // last shared checkpoint.
      if (
        local.contentHash === base
      ) {
        const updated = {
          ...state,
          lastOutcome:
            'cloud-newer' as const,
          lastError: null,
        };

        await saveState(updated);

        return {
          outcome: 'cloud-newer',
          state: updated,
          manifest,
          localHash:
            local.contentHash,
        };
      }

      // Both sides changed.
      // NEVER overwrite automatically.
      const updated = {
        ...state,
        lastOutcome:
          'conflict' as const,
        lastError: null,
      };

      await saveState(updated);

      return {
        outcome: 'conflict',
        state: updated,
        manifest,
        localHash:
          local.contentHash,
      };
    }

    if (
      base == null &&
      manifest.contentHash !==
        local.contentHash
    ) {
      // First encounter with an already-populated
      // cloud archive. Do not guess which side wins.
      const updated = {
        ...state,
        lastOutcome:
          'conflict' as const,
        lastError: null,
      };

      await saveState(updated);

      return {
        outcome: 'conflict',
        state: updated,
        manifest,
        localHash:
          local.contentHash,
      };
    }

    // Cloud still equals our last shared base,
    // therefore only local data changed.
    return upload(
      state,
      reason,
      local,
    );
  } catch (caught) {
    const message =
      caught instanceof Error
        ? caught.message
        : 'Cloud sync nije dostupan.';

    const outcome:
      CloudSyncOutcome =
      caught instanceof ApiError
        ? 'offline'
        : 'error';

    const updated = {
      ...state,
      lastOutcome: outcome,
      lastError: message,
    };

    await saveState(updated);

    return {
      outcome,
      state: updated,
      manifest: null,
    };
  }
}

export function runCloudSync(
  options?: {
    reason?: CloudSyncReason;
    automatic?: boolean;
    forceUpload?: boolean;
  },
): Promise<CloudSyncResult> {
  if (running) {
    return running;
  }

  running = (async () => {
    if (restoring) await restoring;
    return run(
      options?.reason ?? 'MANUAL',
      options?.automatic ?? false,
      options?.forceUpload ?? false,
    );
  })().finally(() => {
    running = null;
  });

  return running;
}

async function downloadSnapshot(
  revision?: number,
) {
  const path =
    revision == null
      ? '/sync/snapshots/latest'
      : '/sync/snapshots/' +
        revision;

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      15000,
    );

  try {
    const response =
      await fetch(
        SYNC_API_BASE_URL + path,
        {
          method: 'GET',
          headers: {
            Accept:
              'application/json',
            ...authHeaders(),
          },
          signal:
            controller.signal,
        },
      );

    if (!response.ok) {
      throw new Error(
        'Cloud snapshot nije dostupan (' +
          response.status +
          ').',
      );
    }

    return {
      text:
        await response.text(),

      revision:
        Number(
          response.headers.get(
            'X-LJINGLE-REVISION',
          ),
        ) || null,

      contentHash:
        response.headers.get(
          'X-LJINGLE-CONTENT-HASH',
        ),

      createdAt:
        response.headers.get(
          'X-LJINGLE-CREATED-AT',
        ),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function saveBeforeRestoreBackup(
  text: string,
) {
  if (
    Platform.OS === 'web' ||
    !FileSystem.documentDirectory
  ) {
    return null;
  }

  const stamp =
    new Date()
      .toISOString()
      .replace(/[:.]/g, '-');

  const filename =
    'ljingle-before-cloud-restore-' +
    stamp +
    '.json';

  const uri =
    FileSystem.documentDirectory +
    filename;

  await FileSystem.writeAsStringAsync(
    uri,
    text,
  );

  return uri;
}

export async function restoreCloudSnapshot(
  revision?: number,
) {
  if (restoring) return restoring;

  const task = (async () => {
    // Finish any in-flight upload/manifest comparison before taking the local
    // safety export. No cloud operation may overlap the destructive restore.
    if (running) await running.catch(() => undefined);

    const before =
      await exportLocalData();

  const recoveryUri =
    await saveBeforeRestoreBackup(
      before,
    );

  const remote =
    await downloadSnapshot(
      revision,
    );

  // Existing backup service performs the
  // destructive restore transaction + FK validation.
  await importLocalData(remote.text);

  const state =
    await loadState();

  const hash =
    remote.contentHash ??
    fingerprint(
      normalizeBackupForHash(
        remote.text,
      ),
    );

  const updated: CloudSyncState = {
    ...state,

    lastSyncedHash: hash,

    lastRevision:
      remote.revision,

    lastSyncedAt:
      remote.createdAt ??
      new Date().toISOString(),

    lastOutcome: 'synced',
    lastError: null,
  };

  await saveState(updated);

  return {
    state: updated,
    recoveryUri,
  };
  })();
  const gate = task.finally(() => {
    if (restoring === gate) restoring = null;
  });
  restoring = gate;
  return gate;
}