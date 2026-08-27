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
const backupDir = path.join(ROOT, '_recovery', 'share-entry-deep-probe-v1-' + stamp);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(FILE, path.join(backupDir, 'portableExport.ts'));

let text = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

function fail(message) {
  throw new Error('SAFE STOP - ' + message);
}

function replaceOnce(needle, replacement, label) {
  const idx = text.indexOf(needle);
  if (idx < 0) fail(label + ' anchor missing');
  text = text.slice(0, idx) + replacement + text.slice(idx + needle.length);
}

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

if (!text.includes("shareProbe('entry:graph:start'")) {
  replaceOnce(
`  pack.relationships.push(
    ...(await graphRelationships(
      database,
      pack.objects,
    )),
  );`,
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
  });`,
    'entry graph',
  );
}

if (!text.includes("shareProbe('entry:finalize:start'")) {
  replaceOnce(
`  return finalizePortablePackage(database, pack);`,
`  shareProbe('entry:finalize:start');

  const finalizedEntryPack =
    await finalizePortablePackage(
      database,
      pack,
    );

  shareProbe('entry:finalize:done');

  return finalizedEntryPack;`,
    'entry finalize',
  );
}

fs.writeFileSync(FILE, text, 'utf8');

console.log('');
console.log('ENTRY DEEP SHARE PROBE INSTALLED');
console.log('✓ loadEntity');
console.log('✓ entry images');
console.log('✓ direct soundtracks');
console.log('✓ graph relationships');
console.log('✓ finalize call site only');
console.log('✓ finalizePortablePackage implementation untouched');
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
