const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const FILE = path.join(
  ROOT,
  'mobile',
  'src',
  'services',
  'portableExport.ts',
);

if (!fs.existsSync(FILE)) {
  throw new Error('portableExport.ts missing');
}

const text = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

function extractFunction(name) {
  const patterns = [
    `async function ${name}(`,
    `function ${name}(`,
    `const ${name} = async (`,
    `const ${name} = (`,
  ];

  let start = -1;
  let used = '';

  for (const p of patterns) {
    const i = text.indexOf(p);
    if (i >= 0) {
      start = i;
      used = p;
      break;
    }
  }

  if (start < 0) {
    return `\n### ${name}\nNOT FOUND\n`;
  }

  const brace = text.indexOf('{', start);
  if (brace < 0) {
    return `\n### ${name}\nFOUND (${used}) BUT NO BODY BRACE\n`;
  }

  let depth = 0;
  let end = -1;

  for (let i = brace; i < text.length; i++) {
    const ch = text[i];

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end < 0) {
    return `\n### ${name}\nFOUND BUT BODY DID NOT CLOSE\n`;
  }

  const before = text.slice(0, start);
  const startLine = before.split('\n').length;
  const body = text.slice(start, end);

  return `\n### ${name} (starts line ${startLine})\n${body}\n`;
}

const names = [
  'finalizePortablePackage',
  'stableOriginId',
  'ensurePortableOriginSchema',
  'ensurePortableOrigin',
  'originForPortableObject',
];

let out =
  'LJINGLE SHARE FINALIZE CURRENT-SOURCE AUDIT\n' +
  '==========================================\n' +
  'READ ONLY. No files modified.\n';

for (const name of names) {
  out += extractFunction(name);
}

const output = path.join(
  ROOT,
  '_share-finalize-current-source.txt',
);

fs.writeFileSync(output, out, 'utf8');

console.log('');
console.log('READ-ONLY FINALIZE AUDIT WRITTEN');
console.log(output);
console.log('');
console.log('No project files were modified.');
