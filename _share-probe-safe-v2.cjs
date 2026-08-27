const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const FILE = path.join(MOBILE, 'src', 'services', 'portableExport.ts');

if (!fs.existsSync(FILE)) {
  throw new Error('SAFE STOP - portableExport.ts missing');
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(ROOT, '_recovery', 'share-probe-safe-v2-' + stamp);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(FILE, path.join(backupDir, 'portableExport.ts'));

let text = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

function fail(message) {
  throw new Error('SAFE STOP - ' + message);
}

function injectBeforeOnce(needle, insertion, label) {
  const idx = text.indexOf(needle);
  if (idx < 0) fail(label + ' anchor missing');
  text = text.slice(0, idx) + insertion + text.slice(idx);
}

function replaceOnce(needle, replacement, label) {
  const idx = text.indexOf(needle);
  if (idx < 0) fail(label + ' anchor missing');
  text = text.slice(0, idx) + replacement + text.slice(idx + needle.length);
}

if (!text.includes('// shareProbeSafeV2')) {
  const imports = [...text.matchAll(/^import .*;$/gm)];
  if (!imports.length) fail('import block missing');
  const last = imports[imports.length - 1];
  const at = last.index + last[0].length;

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
// shareProbeSafeV2
` +
    text.slice(at);
}

// Only instrument builder call sites and asset boundaries.
// DO NOT touch finalizePortablePackage implementation.
if (!text.includes("shareProbe('entry:build:start'")) {
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

if (!text.includes("shareProbe('frequency:build:start'")) {
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

if (!text.includes("shareProbe('collection:build:start'")) {
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

if (!text.includes("shareProbe('asset:start'")) {
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

if (!text.includes("shareProbe('audio:attach:start'")) {
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

// Instrument graph call sites by replacing exact expressions in builders.
// This does not touch graphRelationships implementation.
if (!text.includes("shareProbe('entry:graph:start'")) {
  replaceOnce(
    `  pack.relationships.push(
    ...(await graphRelationships(
      database,
      pack.objects,
    )),
  );

  return finalizePortablePackage(database, pack);
}`,
    `  shareProbe('entry:graph:start', {
    objects: pack.objects.length,
  });

  pack.relationships.push(
    ...(await graphRelationships(
      database,
      pack.objects,
    )),
  );

  shareProbe('entry:graph:done', {
    relationships: pack.relationships.length,
  });
  shareProbe('entry:finalize:start');

  const result =
    await finalizePortablePackage(
      database,
      pack,
    );

  shareProbe('entry:finalize:done');

  return result;
}`,
    'entry graph/finalize',
  );
}

if (!text.includes("shareProbe('frequency:graph:start'")) {
  replaceOnce(
    `  pack.relationships.push(
    ...(await graphRelationships(
      database,
      pack.objects,
    )),
  );

  return finalizePortablePackage(database, pack);
}`,
    `  shareProbe('frequency:graph:start', {
    objects: pack.objects.length,
  });

  pack.relationships.push(
    ...(await graphRelationships(
      database,
      pack.objects,
    )),
  );

  shareProbe('frequency:graph:done', {
    relationships: pack.relationships.length,
  });
  shareProbe('frequency:finalize:start');

  const result =
    await finalizePortablePackage(
      database,
      pack,
    );

  shareProbe('frequency:finalize:done');

  return result;
}`,
    'frequency graph/finalize',
  );
}

if (!text.includes("shareProbe('collection:graph:start'")) {
  replaceOnce(
    `  pack.relationships.push(
    ...(await graphRelationships(
      database,
      pack.objects,
    )),
  );

  return finalizePortablePackage(database, pack);
}`,
    `  shareProbe('collection:graph:start', {
    objects: pack.objects.length,
  });

  pack.relationships.push(
    ...(await graphRelationships(
      database,
      pack.objects,
    )),
  );

  shareProbe('collection:graph:done', {
    relationships: pack.relationships.length,
  });
  shareProbe('collection:finalize:start');

  const result =
    await finalizePortablePackage(
      database,
      pack,
    );

  shareProbe('collection:finalize:done');

  return result;
}`,
    'collection graph/finalize',
  );
}

// Improve existing timeout text if present.
text = text.replace(
  /Visual package build timed out after 10s\./g,
  `Visual package build timed out after 10s. Last stage: \${shareProbeStage}\${shareProbeDetail ? ' ' + shareProbeDetail : ''}`,
);

text = text.replace(
  /Portable package build timed out after 20s\. A linked media asset is not resolving\./g,
  `Portable package build timed out after 20s. Last stage: \${shareProbeStage}\${shareProbeDetail ? ' ' + shareProbeDetail : ''}`,
);

fs.writeFileSync(FILE, text, 'utf8');

console.log('');
console.log('SAFE SHARE PROBE V2 INSTALLED');
console.log('✓ only builder/asset call sites instrumented');
console.log('✓ finalizePortablePackage implementation untouched');
console.log('✓ timeout will show last share stage');
console.log('BACKUP:', backupDir);
console.log('');

try {
  cp.execSync('npx tsc --noEmit', {
    cwd: MOBILE,
    stdio: 'inherit',
    shell: true,
  });
  console.log('');
  console.log('TYPESCRIPT CLEAN ✓');
} catch {
  console.error('');
  console.error('TYPESCRIPT HAS ERRORS');
  console.error('Backup:', backupDir);
  process.exitCode = 1;
}
