const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const FILE = path.join(MOBILE, 'src', 'services', 'portableExport.ts');

function fail(message) {
  throw new Error('SAFE STOP - ' + message);
}

if (!fs.existsSync(FILE)) {
  fail('portableExport.ts missing');
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(
  ROOT,
  '_recovery',
  'share-finalize-probe-v1.1-' + stamp,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  FILE,
  path.join(backupDir, 'portableExport.ts'),
);

let text = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

const fnStart = text.indexOf('async function finalizePortablePackage(');
if (fnStart < 0) {
  fail('finalizePortablePackage start not found');
}

// Find the matching closing brace for finalizePortablePackage only.
let braceStart = text.indexOf('{', fnStart);
if (braceStart < 0) {
  fail('finalizePortablePackage opening brace not found');
}

let depth = 0;
let fnEnd = -1;

for (let i = braceStart; i < text.length; i++) {
  const ch = text[i];

  if (ch === '{') {
    depth += 1;
  } else if (ch === '}') {
    depth -= 1;

    if (depth === 0) {
      fnEnd = i + 1;
      break;
    }
  }
}

if (fnEnd < 0) {
  fail('finalizePortablePackage closing brace not found');
}

let block = text.slice(fnStart, fnEnd);

// Add an entry probe at the top of finalize.
if (!block.includes("shareProbe('finalize:entered'")) {
  const open = block.indexOf('{');

  block =
    block.slice(0, open + 1) +
    `
  shareProbe('finalize:entered', {
    objects: pack.objects.length,
    relationships: pack.relationships.length,
    assets: pack.assets.length,
  });
` +
    block.slice(open + 1);
}

// Instrument every awaited call inside finalize, one by one, without
// changing return expressions or wrapping the function recursively.
const awaitRegex = /await\s+([A-Za-z0-9_$.]+)\s*\(/g;
let match;
let ordinal = 0;
const awaited = [];

while ((match = awaitRegex.exec(block)) !== null) {
  awaited.push({
    index: match.index,
    callee: match[1],
    ordinal: ordinal++,
  });
}

// Insert from end to start so indexes remain valid.
for (let i = awaited.length - 1; i >= 0; i--) {
  const item = awaited[i];
  const marker =
    `  shareProbe('finalize:await:${item.ordinal}:before', '${item.callee}');\n`;

  if (
    block.slice(
      Math.max(0, item.index - marker.length - 20),
      item.index,
    ).includes(
      `finalize:await:${item.ordinal}:before`,
    )
  ) {
    continue;
  }

  block =
    block.slice(0, item.index) +
    marker +
    block.slice(item.index);
}

// Add a final probe before the last return in THIS function only.
if (!block.includes("shareProbe('finalize:return'")) {
  const returnIndex = block.lastIndexOf('\n  return ');

  if (returnIndex >= 0) {
    block =
      block.slice(0, returnIndex) +
      `\n  shareProbe('finalize:return');` +
      block.slice(returnIndex);
  }
}

text =
  text.slice(0, fnStart) +
  block +
  text.slice(fnEnd);

fs.writeFileSync(FILE, text, 'utf8');

console.log('');
console.log('FINALIZE SHARE PROBE V1.1 INSTALLED');
console.log('✓ valid Node.js only');
console.log('✓ touched only finalizePortablePackage body');
console.log('✓ no recursive replacement');
console.log('✓ no generic return replacement outside function');
console.log('✓ logs each awaited function inside finalize');
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
