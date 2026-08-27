const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const candidates = [
  path.join(SRC, 'components', 'PortableImportPanel.tsx'),
  path.join(SRC, 'services', 'portableExport.ts'),
  path.join(SRC, 'services', 'portableImport.ts'),
  path.join(SRC, 'services', 'portableImportService.ts'),
];

const out = [];
out.push('LJINGLE PORTABLE IMPORT CURRENT-SOURCE AUDIT');
out.push('===========================================');
out.push('READ ONLY. No files modified.');
out.push('');

function extractAround(text, needle, before = 35, after = 80) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const hits = [];
  lines.forEach((line, i) => {
    if (line.toLowerCase().includes(needle.toLowerCase())) hits.push(i);
  });

  if (!hits.length) return [`-- ${needle}: NOT FOUND --`];

  const chunks = [];
  for (const i of hits.slice(0, 8)) {
    const s = Math.max(0, i - before);
    const e = Math.min(lines.length, i + after + 1);
    chunks.push(`-- ${needle} @ line ${i + 1} --`);
    for (let j = s; j < e; j++) {
      chunks.push(`${String(j + 1).padStart(5, ' ')} | ${lines[j]}`);
    }
  }
  return chunks;
}

for (const file of candidates) {
  if (!fs.existsSync(file)) continue;

  const text = fs.readFileSync(file, 'utf8');
  out.push('');
  out.push('### ' + path.relative(ROOT, file));
  out.push('');

  for (const needle of [
    'importPackage',
    'importPortable',
    'inspectPortablePackage',
    'DocumentPicker',
    'getDocumentAsync',
    'setResult',
    'setStatus',
    'setError',
    'reused',
    'imported',
    'relations',
    'originId',
    'portable_entity_origins',
  ]) {
    out.push(...extractAround(text, needle));
    out.push('');
  }
}

const output = path.join(ROOT, '_portable-import-current-source-audit.txt');
fs.writeFileSync(output, out.join('\n'), 'utf8');

console.log('');
console.log('READ-ONLY PORTABLE IMPORT AUDIT WRITTEN');
console.log(output);
console.log('No project files were modified.');
