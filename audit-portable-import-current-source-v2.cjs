const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const targets = [
  path.join(SRC, 'components', 'PortableImportPanel.tsx'),
  path.join(SRC, 'services', 'portableExport.ts'),
  path.join(SRC, 'services', 'portableImport.ts'),
  path.join(SRC, 'services', 'portableImportService.ts'),
];

const existing = targets.filter(fs.existsSync);

if (!existing.length) {
  throw new Error('No portable import source files found.');
}

function lines(text) {
  return text.replace(/\r\n/g, '\n').split('\n');
}

function excerpt(file, needles) {
  const ls = lines(fs.readFileSync(file, 'utf8'));
  const picked = new Set();

  for (const needle of needles) {
    for (let i = 0; i < ls.length; i++) {
      if (ls[i].toLowerCase().includes(needle.toLowerCase())) {
        const start = Math.max(0, i - 20);
        const end = Math.min(ls.length, i + 55);
        for (let j = start; j < end; j++) picked.add(j);
      }
    }
  }

  const sorted = [...picked].sort((a, b) => a - b);
  const out = [];
  let last = -2;

  for (const i of sorted) {
    if (i > last + 1) out.push('\n---');
    out.push(`${String(i + 1).padStart(5, ' ')} | ${ls[i]}`);
    last = i;
  }

  return out.join('\n');
}

const needles = [
  'inspectPortablePackage',
  'DocumentPicker',
  'getDocumentAsync',
  'import',
  'onPress',
  'setBusy',
  'setLoading',
  'setError',
  'setResult',
  'setStatus',
  'Alert.alert',
  'originId',
  'portable_entity_origins',
  'insert',
  'transaction',
  'BEGIN',
  'COMMIT',
  'ROLLBACK',
];

let report = '';
report += 'LJINGLE PORTABLE IMPORT — CURRENT SOURCE\n';
report += '=========================================\n';
report += 'READ ONLY. No files modified.\n\n';

for (const file of existing) {
  report += `### ${path.relative(ROOT, file)}\n\n`;
  report += excerpt(file, needles);
  report += '\n\n';
}

const outPath = path.join(ROOT, '_portable-import-current-source-audit.txt');
fs.writeFileSync(outPath, report, 'utf8');

console.log('');
console.log('PORTABLE IMPORT AUDIT READY');
console.log(outPath);
console.log('');
console.log('No project files were modified.');
