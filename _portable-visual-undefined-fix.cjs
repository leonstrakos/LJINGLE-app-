const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const file = path.join(
  MOBILE,
  'src',
  'services',
  'portableVisualShare.ts',
);

if (!fs.existsSync(file)) {
  throw new Error(
    'SAFE STOP - portableVisualShare.ts missing',
  );
}

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, '-');

const backupDir = path.join(
  ROOT,
  '_recovery',
  'portable-visual-undefined-fix-' + stamp,
);

fs.mkdirSync(backupDir, {
  recursive: true,
});

fs.copyFileSync(
  file,
  path.join(
    backupDir,
    'portableVisualShare.ts',
  ),
);

let text = fs
  .readFileSync(file, 'utf8')
  .replace(/\r\n/g, '\n');

const oldBlock = `  if (
    source.length > consumed &&
    out.length > 0
  ) {
    out[out.length - 1] =
      out[out.length - 1]
        .replace(/[.\\s]+$/, '') + '…';
  }`;

const newBlock = `  if (
    source.length > consumed &&
    out.length > 0
  ) {
    const lastIndex = out.length - 1;
    const lastLine = out[lastIndex];

    if (lastLine !== undefined) {
      out[lastIndex] =
        lastLine.replace(/[.\\s]+$/, '') +
        '…';
    }
  }`;

if (text.includes(oldBlock)) {
  text = text.replace(
    oldBlock,
    newBlock,
  );
} else if (
  text.includes(
    'const lastLine = out[lastIndex];',
  )
) {
  console.log(
    '○ fix already present',
  );
} else {
  throw new Error(
    'SAFE STOP - target words() block changed',
  );
}

fs.writeFileSync(
  file,
  text,
  'utf8',
);

console.log('');
console.log('PORTABLE VISUAL TYPE FIX INSTALLED');
console.log('✓ guarded last wrapped line against undefined');
console.log('✓ no visual/share behavior changed');
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
    'TYPESCRIPT STILL HAS ERRORS',
  );
  console.error(
    'Backup:',
    backupDir,
  );
  process.exitCode = 1;
}
