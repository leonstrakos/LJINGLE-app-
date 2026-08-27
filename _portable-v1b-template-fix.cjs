const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const file = path.join(MOBILE, 'src', 'services', 'portableImport.ts');

if (!fs.existsSync(file)) {
  throw new Error('SAFE STOP - portableImport.ts missing');
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(
  ROOT,
  '_recovery',
  'portable-v1b-template-fix-' + stamp,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  file,
  path.join(backupDir, 'portableImport.ts'),
);

let text = fs.readFileSync(file, 'utf8');

// V1B generator used String.raw, so SQL template literals were emitted
// with a literal backslash before the backtick: \`...`.
// Remove ONLY backslashes that directly escape backticks.
const before = (text.match(/\\`/g) || []).length;

if (before === 0) {
  throw new Error('SAFE STOP - no escaped backticks found');
}

text = text.replace(/\\`/g, '`');

fs.writeFileSync(file, text, 'utf8');

console.log('');
console.log('PORTABLE V1B TEMPLATE LITERALS FIXED');
console.log('✓ removed escaped SQL backticks:', before);
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
