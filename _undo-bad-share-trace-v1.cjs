const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const TARGET = path.join(
  MOBILE,
  'src',
  'services',
  'portableExport.ts',
);

const recoveryRoot = path.join(
  ROOT,
  '_recovery',
);

if (!fs.existsSync(TARGET)) {
  throw new Error(
    'SAFE STOP - portableExport.ts missing',
  );
}

if (!fs.existsSync(recoveryRoot)) {
  throw new Error(
    'SAFE STOP - _recovery folder missing',
  );
}

// Find the newest backup created immediately BEFORE _share-trace-v1.cjs
const candidates = fs
  .readdirSync(recoveryRoot, {
    withFileTypes: true,
  })
  .filter(
    (item) =>
      item.isDirectory() &&
      item.name.startsWith(
        'share-trace-v1-',
      ),
  )
  .map((item) => {
    const file = path.join(
      recoveryRoot,
      item.name,
      'portableExport.ts',
    );

    return {
      name: item.name,
      file,
      mtime:
        fs.existsSync(file)
          ? fs.statSync(file).mtimeMs
          : 0,
    };
  })
  .filter(
    (item) =>
      item.mtime > 0,
  )
  .sort(
    (a, b) =>
      b.mtime - a.mtime,
  );

if (!candidates.length) {
  throw new Error(
    'SAFE STOP - no share-trace-v1 backup with portableExport.ts found',
  );
}

const source =
  candidates[0].file;

const emergencyStamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

const emergencyDir = path.join(
  recoveryRoot,
  'before-undo-bad-share-trace-' +
    emergencyStamp,
);

fs.mkdirSync(
  emergencyDir,
  {
    recursive: true,
  },
);

fs.copyFileSync(
  TARGET,
  path.join(
    emergencyDir,
    'portableExport.ts',
  ),
);

fs.copyFileSync(
  source,
  TARGET,
);

console.log('');
console.log('BAD SHARE TRACE UNDONE');
console.log(
  '✓ restored portableExport.ts from:',
);
console.log(
  '  ' +
    path.relative(ROOT, source),
);
console.log(
  '✓ current broken file saved to:',
);
console.log(
  '  ' +
    path.relative(
      ROOT,
      emergencyDir,
    ),
);
console.log(
  '✓ this only removes the trace patch',
);
console.log(
  '✓ pre-trace share cleanup remains',
);
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
    'TYPESCRIPT STILL HAS ERRORS',
  );
  console.error(
    'Do not run the last-stage diagnostic yet.',
  );
  process.exitCode = 1;
}
