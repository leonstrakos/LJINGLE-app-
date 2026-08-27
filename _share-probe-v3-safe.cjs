const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const TARGET = path.join(MOBILE, 'src', 'services', 'portableExport.ts');
const RECOVERY = path.join(ROOT, '_recovery');

if (!fs.existsSync(TARGET)) {
  throw new Error('SAFE STOP - portableExport.ts missing');
}
if (!fs.existsSync(RECOVERY)) {
  throw new Error('SAFE STOP - _recovery missing');
}

const candidates = fs.readdirSync(RECOVERY, { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name.startsWith('share-entry-deep-probe-v1-'))
  .map(d => {
    const file = path.join(RECOVERY, d.name, 'portableExport.ts');
    return {
      file,
      mtime: fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0,
    };
  })
  .filter(x => x.mtime > 0)
  .sort((a, b) => b.mtime - a.mtime);

if (!candidates.length) {
  throw new Error('SAFE STOP - deep-probe backup not found');
}

const cleanSource = candidates[0].file;

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const brokenSave = path.join(
  RECOVERY,
  'before-share-probe-v3-' + stamp,
);
fs.mkdirSync(brokenSave, { recursive: true });
fs.copyFileSync(TARGET, path.join(brokenSave, 'portableExport.ts'));

// Restore exact pre-deep-probe file first.
fs.copyFileSync(cleanSource, TARGET);

let text = fs.readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n');

function fail(message) {
  throw new Error('SAFE STOP - ' + message);
}
function replaceOnce(needle, replacement, label) {
  const i = text.indexOf(needle);
  if (i < 0) fail(label + ' anchor missing');
  text = text.slice(0, i) + replacement + text.slice(i + needle.length);
}

// Preserve existing safe probe if present. Add only ENTRY stages that cannot
// accidentally match finalizePortablePackage itself.
if (!text.includes("shareProbe('entry:loadEntity:start'")) {
  replaceOnce(
`  const entry = await loadEntity(
    database,
    'ENTRY',
    entryId,
  );`,
`  shareProbe('entry:loadEntity:start');

  const entry = await loadEntity(
    database,
    'ENTRY',
    entryId,
  );

  shareProbe('entry:loadEntity:done', {
    found: Boolean(entry),
  });`,
    'entry loadEntity',
  );
}

if (!text.includes("shareProbe('entry:images:start'")) {
  replaceOnce(
`  await attachEntryImages(
    database,
    entry,
    pack.assets,
  );`,
`  shareProbe('entry:images:start');

  await attachEntryImages(
    database,
    entry,
    pack.assets,
  );

  shareProbe('entry:images:done', {
    assets: pack.assets.length,
  });`,
    'entry images',
  );
}

if (!text.includes("shareProbe('entry:soundtracks:start'")) {
  replaceOnce(
`  const soundtracks =
    await directEntrySoundtracks(
      database,
      entryId,
    );`,
`  shareProbe('entry:soundtracks:start');

  const soundtracks =
    await directEntrySoundtracks(
      database,
      entryId,
    );

  shareProbe('entry:soundtracks:done', {
    count: soundtracks.length,
  });`,
    'entry soundtracks',
  );
}

// DO NOT instrument finalize or generic graph return expressions.
// We already know the builder reaches db-ready; these three probes are enough.
fs.writeFileSync(TARGET, text, 'utf8');

console.log('');
console.log('SHARE PROBE V3 INSTALLED');
console.log('✓ restored exact pre-deep-probe portableExport.ts first');
console.log('✓ only entry loadEntity / images / soundtracks probed');
console.log('✓ NO finalize replacement');
console.log('✓ NO generic return replacement');
console.log('BROKEN FILE BACKUP:', brokenSave);
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
  console.error('Do not run the app; send me this output.');
  process.exitCode = 1;
}
