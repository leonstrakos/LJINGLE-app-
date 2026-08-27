const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const file = path.join(MOBILE, 'src', 'components', 'PortableImportPanel.tsx');

if (!fs.existsSync(file)) {
  throw new Error('SAFE STOP - PortableImportPanel.tsx missing');
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(
  ROOT,
  '_recovery',
  'portable-v1b-assets-fix-' + stamp,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  file,
  path.join(backupDir, 'PortableImportPanel.tsx'),
);

let text = fs.readFileSync(file, 'utf8');

const oldLine =
  "      setPreview(await readPortablePackageFile(result.assets[0].uri));";

const newBlock = `      const asset = result.assets[0];
      if (!asset) {
        throw new Error('Nije odabrana datoteka.');
      }

      setPreview(await readPortablePackageFile(asset.uri));`;

if (!text.includes(oldLine)) {
  throw new Error('SAFE STOP - picker asset line changed');
}

text = text.replace(oldLine, newBlock);
fs.writeFileSync(file, text, 'utf8');

console.log('');
console.log('PORTABLE V1B PICKER FIXED');
console.log('✓ guarded result.assets[0]');
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
