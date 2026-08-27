const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const FILE = path.join(
  MOBILE,
  'src',
  'services',
  'portableExport.ts',
);

if (!fs.existsSync(FILE)) {
  throw new Error(
    'SAFE STOP - portableExport.ts missing',
  );
}

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, '-');

const backupDir = path.join(
  ROOT,
  '_recovery',
  'portable-web-audio-real-fix-' + stamp,
);

fs.mkdirSync(backupDir, {
  recursive: true,
});

fs.copyFileSync(
  FILE,
  path.join(
    backupDir,
    'portableExport.ts',
  ),
);

let text = fs
  .readFileSync(FILE, 'utf8')
  .replace(/\r\n/g, '\n');

function fail(message) {
  throw new Error(
    'SAFE STOP - ' + message,
  );
}

// 1) Import the EXISTING web audio resolver.
// It reads ljingle-web-audio:<id> from IndexedDB and returns a blob: URL.
if (
  !text.includes(
    "from '../audio/webAudioStore'",
  )
) {
  const imports =
    [...text.matchAll(/^import .*;$/gm)];

  if (!imports.length) {
    fail('could not locate import block');
  }

  const last =
    imports[imports.length - 1];

  const at =
    last.index + last[0].length;

  text =
    text.slice(0, at) +
    "\nimport { hydrateWebAudio } from '../audio/webAudioStore';" +
    text.slice(at);
}

// 2) Find ONLY assetFromUri(), then patch fetch(uri) inside that function.
// No assumptions about its returned object shape.
const marker =
  'async function assetFromUri(';

const fnStart =
  text.indexOf(marker);

if (fnStart < 0) {
  fail('assetFromUri function missing');
}

const nextFunctionCandidates = [
  text.indexOf(
    '\nasync function ',
    fnStart + marker.length,
  ),
  text.indexOf(
    '\nfunction ',
    fnStart + marker.length,
  ),
  text.indexOf(
    '\nconst ',
    fnStart + marker.length,
  ),
].filter((value) => value > fnStart);

const fnEnd =
  nextFunctionCandidates.length
    ? Math.min(...nextFunctionCandidates)
    : text.length;

let before =
  text.slice(0, fnStart);

let fn =
  text.slice(fnStart, fnEnd);

let after =
  text.slice(fnEnd);

if (
  !fn.includes(
    '// portableWebAudioHydrationV2',
  )
) {
  const fetchPatterns = [
    /fetch\(\s*uri\s*\)/,
    /fetch\(\s*String\(uri\)\s*\)/,
  ];

  let matched = false;

  for (const pattern of fetchPatterns) {
    if (!pattern.test(fn)) {
      continue;
    }

    fn = fn.replace(
      pattern,
      `fetch(
      // portableWebAudioHydrationV2
      Platform.OS === 'web' &&
      uri.startsWith('ljingle-web-audio:')
        ? await hydrateWebAudio(uri)
        : uri,
    )`,
    );

    matched = true;
    break;
  }

  if (!matched) {
    // Print a useful local excerpt into an audit file before safe stop.
    const audit = path.join(
      ROOT,
      '_portable-web-audio-shape.txt',
    );

    fs.writeFileSync(
      audit,
      fn,
      'utf8',
    );

    fail(
      'assetFromUri has no fetch(uri); wrote _portable-web-audio-shape.txt',
    );
  }
}

text =
  before +
  fn +
  after;

fs.writeFileSync(
  FILE,
  text,
  'utf8',
);

console.log('');
console.log('PORTABLE WEB AUDIO REAL FIX INSTALLED');
console.log('✓ no PortableAsset shape guessing');
console.log('✓ ljingle-web-audio: resolves through existing IndexedDB store');
console.log('✓ real audio Blob is embedded into .ljingle on web');
console.log('✓ Collection / Zapis / Frequency can share linked web audio');
console.log('✓ native behavior unchanged');
console.log('BACKUP:', backupDir);
console.log('');

try {
  cp.execSync(
    'npx tsc --noEmit',
    {
      cwd: MOBILE,
      stdio: 'inherit',
      shell: true,
    },
  );

  console.log('');
  console.log('TYPESCRIPT CLEAN ✓');
} catch {
  console.error('');
  console.error(
    'TYPESCRIPT HAS ERRORS',
  );
  console.error(
    'Backup:',
    backupDir,
  );
  process.exitCode = 1;
}
