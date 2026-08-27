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
const backupDir = path.join(ROOT, '_recovery', 'share-trace-v1-' + stamp);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(FILE, path.join(backupDir, 'portableExport.ts'));

let text = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

function addOnce(needle, replacement, label) {
  if (text.includes(replacement)) {
    console.log('○ already traced:', label);
    return;
  }
  if (!text.includes(needle)) {
    throw new Error('SAFE STOP - anchor changed: ' + label);
  }
  text = text.replace(needle, replacement);
  console.log('✓ trace:', label);
}

if (!text.includes('// shareTraceV1')) {
  const importEnd = [...text.matchAll(/^import .*;$/gm)].pop();
  if (!importEnd) throw new Error('SAFE STOP - import block missing');
  const at = importEnd.index + importEnd[0].length;

  text =
    text.slice(0, at) +
    `

const shareTrace = (stage: string, detail?: unknown) => {
  const stamp = new Date().toISOString();
  if (detail === undefined) {
    console.log('[LJ SHARE]', stamp, stage);
  } else {
    console.log('[LJ SHARE]', stamp, stage, detail);
  }
};
// shareTraceV1
` +
    text.slice(at);
}

// asset lane
addOnce(
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
  shareTrace('asset:start', { kind, name, uri: uri.slice(0, 80) });
  try {`,
  'asset:start',
);

addOnce(
  `      const response = await fetch(`,
  `      shareTrace('asset:web:before-fetch', { kind, name });
      const response = await fetch(`,
  'asset:before-fetch',
);

addOnce(
  `      const blob = await response.blob();`,
  `      shareTrace('asset:web:fetch-done', { kind, name, ok: response.ok });
      const blob = await response.blob();
      shareTrace('asset:web:blob-ready', { kind, name, size: blob.size });`,
  'asset:blob',
);

if (text.includes('reader.readAsDataURL(blob);') &&
    !text.includes("shareTrace('asset:web:filereader-start'")) {
  text = text.replace(
    '            reader.readAsDataURL(blob);',
    `            shareTrace('asset:web:filereader-start', { kind, name, size: blob.size });
            reader.readAsDataURL(blob);`,
  );
}

if (text.includes("reader.onload = () => {") &&
    !text.includes("shareTrace('asset:web:filereader-done'")) {
  text = text.replace(
    `            reader.onload = () => {`,
    `            reader.onload = () => {
              shareTrace('asset:web:filereader-done', { kind, name });`,
  );
}

// builder starts
addOnce(
  `export async function buildPortableEntryPackage(
  entryId: string,
) {
  const database = await getDatabase();`,
  `export async function buildPortableEntryPackage(
  entryId: string,
) {
  shareTrace('entry-build:start', entryId);
  const database = await getDatabase();
  shareTrace('entry-build:db-ready');`,
  'entry build start',
);

addOnce(
  `  await attachEntryImages(
    database,
    entry,
    pack.assets,
  );`,
  `  shareTrace('entry-build:before-images');
  await attachEntryImages(
    database,
    entry,
    pack.assets,
  );
  shareTrace('entry-build:after-images', pack.assets.length);`,
  'entry images',
);

addOnce(
  `  const soundtracks =
    await directEntrySoundtracks(`,
  `  shareTrace('entry-build:before-soundtracks');
  const soundtracks =
    await directEntrySoundtracks(`,
  'entry soundtracks start',
);

addOnce(
  `      entryId,
    );`,
  `      entryId,
    );
  shareTrace('entry-build:soundtracks-ready', soundtracks.length);`,
  'entry soundtracks done',
);

// attach frequency audio may occur multiple times; instrument function itself
addOnce(
  `async function attachFrequencyAudio(
  frequency: PortableObject,
  assets: PortableAsset[],
) {`,
  `async function attachFrequencyAudio(
  frequency: PortableObject,
  assets: PortableAsset[],
) {
  shareTrace('frequency-audio:start', {
    title: frequency.title,
    sourceId: frequency.sourceId,
  });`,
  'frequency audio start',
);

if (!text.includes("shareTrace('frequency-audio:done'")) {
  const needle = `  if (asset) {
    assets.push(asset);
    frequency.assetIds.push(asset.assetId);
  }
}`;
  if (text.includes(needle)) {
    text = text.replace(
      needle,
      `  if (asset) {
    assets.push(asset);
    frequency.assetIds.push(asset.assetId);
  }

  shareTrace('frequency-audio:done', {
    title: frequency.title,
    embedded: Boolean(asset),
  });
}`,
    );
    console.log('✓ trace: frequency audio done');
  }
}

// graph relationships calls - global instrumentation around each call
text = text.replace(
  /\.\.\.\(await graphRelationships\(\n(\s+)database,\n(\s+)pack\.objects,\n(\s+)\)\)/g,
  (match, a, b, c) => {
    if (match.includes('shareTrace')) return match;
    return `...(await (async () => {
${a}shareTrace('graph:start', { objects: pack.objects.length });
${a}const result = await graphRelationships(
${a}  database,
${a}  pack.objects,
${a});
${a}shareTrace('graph:done', { relationships: result.length });
${a}return result;
${a}})())`;
  },
);

// finalize calls - wrap without needing function definition
text = text.replace(
  /return finalizePortablePackage\(database, pack\);/g,
  `shareTrace('finalize:start', {
    objects: pack.objects.length,
    relationships: pack.relationships.length,
    assets: pack.assets.length,
  });
  const finalized = await finalizePortablePackage(database, pack);
  shareTrace('finalize:done', {
    objects: finalized.objects.length,
    relationships: finalized.relationships.length,
    assets: finalized.assets.length,
  });
  return finalized;`,
);

// lazy web stages
if (text.includes('async function sharePortableLazyWeb(')) {
  if (!text.includes("shareTrace('web-share:choice-open')")) {
    text = text.replace(
      `    const choice =
      await webPortableShareChoice(preview);`,
      `    shareTrace('web-share:choice-open');
    const choice =
      await webPortableShareChoice(preview);
    shareTrace('web-share:choice-selected', choice);`,
    );
  }

  if (!text.includes("shareTrace('web-share:visual-build-start')")) {
    text = text.replace(
      `      portableMetadataOnly = true;

      try {
        const pack = await build();`,
      `      portableMetadataOnly = true;

      try {
        shareTrace('web-share:visual-build-start');
        const pack = await Promise.race([
          build(),
          new Promise<never>((_, reject) => {
            setTimeout(
              () => reject(
                new Error('Visual package build timed out after 10s.'),
              ),
              10000,
            );
          }),
        ]);
        shareTrace('web-share:visual-build-done', {
          objects: pack.objects.length,
          relationships: pack.relationships.length,
          assets: pack.assets.length,
        });`,
    );
  }

  if (!text.includes("shareTrace('web-share:full-build-start')")) {
    text = text.replace(
      `    const pack =
      await Promise.race([`,
      `    shareTrace('web-share:full-build-start', choice);
    const pack =
      await Promise.race([`,
    );
    text = text.replace(
      `      ]);

    if (choice === 'bridge') {`,
      `      ]);
    shareTrace('web-share:full-build-done', {
      choice,
      objects: pack.objects.length,
      relationships: pack.relationships.length,
      assets: pack.assets.length,
    });

    if (choice === 'bridge') {`,
    );
  }

  if (!text.includes("shareTrace('web-share:bridge-send-start')")) {
    text = text.replace(
      `    if (choice === 'bridge') {
      const sent =`,
      `    if (choice === 'bridge') {
      shareTrace('web-share:bridge-send-start');
      const sent =`,
    );
    text = text.replace(
      `      return sent.messageId;`,
      `      shareTrace('web-share:bridge-send-done', sent.messageId);
      return sent.messageId;`,
    );
  }

  if (!text.includes("shareTrace('web-share:portable-download-start')")) {
    text = text.replace(
      `    if (choice === 'portable') {
      return sharePackage(pack);
    }`,
      `    if (choice === 'portable') {
      shareTrace('web-share:portable-download-start');
      const result = await sharePackage(pack);
      shareTrace('web-share:portable-download-done', result);
      return result;
    }`,
    );
  }

  if (!text.includes("shareTrace('web-share:unlock')")) {
    text = text.replace(
      `  } finally {
    portableMetadataOnly = false;
    portableLazyWebInFlight = false;
  }`,
      `  } catch (caught) {
    shareTrace(
      'web-share:ERROR',
      caught instanceof Error
        ? caught.message
        : caught,
    );

    if (
      typeof window !== 'undefined'
    ) {
      window.alert(
        caught instanceof Error
          ? caught.message
          : 'Share failed.',
      );
    }

    throw caught;
  } finally {
    portableMetadataOnly = false;
    portableLazyWebInFlight = false;
    shareTrace('web-share:unlock');
  }`,
    );
  }
}

fs.writeFileSync(FILE, text, 'utf8');

console.log('');
console.log('SHARE TRACE V1 INSTALLED');
console.log('✓ stage-by-stage [LJ SHARE] logging');
console.log('✓ visual build gets 10s diagnostic timeout');
console.log('✓ existing full build timeout preserved');
console.log('✓ errors become visible browser alerts');
console.log('✓ no data/server/schema changes');
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
