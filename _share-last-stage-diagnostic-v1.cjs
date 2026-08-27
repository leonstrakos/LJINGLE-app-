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
const backupDir = path.join(ROOT, '_recovery', 'share-last-stage-v1-' + stamp);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(FILE, path.join(backupDir, 'portableExport.ts'));

let text = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

function fail(message) {
  throw new Error('SAFE STOP - ' + message);
}

const oldTrace = `const shareTrace = (stage: string, detail?: unknown) => {
  const stamp = new Date().toISOString();
  if (detail === undefined) {
    console.log('[LJ SHARE]', stamp, stage);
  } else {
    console.log('[LJ SHARE]', stamp, stage, detail);
  }
};`;

const newTrace = `let lastShareStage = 'not-started';
let lastShareDetail = '';

const shareTrace = (stage: string, detail?: unknown) => {
  lastShareStage = stage;

  try {
    lastShareDetail =
      detail === undefined
        ? ''
        : JSON.stringify(detail);
  } catch {
    lastShareDetail = String(detail ?? '');
  }

  const stamp = new Date().toISOString();

  if (detail === undefined) {
    console.log('[LJ SHARE]', stamp, stage);
  } else {
    console.log('[LJ SHARE]', stamp, stage, detail);
  }
};`;

if (text.includes(oldTrace)) {
  text = text.replace(oldTrace, newTrace);
} else if (!text.includes("let lastShareStage = 'not-started';")) {
  fail('shareTraceV1 block changed');
}

text = text.replace(
  `new Error('Visual package build timed out after 10s.')`,
  `new Error(
                  'Visual package build timed out after 10s. Last stage: ' +
                    lastShareStage +
                    (lastShareDetail
                      ? ' ' + lastShareDetail
                      : ''),
                )`,
);

text = text.replace(
  `new Error(
                  'Portable package build timed out after 20s. A linked media asset is not resolving.',
                )`,
  `new Error(
                  'Portable package build timed out after 20s. Last stage: ' +
                    lastShareStage +
                    (lastShareDetail
                      ? ' ' + lastShareDetail
                      : ''),
                )`,
);

fs.writeFileSync(FILE, text, 'utf8');

console.log('');
console.log('SHARE LAST-STAGE DIAGNOSTIC INSTALLED');
console.log('✓ timeout alert now names the exact last completed stage');
console.log('✓ no behavior/data/server changes');
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
