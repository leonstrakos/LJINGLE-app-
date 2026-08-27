const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const file = path.join(
  MOBILE,
  'src',
  'screens',
  'EntryFormScreen.tsx',
);

if (!fs.existsSync(file)) {
  throw new Error('SAFE STOP - EntryFormScreen.tsx missing');
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(
  ROOT,
  '_recovery',
  'entry-share-wrapper-fix-' + stamp,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  file,
  path.join(backupDir, 'EntryFormScreen.tsx'),
);

let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// Previous visual patch removed the old SHARE Pressable itself,
// but left its conditional JSX wrapper:
//
// {editing && entryId ? (
//
// ) : null}
//
// That empty wrapper is what breaks TSX parsing.

const emptyWrapper =
  /\n\s*\{editing\s*&&\s*entryId\s*\?\s*\(\s*\)\s*:\s*null\}\s*/m;

if (!emptyWrapper.test(text)) {
  throw new Error(
    'SAFE STOP - empty Entry share wrapper not found; source changed',
  );
}

text = text.replace(emptyWrapper, '\n');

fs.writeFileSync(file, text, 'utf8');

console.log('');
console.log('ENTRY SHARE WRAPPER FIXED');
console.log('✓ removed empty old SHARE conditional');
console.log('✓ new inline title share preserved');
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
