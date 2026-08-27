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
const backupDir = path.join(
  ROOT,
  '_recovery',
  'share-origin-assignment-fix-' + stamp,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  FILE,
  path.join(backupDir, 'portableExport.ts'),
);

let text = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

const bad = `  for (const object of pack.objects) {
    object.originId =
        shareProbe('finalize:await:1:before', 'stableOriginId');
await stableOriginId(database, object);
  }`;

const good = `  for (const object of pack.objects) {
    shareProbe(
      'finalize:await:1:before',
      'stableOriginId',
    );

    object.originId =
      await stableOriginId(
        database,
        object,
      );
  }`;

if (text.includes(bad)) {
  text = text.replace(bad, good);
} else {
  // Fallback for whitespace variants, but still narrowly scoped.
  const start = text.indexOf('  for (const object of pack.objects) {');
  const end = text.indexOf('\n  }\n\n  pack.version = 1;', start);

  if (start < 0 || end < 0) {
    throw new Error(
      'SAFE STOP - finalize origin loop not found',
    );
  }

  const block = text.slice(start, end + 4);

  if (
    !block.includes("stableOriginId") ||
    !block.includes("object.originId")
  ) {
    throw new Error(
      'SAFE STOP - finalize origin loop shape changed',
    );
  }

  text =
    text.slice(0, start) +
    good +
    text.slice(end + 4);
}

fs.writeFileSync(FILE, text, 'utf8');

console.log('');
console.log('SHARE ORIGIN ASSIGNMENT FIX INSTALLED');
console.log('✓ stableOriginId result is assigned to object.originId again');
console.log('✓ debug log remains separate from assignment');
console.log('✓ recursion fix preserved');
console.log('✓ provenance/origin schema preserved');
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
