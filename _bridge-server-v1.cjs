const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const proxyFile = '/opt/ljingle/proxy.mjs';
const bridgeFile = '/opt/ljingle/bridge.mjs';
const dataDir = '/opt/ljingle/data/bridge';

if (!fs.existsSync(proxyFile)) {
  throw new Error('SAFE STOP - /opt/ljingle/proxy.mjs missing');
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = `/opt/ljingle/_recovery/bridge-v1-${stamp}`;
fs.mkdirSync(backupDir, { recursive: true });

fs.copyFileSync(
  proxyFile,
  path.join(backupDir, 'proxy.mjs'),
);

if (fs.existsSync(bridgeFile)) {
  fs.copyFileSync(
    bridgeFile,
    path.join(backupDir, 'bridge.mjs'),
  );
}

const bridgeSource = String.raw`import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT =
  process.env.LJINGLE_BRIDGE_DATA_DIR ||
  '/opt/ljingle/data/bridge';

const SYNC_KEY =
  process.env.LJINGLE_SYNC_KEY || '';

const MAX_BODY =
  60 * 1024 * 1024;

const CODE_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function cors(res) {
  res.setHeader(
    'Access-Control-Allow-Origin',
    '*',
  );
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,DELETE,OPTIONS',
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    [
      'Content-Type',
      'X-LJINGLE-SYNC-KEY',
      'X-LJINGLE-BRIDGE-ID',
      'X-LJINGLE-BRIDGE-TOKEN',
    ].join(', '),
  );
}

function json(res, status, body) {
  cors(res);
  res.writeHead(status, {
    'Content-Type':
      'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(body));
}

async function bodyJson(req) {
  let size = 0;
  const parts = [];

  for await (const chunk of req) {
    size += chunk.length;

    if (size > MAX_BODY) {
      const error =
        new Error('Bridge payload is too large.');
      error.status = 413;
      throw error;
    }

    parts.push(chunk);
  }

  if (!parts.length) return {};

  const text =
    Buffer.concat(parts).toString('utf8');

  return JSON.parse(text);
}

function cleanCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function formatCode(raw) {
  const clean = cleanCode(raw);

  if (clean.length !== 8) return null;

  return (
    clean.slice(0, 4) +
    '-' +
    clean.slice(4)
  );
}

function randomCode() {
  let value = '';

  for (let index = 0; index < 8; index += 1) {
    value +=
      CODE_ALPHABET[
        crypto.randomInt(
          0,
          CODE_ALPHABET.length,
        )
      ];
  }

  return formatCode(value);
}

function tokenHash(value) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

function safeId(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

function identityPath(bridgeId) {
  return path.join(
    ROOT,
    'identities',
    cleanCode(bridgeId) + '.json',
  );
}

function inboxDir(bridgeId) {
  return path.join(
    ROOT,
    'inboxes',
    cleanCode(bridgeId),
  );
}

async function ensureDirs() {
  await fs.mkdir(
    path.join(ROOT, 'identities'),
    { recursive: true },
  );

  await fs.mkdir(
    path.join(ROOT, 'inboxes'),
    { recursive: true },
  );
}

async function readIdentity(bridgeId) {
  try {
    return JSON.parse(
      await fs.readFile(
        identityPath(bridgeId),
        'utf8',
      ),
    );
  } catch {
    return null;
  }
}

function bootstrapAllowed(req) {
  if (!SYNC_KEY) return true;

  return (
    req.headers['x-ljingle-sync-key'] ===
    SYNC_KEY
  );
}

async function authenticate(req) {
  const bridgeId =
    formatCode(
      req.headers[
        'x-ljingle-bridge-id'
      ],
    );

  const token =
    String(
      req.headers[
        'x-ljingle-bridge-token'
      ] || '',
    );

  if (!bridgeId || !token) {
    return null;
  }

  const identity =
    await readIdentity(bridgeId);

  if (!identity) return null;

  if (
    tokenHash(token) !==
    identity.tokenHash
  ) {
    return null;
  }

  return identity;
}

async function atomicJson(file, value) {
  const temp =
    file + '.tmp-' + crypto.randomUUID();

  await fs.writeFile(
    temp,
    JSON.stringify(value),
    'utf8',
  );

  await fs.rename(temp, file);
}

async function register(res) {
  await ensureDirs();

  let bridgeId = null;

  for (
    let attempt = 0;
    attempt < 30;
    attempt += 1
  ) {
    const candidate =
      randomCode();

    if (!candidate) continue;

    if (
      !(await readIdentity(candidate))
    ) {
      bridgeId = candidate;
      break;
    }
  }

  if (!bridgeId) {
    return json(
      res,
      503,
      {
        message:
          'Could not create Bridge identity.',
      },
    );
  }

  const bridgeToken =
    crypto.randomBytes(32)
      .toString('base64url');

  const identity = {
    bridgeId,
    tokenHash:
      tokenHash(bridgeToken),
    createdAt:
      new Date().toISOString(),
  };

  await atomicJson(
    identityPath(bridgeId),
    identity,
  );

  await fs.mkdir(
    inboxDir(bridgeId),
    { recursive: true },
  );

  return json(
    res,
    201,
    {
      bridgeId,
      bridgeToken,
      createdAt:
        identity.createdAt,
    },
  );
}

function validatePackage(pack) {
  return Boolean(
    pack &&
      pack.format === 'ljingle' &&
      Array.isArray(pack.objects) &&
      Array.isArray(
        pack.relationships,
      ) &&
      Array.isArray(pack.assets),
  );
}

async function sendMessage(
  req,
  res,
  sender,
) {
  const body =
    await bodyJson(req);

  const toBridgeId =
    formatCode(
      body.toBridgeId,
    );

  if (!toBridgeId) {
    return json(
      res,
      400,
      {
        message:
          'Recipient Bridge code is invalid.',
      },
    );
  }

  if (
    !(await readIdentity(toBridgeId))
  ) {
    return json(
      res,
      404,
      {
        message:
          'Recipient Bridge does not exist.',
      },
    );
  }

  if (!validatePackage(body.package)) {
    return json(
      res,
      400,
      {
        message:
          'Payload is not a valid .ljingle object.',
      },
    );
  }

  const messageId =
    crypto.randomUUID();

  const message = {
    messageId,
    fromBridgeId:
      sender.bridgeId,
    toBridgeId,
    createdAt:
      new Date().toISOString(),
    title:
      String(
        body.package.title ||
          'LJingle object',
      ).slice(0, 300),
    kind:
      String(
        body.package.kind ||
          'UNKNOWN',
      ).slice(0, 40),
    package: body.package,
  };

  const dir =
    inboxDir(toBridgeId);

  await fs.mkdir(
    dir,
    { recursive: true },
  );

  await atomicJson(
    path.join(
      dir,
      messageId + '.json',
    ),
    message,
  );

  return json(
    res,
    201,
    {
      messageId,
      toBridgeId,
      createdAt:
        message.createdAt,
    },
  );
}

async function listInbox(
  res,
  identity,
) {
  const dir =
    inboxDir(identity.bridgeId);

  await fs.mkdir(
    dir,
    { recursive: true },
  );

  const names =
    (await fs.readdir(dir))
      .filter(
        (name) =>
          name.endsWith('.json'),
      );

  const messages = [];

  for (const name of names) {
    try {
      const message =
        JSON.parse(
          await fs.readFile(
            path.join(dir, name),
            'utf8',
          ),
        );

      messages.push(message);
    } catch {
      // Ignore isolated broken message file.
    }
  }

  messages.sort(
    (a, b) =>
      String(b.createdAt)
        .localeCompare(
          String(a.createdAt),
        ),
  );

  return json(
    res,
    200,
    {
      messages:
        messages.slice(0, 30),
    },
  );
}

async function deleteMessage(
  res,
  identity,
  messageId,
) {
  const clean =
    safeId(messageId);

  if (!clean) {
    return json(
      res,
      400,
      { message: 'Invalid message.' },
    );
  }

  const file =
    path.join(
      inboxDir(identity.bridgeId),
      clean + '.json',
    );

  try {
    await fs.unlink(file);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return json(
        res,
        404,
        {
          message:
            'Bridge message not found.',
        },
      );
    }

    throw error;
  }

  return json(
    res,
    200,
    { ok: true },
  );
}

export async function handleBridgeRequest(
  req,
  res,
  url,
) {
  if (
    !url.pathname.startsWith(
      '/bridge',
    )
  ) {
    return false;
  }

  cors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  try {
    if (
      req.method === 'GET' &&
      url.pathname ===
        '/bridge/health'
    ) {
      json(
        res,
        200,
        {
          ok: true,
          service:
            'ljingle-bridge',
        },
      );
      return true;
    }

    if (!bootstrapAllowed(req)) {
      json(
        res,
        401,
        {
          message:
            'Bridge bootstrap key rejected.',
        },
      );
      return true;
    }

    if (
      req.method === 'POST' &&
      url.pathname ===
        '/bridge/register'
    ) {
      await register(res);
      return true;
    }

    const identity =
      await authenticate(req);

    if (!identity) {
      json(
        res,
        401,
        {
          message:
            'Bridge identity rejected.',
        },
      );
      return true;
    }

    if (
      req.method === 'POST' &&
      url.pathname ===
        '/bridge/send'
    ) {
      await sendMessage(
        req,
        res,
        identity,
      );
      return true;
    }

    if (
      req.method === 'GET' &&
      url.pathname ===
        '/bridge/inbox'
    ) {
      await listInbox(
        res,
        identity,
      );
      return true;
    }

    const messageMatch =
      url.pathname.match(
        /^\/bridge\/messages\/([^/]+)$/,
      );

    if (
      req.method === 'DELETE' &&
      messageMatch
    ) {
      await deleteMessage(
        res,
        identity,
        messageMatch[1],
      );
      return true;
    }

    json(
      res,
      404,
      {
        message:
          'Bridge route not found.',
      },
    );
    return true;
  } catch (error) {
    console.error(
      'Bridge error:',
      error,
    );

    json(
      res,
      Number(error?.status || 500),
      {
        message:
          error instanceof Error
            ? error.message
            : 'Bridge failed.',
      },
    );

    return true;
  }
}
`;

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(
  bridgeFile,
  bridgeSource,
  'utf8',
);

let proxy = fs
  .readFileSync(proxyFile, 'utf8')
  .replace(/\r\n/g, '\n');

const importLine =
  "import { handleBridgeRequest } from './bridge.mjs';";

if (!proxy.includes(importLine)) {
  const imports =
    [...proxy.matchAll(/^import .*;$/gm)];

  if (!imports.length) {
    throw new Error(
      'SAFE STOP - proxy import block missing',
    );
  }

  const last =
    imports[imports.length - 1];

  const insertAt =
    last.index + last[0].length;

  proxy =
    proxy.slice(0, insertAt) +
    '\n' +
    importLine +
    proxy.slice(insertAt);
}

const handlerLine =
  'if (await handleBridgeRequest(req, res, url)) return;';

if (!proxy.includes(handlerLine)) {
  const urlPatterns = [
    /const url = new URL\(req\.url \|\| '\/', `http:\/\/\$\{req\.headers\.host\}`\);/,
    /const url = new URL\(req\.url \|\| "\/", `http:\/\/\$\{req\.headers\.host\}`\);/,
  ];

  let match = null;

  for (const pattern of urlPatterns) {
    match = pattern.exec(proxy);
    if (match) break;
  }

  if (!match) {
    throw new Error(
      'SAFE STOP - proxy URL parse anchor changed',
    );
  }

  const insertAt =
    match.index + match[0].length;

  proxy =
    proxy.slice(0, insertAt) +
    '\n\n' +
    handlerLine +
    proxy.slice(insertAt);
}

fs.writeFileSync(
  proxyFile,
  proxy,
  'utf8',
);

console.log('');
console.log('BRIDGE SERVER V1 WRITTEN');
console.log('✓ /opt/ljingle/bridge.mjs');
console.log('✓ proxy.mjs patched safely');
console.log('✓ private per-device Bridge token');
console.log('✓ short recipient code');
console.log('✓ explicit send / inbox / dismiss');
console.log('✓ .ljingle package is the transport');
console.log('✓ no accounts / chat / feed / auto-import');
console.log('BACKUP:', backupDir);
console.log('');

cp.execFileSync(
  '/usr/bin/node',
  ['--check', bridgeFile],
  { stdio: 'inherit' },
);

cp.execFileSync(
  '/usr/bin/node',
  ['--check', proxyFile],
  { stdio: 'inherit' },
);

console.log('');
console.log('NODE SYNTAX CLEAN ✓');

try {
  cp.execFileSync(
    'systemctl',
    ['restart', 'ljingle-api'],
    { stdio: 'inherit' },
  );

  console.log(
    'ljingle-api restarted ✓',
  );
} catch {
  console.log('');
  console.log(
    'Could not auto-restart service.',
  );
  console.log(
    'Run: systemctl restart ljingle-api',
  );
}
