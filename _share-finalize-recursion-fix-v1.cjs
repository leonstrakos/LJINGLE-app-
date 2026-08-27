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
  'share-finalize-recursion-fix-' + stamp,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  FILE,
  path.join(backupDir, 'portableExport.ts'),
);

let text = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

const fnStart = text.indexOf('async function finalizePortablePackage(');
if (fnStart < 0) {
  throw new Error('SAFE STOP - finalizePortablePackage not found');
}

const fnBrace = text.indexOf('{', fnStart);
if (fnBrace < 0) {
  throw new Error('SAFE STOP - finalizePortablePackage body not found');
}

let depth = 0;
let fnEnd = -1;

for (let i = fnBrace; i < text.length; i++) {
  const ch = text[i];
  if (ch === '{') depth++;
  if (ch === '}') {
    depth--;
    if (depth === 0) {
      fnEnd = i + 1;
      break;
    }
  }
}

if (fnEnd < 0) {
  throw new Error('SAFE STOP - finalizePortablePackage body did not close');
}

let block = text.slice(fnStart, fnEnd);

const badReturn = 'return finalizePortablePackage(database, pack);';

if (!block.includes(badReturn)) {
  throw new Error(
    'SAFE STOP - recursive finalize return not found; current source differs',
  );
}

block = block.replace(
  badReturn,
  `return pack;`,
);

text =
  text.slice(0, fnStart) +
  block +
  text.slice(fnEnd);

fs.writeFileSync(FILE, text, 'utf8');

console.log('');
console.log('SHARE FINALIZE RECURSION FIX INSTALLED');
console.log('✓ finalizePortablePackage no longer calls itself');
console.log('✓ finalized package now returns pack');
console.log('✓ provenance/origin logic preserved');
console.log('✓ no schema/server/UI changes');
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
