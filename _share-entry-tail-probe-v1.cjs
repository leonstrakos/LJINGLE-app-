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
const backupDir = path.join(ROOT, '_recovery', 'share-entry-tail-probe-v1-' + stamp);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(FILE, path.join(backupDir, 'portableExport.ts'));

let text = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

const startMarker = 'export async function buildPortableEntryPackage(';
const endMarker = '\nexport async function buildPortableFrequencyPackage(';

const start = text.indexOf(startMarker);
const end = text.indexOf(endMarker, start);

if (start < 0 || end < 0) {
  throw new Error('SAFE STOP - entry builder boundaries not found');
}

let entryBlock = text.slice(start, end);

if (!entryBlock.includes("shareProbe('entry:graph:start'")) {
  const needle = `  pack.relationships.push(
    ...(await graphRelationships(
      database,
      pack.objects,
    )),
  );`;

  if (!entryBlock.includes(needle)) {
    throw new Error('SAFE STOP - entry graph call anchor missing');
  }

  entryBlock = entryBlock.replace(
    needle,
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
  );
}

if (!entryBlock.includes("shareProbe('entry:finalize:start'")) {
  const needle = `  return finalizePortablePackage(database, pack);`;

  if (!entryBlock.includes(needle)) {
    throw new Error('SAFE STOP - entry finalize call anchor missing');
  }

  entryBlock = entryBlock.replace(
    needle,
`  shareProbe('entry:finalize:start', {
    objects: pack.objects.length,
    relationships: pack.relationships.length,
    assets: pack.assets.length,
  });

  const entryFinalized =
    await finalizePortablePackage(
      database,
      pack,
    );

  shareProbe('entry:finalize:done');

  return entryFinalized;`,
  );
}

text = text.slice(0, start) + entryBlock + text.slice(end);
fs.writeFileSync(FILE, text, 'utf8');

console.log('');
console.log('ENTRY TAIL SHARE PROBE INSTALLED');
console.log('✓ modified ONLY buildPortableEntryPackage block');
console.log('✓ graph start/done probe');
console.log('✓ finalize start/done probe');
console.log('✓ finalizePortablePackage implementation cannot be touched');
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
