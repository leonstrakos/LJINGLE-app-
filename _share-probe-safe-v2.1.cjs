const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const TARGET = path.join(
  MOBILE,
  'src',
  'services',
  'portableExport.ts',
);

const recoveryRoot = path.join(
  ROOT,
  '_recovery',
);

if (!fs.existsSync(TARGET)) {
  throw new Error(
    'SAFE STOP - portableExport.ts missing',
  );
}

const candidates = fs
  .readdirSync(recoveryRoot, {
    withFileTypes: true,
  })
  .filter(
    (item) =>
      item.isDirectory() &&
      item.name.startsWith(
        'share-probe-safe-v2-',
      ),
  )
  .map((item) => {
    const file = path.join(
      recoveryRoot,
      item.name,
      'portableExport.ts',
    );

    return {
      file,
      mtime:
        fs.existsSync(file)
          ? fs.statSync(file).mtimeMs
          : 0,
    };
  })
  .filter((item) => item.mtime > 0)
  .sort((a, b) => b.mtime - a.mtime);

if (!candidates.length) {
  throw new Error(
    'SAFE STOP - no share-probe-safe-v2 backup found',
  );
}

const source = candidates[0].file;

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, '-');

const brokenBackupDir = path.join(
  recoveryRoot,
  'before-probe-v2-1-fix-' + stamp,
);

fs.mkdirSync(
  brokenBackupDir,
  {
    recursive: true,
  },
);

fs.copyFileSync(
  TARGET,
  path.join(
    brokenBackupDir,
    'portableExport.ts',
  ),
);

fs.copyFileSync(
  source,
  TARGET,
);

let text = fs
  .readFileSync(TARGET, 'utf8')
  .replace(/\r\n/g, '\n');

function fail(message) {
  throw new Error(
    'SAFE STOP - ' + message,
  );
}

if (!text.includes('// shareProbeSafeV21')) {
  const imports =
    [...text.matchAll(/^import .*;$/gm)];

  if (!imports.length) {
    fail('import block missing');
  }

  const last =
    imports[imports.length - 1];

  const at =
    last.index + last[0].length;

  text =
    text.slice(0, at) +
    `

let shareProbeStage = 'idle';
let shareProbeDetail = '';

const shareProbe = (
  stage: string,
  detail?: unknown,
) => {
  shareProbeStage = stage;

  try {
    shareProbeDetail =
      detail === undefined
        ? ''
        : JSON.stringify(detail);
  } catch {
    shareProbeDetail =
      String(detail ?? '');
  }

  console.log(
    '[LJ SHARE]',
    stage,
    detail ?? '',
  );
};
// shareProbeSafeV21
` +
    text.slice(at);
}

function replaceOnce(
  needle,
  replacement,
  label,
) {
  const index = text.indexOf(needle);

  if (index < 0) {
    fail(label + ' anchor missing');
  }

  text =
    text.slice(0, index) +
    replacement +
    text.slice(index + needle.length);
}

if (
  !text.includes(
    "shareProbe('entry:build:start'",
  )
) {
  replaceOnce(
    `export async function buildPortableEntryPackage(
  entryId: string,
) {
  const database = await getDatabase();`,
    `export async function buildPortableEntryPackage(
  entryId: string,
) {
  shareProbe('entry:build:start', entryId);
  const database = await getDatabase();
  shareProbe('entry:db:ready');`,
    'entry builder',
  );
}

if (
  !text.includes(
    "shareProbe('frequency:build:start'",
  )
) {
  replaceOnce(
    `export async function buildPortableFrequencyPackage(
  trackId: string,
) {
  const database = await getDatabase();`,
    `export async function buildPortableFrequencyPackage(
  trackId: string,
) {
  shareProbe('frequency:build:start', trackId);
  const database = await getDatabase();
  shareProbe('frequency:db:ready');`,
    'frequency builder',
  );
}

if (
  !text.includes(
    "shareProbe('collection:build:start'",
  )
) {
  replaceOnce(
    `export async function buildPortableCollectionPackage(
  collectionId: string,
) {
  const database = await getDatabase();`,
    `export async function buildPortableCollectionPackage(
  collectionId: string,
) {
  shareProbe('collection:build:start', collectionId);
  const database = await getDatabase();
  shareProbe('collection:db:ready');`,
    'collection builder',
  );
}

if (
  !text.includes(
    "shareProbe('asset:start'",
  )
) {
  replaceOnce(
    `async function assetFromUri(
  uri: string,
  kind: 'IMAGE' | 'AUDIO',
  name: string,
  mimeType: string | null,
): Promise<PortableAsset | null> {
  try {`,
    `async function assetFromUri(
  uri: string,
  kind: 'IMAGE' | 'AUDIO',
  name: string,
  mimeType: string | null,
): Promise<PortableAsset | null> {
  shareProbe('asset:start', {
    kind,
    name,
    uri: uri.slice(0, 96),
  });

  try {`,
    'assetFromUri',
  );
}

if (
  !text.includes(
    "shareProbe('audio:attach:start'",
  )
) {
  replaceOnce(
    `async function attachFrequencyAudio(
  frequency: PortableObject,
  assets: PortableAsset[],
) {`,
    `async function attachFrequencyAudio(
  frequency: PortableObject,
  assets: PortableAsset[],
) {
  shareProbe('audio:attach:start', {
    id: frequency.sourceId,
    title: frequency.title,
  });`,
    'attachFrequencyAudio',
  );
}

const timeoutNeedle =
  `'Visual package build timed out after 10s.'`;

if (text.includes(timeoutNeedle)) {
  text = text.replace(
    timeoutNeedle,
    `'Visual package build timed out after 10s. Last stage: ' +
                  shareProbeStage +
                  (shareProbeDetail
                    ? ' ' + shareProbeDetail
                    : '')`,
  );
}

const fullTimeoutNeedle =
  `'Portable package build timed out after 20s. A linked media asset is not resolving.'`;

if (text.includes(fullTimeoutNeedle)) {
  text = text.replace(
    fullTimeoutNeedle,
    `'Portable package build timed out after 20s. Last stage: ' +
                  shareProbeStage +
                  (shareProbeDetail
                    ? ' ' + shareProbeDetail
                    : '')`,
  );
}

fs.writeFileSync(
  TARGET,
  text,
  'utf8',
);

console.log('');
console.log('SHARE PROBE V2.1 INSTALLED');
console.log('✓ restored clean pre-v2 probe source first');
console.log('✓ fixed timeout string construction');
console.log('✓ builder/asset probes only');
console.log('✓ finalizePortablePackage implementation untouched');
console.log('BROKEN FILE BACKUP:', brokenBackupDir);
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
  console.log('TYPESCRIPT CLEAN ✓');
} catch {
  console.error('');
  console.error(
    'TYPESCRIPT HAS ERRORS',
  );
  process.exitCode = 1;
}
