const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const files = {
  settings: path.join(
    SRC,
    'screens',
    'ThemePickerScreen.tsx',
  ),
  portableExport: path.join(
    SRC,
    'services',
    'portableExport.ts',
  ),
  portableImport: path.join(
    SRC,
    'services',
    'portableImport.ts',
  ),
};

for (
  const [name, file]
  of Object.entries(files)
) {
  if (!fs.existsSync(file)) {
    throw new Error(
      'SAFE STOP - missing ' +
        name +
        ': ' +
        path.relative(ROOT, file),
    );
  }
}

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

const backupDir = path.join(
  ROOT,
  '_recovery',
  'bridge-mobile-v1-' + stamp,
);

fs.mkdirSync(
  backupDir,
  { recursive: true },
);

function read(file) {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\r\n/g, '\n');
}

function write(file, text) {
  fs.mkdirSync(
    path.dirname(file),
    { recursive: true },
  );

  fs.writeFileSync(
    file,
    text,
    'utf8',
  );
}

function backup(file) {
  if (!fs.existsSync(file)) return;

  fs.copyFileSync(
    file,
    path.join(
      backupDir,
      path.basename(file),
    ),
  );
}

function fail(message) {
  throw new Error(
    'SAFE STOP - ' + message,
  );
}

for (
  const file of Object.values(files)
) {
  backup(file);
}

const bridgeApiFile = path.join(
  SRC,
  'services',
  'bridgeApi.ts',
);

const bridgePanelFile = path.join(
  SRC,
  'components',
  'BridgePanel.tsx',
);

backup(bridgeApiFile);
backup(bridgePanelFile);

// ============================================================================
// 1) BRIDGE CLIENT
// ============================================================================

write(
  bridgeApiFile,
  `import { getDatabase } from '../storage/database';
import type {
  LjinglePortablePackage,
} from '../types/portablePackage';

const BRIDGE_API_BASE =
  (
    process.env.EXPO_PUBLIC_SYNC_API_URL ||
    'https://heraldsofthelion.org/ljingle-api'
  ).replace(/\\/$/, '');

const SYNC_KEY =
  process.env.EXPO_PUBLIC_SYNC_KEY || '';

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

  await database.execAsync(\`
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
  \`);

  return database;
}

function bootstrapHeaders() {
  return SYNC_KEY
    ? {
        'X-LJINGLE-SYNC-KEY':
          SYNC_KEY,
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
    ...bootstrapHeaders(),
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
  const headers = identity
    ? await identityHeaders()
    : bootstrapHeaders();

  const response = await fetch(
    BRIDGE_API_BASE + route,
    {
      ...init,
      headers: {
        ...headers,
        ...(init.body
          ? {
              'Content-Type':
                'application/json',
            }
          : {}),
        ...(init.headers || {}),
      },
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

    throw new Error(message);
  }

  return body as T;
}

export async function getBridgeIdentity() {
  const database =
    await ensureSchema();

  const row =
    await database.getFirstAsync<Row>(
      \`SELECT bridge_id,
              bridge_token,
              created_at
         FROM bridge_identity
        WHERE identity_key='self'
        LIMIT 1\`,
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
    \`INSERT OR REPLACE INTO bridge_identity
      (identity_key, bridge_id,
       bridge_token, created_at)
     VALUES ('self', ?, ?, ?)\`,
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
      \`SELECT preference_value
         FROM bridge_preferences
        WHERE preference_key='peer_code'
        LIMIT 1\`,
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
    \`INSERT OR REPLACE INTO bridge_preferences
      (preference_key, preference_value)
     VALUES ('peer_code', ?)\`,
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
`,
);

// ============================================================================
// 2) SETTINGS BRIDGE PANEL
// ============================================================================

write(
  bridgePanelFile,
  `import {
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  activateBridge,
  dismissBridgeMessage,
  getBridgeIdentity,
  getBridgePeerCode,
  listBridgeInbox,
  setBridgePeerCode,
  type BridgeIdentity,
  type BridgeMessage,
} from '../services/bridgeApi';
import {
  addPortableImportsToJingles,
  importPortablePackage,
  type PortableJingleCandidate,
} from '../services/portableImport';
import { colors } from '../theme/colors';

function dateLabel(value: string) {
  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '';
  }

  return date.toLocaleString();
}

export function BridgePanel() {
  const [
    identity,
    setIdentity,
  ] =
    useState<BridgeIdentity | null>(
      null,
    );

  const [
    peerCode,
    setPeerCode,
  ] = useState('');

  const [
    inbox,
    setInbox,
  ] =
    useState<BridgeMessage[]>([]);

  const [
    jingleCandidates,
    setJingleCandidates,
  ] =
    useState<
      PortableJingleCandidate[]
    >([]);

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(null);

  const loadLocal =
    async () => {
      const [nextIdentity, peer] =
        await Promise.all([
          getBridgeIdentity(),
          getBridgePeerCode(),
        ]);

      setIdentity(nextIdentity);
      setPeerCode(peer);
    };

  useEffect(() => {
    void loadLocal();
  }, []);

  const activate =
    async () => {
      if (busy) return;

      setBusy(true);
      setMessage(null);

      try {
        const next =
          await activateBridge();

        setIdentity(next);
        setMessage(
          'Bridge je aktivan.',
        );
      } catch (caught) {
        setMessage(
          caught instanceof Error
            ? caught.message
            : 'Bridge activation failed.',
        );
      } finally {
        setBusy(false);
      }
    };

  const savePeer =
    async () => {
      if (busy) return;

      setBusy(true);
      setMessage(null);

      try {
        const saved =
          await setBridgePeerCode(
            peerCode,
          );

        setPeerCode(saved);

        setMessage(
          'Recipient spremljen.',
        );
      } catch (caught) {
        setMessage(
          caught instanceof Error
            ? caught.message
            : 'Recipient nije spremljen.',
        );
      } finally {
        setBusy(false);
      }
    };

  const refresh =
    async () => {
      if (busy) return;

      setBusy(true);
      setMessage(null);

      try {
        const next =
          await listBridgeInbox();

        setInbox(next);
        setIdentity(
          await getBridgeIdentity(),
        );
      } catch (caught) {
        setMessage(
          caught instanceof Error
            ? caught.message
            : 'Inbox nije dostupan.',
        );
      } finally {
        setBusy(false);
      }
    };

  const importMessage =
    async (
      item: BridgeMessage,
    ) => {
      if (busy) return;

      setBusy(true);
      setMessage(null);

      try {
        const result =
          await importPortablePackage(
            item.package,
          );

        await dismissBridgeMessage(
          item.messageId,
        );

        setInbox(
          (current) =>
            current.filter(
              (candidate) =>
                candidate.messageId !==
                item.messageId,
            ),
        );

        if (
          result.jingleCandidates
            .length
        ) {
          setJingleCandidates(
            result.jingleCandidates,
          );
        }

        setMessage(
          'Imported ' +
            result.imported +
            ' · reused ' +
            result.reused +
            ' · relations ' +
            result.relationships,
        );
      } catch (caught) {
        setMessage(
          caught instanceof Error
            ? caught.message
            : 'Bridge import failed.',
        );
      } finally {
        setBusy(false);
      }
    };

  const dismiss =
    async (
      item: BridgeMessage,
    ) => {
      if (busy) return;

      setBusy(true);

      try {
        await dismissBridgeMessage(
          item.messageId,
        );

        setInbox(
          (current) =>
            current.filter(
              (candidate) =>
                candidate.messageId !==
                item.messageId,
            ),
        );
      } catch (caught) {
        setMessage(
          caught instanceof Error
            ? caught.message
            : 'Message nije maknut.',
        );
      } finally {
        setBusy(false);
      }
    };

  const addJingles =
    async () => {
      if (
        busy ||
        !jingleCandidates.length
      ) {
        return;
      }

      setBusy(true);

      try {
        await addPortableImportsToJingles(
          jingleCandidates,
        );

        setMessage(
          'Dodano u tvoje Jingles.',
        );

        setJingleCandidates([]);
      } catch (caught) {
        setMessage(
          caught instanceof Error
            ? caught.message
            : 'Jingle status nije spremljen.',
        );
      } finally {
        setBusy(false);
      }
    };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>
            BRIDGE
          </Text>

          <Text style={styles.title}>
            Private handoff
          </Text>

          <Text style={styles.copy}>
            Send a real .ljingle object
            directly to another LJingle.
            Nothing imports automatically.
          </Text>
        </View>

        {busy ? (
          <ActivityIndicator
            color={colors.text}
            size="small"
          />
        ) : null}
      </View>

      {!identity ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() =>
            void activate()
          }
          style={({ pressed }) => [
            styles.primary,
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
        >
          <Text
            style={styles.primaryText}
          >
            ACTIVATE BRIDGE
          </Text>
        </Pressable>
      ) : (
        <>
          <View style={styles.identity}>
            <View style={styles.identityCopy}>
              <Text style={styles.label}>
                YOUR BRIDGE CODE
              </Text>

              <Text style={styles.code}>
                {identity.bridgeId}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                void Share.share({
                  message:
                    'My LJingle Bridge code: ' +
                    identity.bridgeId,
                })
              }
              style={({ pressed }) => [
                styles.smallButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.smallButtonText
                }
              >
                SHARE CODE
              </Text>
            </Pressable>
          </View>

          <View style={styles.peer}>
            <Text style={styles.label}>
              RECIPIENT CODE
            </Text>

            <View style={styles.peerRow}>
              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={9}
                onChangeText={
                  setPeerCode
                }
                placeholder="ABCD-EFGH"
                placeholderTextColor={
                  colors.textMuted
                }
                style={styles.input}
                value={peerCode}
              />

              <Pressable
                disabled={busy}
                onPress={() =>
                  void savePeer()
                }
                style={({ pressed }) => [
                  styles.smallButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.smallButtonText
                  }
                >
                  SAVE
                </Text>
              </Pressable>
            </View>

            <Text style={styles.hint}>
              Share glyph → Send via
              Bridge uses this recipient.
            </Text>
          </View>

          <View style={styles.inboxHeader}>
            <View>
              <Text style={styles.label}>
                INBOX
              </Text>

              <Text style={styles.inboxMeta}>
                {inbox.length}{' '}
                waiting
              </Text>
            </View>

            <Pressable
              disabled={busy}
              onPress={() =>
                void refresh()
              }
              style={({ pressed }) => [
                styles.smallButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.smallButtonText
                }
              >
                REFRESH
              </Text>
            </Pressable>
          </View>

          {inbox.map((item) => (
            <View
              key={item.messageId}
              style={styles.messageCard}
            >
              <View style={styles.messageTop}>
                <View
                  style={styles.messageCopy}
                >
                  <Text
                    style={styles.messageKind}
                  >
                    {item.kind}
                  </Text>

                  <Text
                    numberOfLines={2}
                    style={
                      styles.messageTitle
                    }
                  >
                    {item.title}
                  </Text>
                </View>

                <Text
                  style={styles.from}
                >
                  FROM{' '}
                  {item.fromBridgeId}
                </Text>
              </View>

              <Text style={styles.date}>
                {dateLabel(
                  item.createdAt,
                )}
              </Text>

              <View
                style={styles.messageActions}
              >
                <Pressable
                  disabled={busy}
                  onPress={() =>
                    void dismiss(item)
                  }
                  style={({ pressed }) => [
                    styles.secondary,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Text
                    style={
                      styles.secondaryText
                    }
                  >
                    DISMISS
                  </Text>
                </Pressable>

                <Pressable
                  disabled={busy}
                  onPress={() =>
                    void importMessage(
                      item,
                    )
                  }
                  style={({ pressed }) => [
                    styles.importButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Text
                    style={
                      styles.importText
                    }
                  >
                    IMPORT
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}

          {jingleCandidates.length >
          0 ? (
            <View
              style={
                styles.jinglePrompt
              }
            >
              <View
                style={
                  styles.jingleCopy
                }
              >
                <Text
                  style={
                    styles.jingleTitle
                  }
                >
                  Sender marked{' '}
                  {
                    jingleCandidates.length
                  }{' '}
                  as Jingle
                </Text>

                <Text
                  style={styles.hint}
                >
                  They were not added
                  automatically.
                </Text>
              </View>

              <Pressable
                disabled={busy}
                onPress={() =>
                  void addJingles()
                }
                style={({ pressed }) => [
                  styles.smallButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.smallButtonText
                  }
                >
                  ADD TO MINE
                </Text>
              </Pressable>
            </View>
          ) : null}
        </>
      )}

      {message ? (
        <Text style={styles.status}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 24,
    marginBottom: 18,
    paddingTop: 18,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor:
      colors.separator,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  title: {
    marginTop: 4,
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.25,
  },
  copy: {
    marginTop: 5,
    maxWidth: 560,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
  },
  primary: {
    marginTop: 13,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.black,
  },
  primaryText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  identity: {
    marginTop: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: colors.textMuted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  code: {
    marginTop: 4,
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  smallButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.fill,
  },
  smallButtonText: {
    color: colors.text,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  peer: {
    paddingVertical: 12,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor:
      colors.separator,
  },
  peerRow: {
    marginTop: 7,
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 39,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor:
      colors.separator,
    color: colors.text,
    backgroundColor:
      colors.surface,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  hint: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 13,
  },
  inboxHeader: {
    marginTop: 4,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    gap: 12,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor:
      colors.separator,
  },
  inboxMeta: {
    marginTop: 3,
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  messageCard: {
    paddingVertical: 12,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor:
      colors.separator,
  },
  messageTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  messageCopy: {
    flex: 1,
    minWidth: 0,
  },
  messageKind: {
    color: colors.textMuted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  messageTitle: {
    marginTop: 3,
    color: colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  from: {
    color: colors.textMuted,
    fontSize: 7,
    fontWeight: '800',
  },
  date: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 8,
  },
  messageActions: {
    marginTop: 9,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 7,
  },
  secondary: {
    minHeight: 34,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
  },
  importButton: {
    minHeight: 34,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: colors.black,
  },
  importText: {
    color: colors.white,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  jinglePrompt: {
    marginTop: 9,
    paddingTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor:
      colors.separator,
  },
  jingleCopy: {
    flex: 1,
    minWidth: 0,
  },
  jingleTitle: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
  },
  status: {
    marginTop: 9,
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 14,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.68,
  },
});
`,
);

// ============================================================================
// 3) MOUNT BRIDGE PANEL UNDER PORTABLE IMPORT
// ============================================================================

{
  let text =
    read(files.settings);

  const importLine =
    "import { BridgePanel } from '../components/BridgePanel';";

  if (!text.includes(importLine)) {
    const imports =
      [...text.matchAll(/^import .*;$/gm)];

    if (!imports.length) {
      fail(
        'ThemePicker import block missing',
      );
    }

    const last =
      imports[
        imports.length - 1
      ];

    const insertAt =
      last.index + last[0].length;

    text =
      text.slice(0, insertAt) +
      '\n' +
      importLine +
      text.slice(insertAt);
  }

  if (
    !text.includes(
      '<BridgePanel />',
    )
  ) {
    const portable =
      '<PortableImportPanel />';

    const index =
      text.indexOf(portable);

    if (index < 0) {
      fail(
        'ThemePicker PortableImportPanel anchor missing',
      );
    }

    const insertAt =
      index + portable.length;

    text =
      text.slice(0, insertAt) +
      '\n\n        <BridgePanel />' +
      text.slice(insertAt);
  }

  write(
    files.settings,
    text,
  );
}

// ============================================================================
// 4) SHARE GLYPH → BRIDGE OPTION
// ============================================================================

{
  let text =
    read(files.portableExport);

  const bridgeImport =
    "import { sendPackageToSavedBridge } from './bridgeApi';";

  if (
    !text.includes(
      bridgeImport,
    )
  ) {
    const imports =
      [...text.matchAll(/^import .*;$/gm)];

    if (!imports.length) {
      fail(
        'portableExport import block missing',
      );
    }

    const last =
      imports[
        imports.length - 1
      ];

    const insertAt =
      last.index + last[0].length;

    text =
      text.slice(0, insertAt) +
      '\n' +
      bridgeImport +
      text.slice(insertAt);
  }

  // Web custom share sheet.
  if (
    text.includes(
      "'SHARE .LJINGLE',\n          'portable',",
    ) &&
    !text.includes(
      "'SEND VIA BRIDGE',\n          'bridge',",
    )
  ) {
    const needle = `      actions.appendChild(
        button(
          'SHARE .LJINGLE',
          'portable',
        ),
      );`;

    if (!text.includes(needle)) {
      fail(
        'web share .ljingle button anchor changed',
      );
    }

    text = text.replace(
      needle,
      `      actions.appendChild(
        button(
          'SEND VIA BRIDGE',
          'bridge',
        ),
      );

${needle}`,
    );
  }

  // Native Alert.
  if (
    text.includes(
      "text: '.ljingle',",
    ) &&
    !text.includes(
      "text: 'Bridge',",
    )
  ) {
    const needle = `              {
                text: '.ljingle',
                onPress: () =>
                  resolve('portable'),
              },`;

    if (!text.includes(needle)) {
      fail(
        'native .ljingle choice anchor changed',
      );
    }

    text = text.replace(
      needle,
      `              {
                text: 'Bridge',
                onPress: () =>
                  resolve('bridge'),
              },
${needle}`,
    );
  }

  if (
    !text.includes(
      "choice === 'bridge'",
    )
  ) {
    const portableBranch = `  if (choice === 'portable') {
    return sharePackage(pack);
  }`;

    if (
      !text.includes(
        portableBranch,
      )
    ) {
      fail(
        'choosePortableShare portable branch changed',
      );
    }

    text = text.replace(
      portableBranch,
      `  if (choice === 'bridge') {
    const sent =
      await sendPackageToSavedBridge(
        pack,
      );

    Alert.alert(
      'Sent through Bridge',
      'Delivered to ' +
        sent.toBridgeId +
        '.',
    );

    return sent.messageId;
  }

${portableBranch}`,
    );
  }

  write(
    files.portableExport,
    text,
  );
}

console.log('');
console.log('BRIDGE MOBILE V1 INSTALLED');
console.log('✓ no new account system');
console.log('✓ Activate Bridge creates one private device identity');
console.log('✓ one simple recipient code in Settings');
console.log('✓ existing Share glyph gains SEND VIA BRIDGE');
console.log('✓ Bridge sends the same canonical .ljingle package');
console.log('✓ inbox is manual refresh, not a feed');
console.log('✓ import is always explicit');
console.log('✓ dismiss never touches local data');
console.log('✓ sender Jingles still require explicit ADD TO MINE');
console.log('✓ no Today/Home visual work touched');
console.log('BACKUP:', backupDir);
console.log('');

try {
  cp.execSync(
    'npx tsc --noEmit',
    {
      cwd: MOBILE,
      stdio: 'inherit',
      shell: true,
    },
  );

  console.log('');
  console.log(
    'TYPESCRIPT CLEAN ✓',
  );
} catch {
  console.error('');
  console.error(
    'TYPESCRIPT HAS ERRORS',
  );
  console.error(
    'Backup:',
    backupDir,
  );
  process.exitCode = 1;
}
