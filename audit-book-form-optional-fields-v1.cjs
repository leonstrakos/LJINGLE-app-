const fs = require('fs');
const path = require('path');

const root = process.cwd();
const out = path.join(root, '_book-form-optional-fields-audit.txt');

const targets = [
  'src/screens/BookFormScreen.tsx',
  'src/types/book.ts',
  'src/services/bookApi.ts',
  'src/components/BookCard.tsx',
  'src/components/BookCover.tsx',
];

let text = 'LJINGLE — Book form optional fields audit\n';
text += '=========================================\n\n';

for (const rel of targets) {
  const file = path.join(root, rel);
  text += `### ${rel}\n\n`;

  if (!fs.existsSync(file)) {
    text += 'MISSING\n\n';
    continue;
  }

  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

  const needles = [
    /isbn/i,
    /author/i,
    /publishedYear|year/i,
    /required/i,
    /validate/i,
    /BookRequest|BookResponse/i,
    /create\(|update\(/,
    /TextInput/,
  ];

  const ranges = [];
  for (let i = 0; i < lines.length; i++) {
    if (!needles.some((rx) => rx.test(lines[i]))) continue;
    ranges.push([Math.max(0, i - 14), Math.min(lines.length - 1, i + 26)]);
  }

  ranges.sort((a, b) => a[0] - b[0]);

  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last || range[0] > last[1] + 3) merged.push([...range]);
    else last[1] = Math.max(last[1], range[1]);
  }

  for (const [start, end] of merged.slice(0, 20)) {
    text += `-- lines ${start + 1}-${end + 1} --\n`;
    for (let i = start; i <= end; i++) {
      text += `${String(i + 1).padStart(4)} | ${lines[i]}\n`;
    }
    text += '\n';
  }
}

fs.writeFileSync(out, text, 'utf8');
console.log('Saved: _book-form-optional-fields-audit.txt');
console.log('Read-only audit. Nothing changed.');
