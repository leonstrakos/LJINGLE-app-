const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const file = path.join(MOBILE, 'src', 'services', 'portableExport.ts');

if (!fs.existsSync(file)) {
  throw new Error('SAFE STOP - portableExport.ts missing');
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(
  ROOT,
  '_recovery',
  'portable-export-ts-fix-' + stamp,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  file,
  path.join(backupDir, 'portableExport.ts'),
);

let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const oldRow =
  "type Row = Record<string, string | number | null>;";

if (text.includes(oldRow)) {
  text = text.replace(
    oldRow,
    "type Row = Record<string, string | number | null | undefined>;",
  );
}

const oldTuple =
  "[string, string, PortableEntityKind]";

if (text.includes(oldTuple)) {
  text = text.replaceAll(
    oldTuple,
    "[string, string, Exclude<PortableEntityKind, 'COLLECTION'>]",
  );
}

fs.writeFileSync(file, text, 'utf8');

console.log('');
console.log('PORTABLE EXPORT TYPES FIXED');
console.log('✓ Row allows missing SQLite alias fields');
console.log('✓ loadEntity spec cannot produce COLLECTION');
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
  console.error('TYPESCRIPT STILL HAS ERRORS');
  console.error('Backup:', backupDir);
  process.exitCode = 1;
}
