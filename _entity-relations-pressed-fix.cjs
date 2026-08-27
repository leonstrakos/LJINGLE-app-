const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const file = path.join(
  MOBILE,
  'src',
  'components',
  'EntityRelationsPanel.tsx',
);

if (!fs.existsSync(file)) {
  throw new Error(
    'SAFE STOP - EntityRelationsPanel.tsx missing',
  );
}

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, '-');

const backupDir = path.join(
  ROOT,
  '_recovery',
  'entity-relations-pressed-fix-' + stamp,
);

fs.mkdirSync(backupDir, {
  recursive: true,
});

fs.copyFileSync(
  file,
  path.join(
    backupDir,
    'EntityRelationsPanel.tsx',
  ),
);

let text = fs
  .readFileSync(file, 'utf8')
  .replace(/\r\n/g, '\n');

if (!text.includes('styles.pressed')) {
  console.log('');
  console.log('ENTITY RELATIONS PRESSED FIX');
  console.log(
    '○ styles.pressed is no longer referenced — no edit needed.',
  );
} else if (text.includes('  pressed:')) {
  console.log('');
  console.log('ENTITY RELATIONS PRESSED FIX');
  console.log(
    '○ pressed style already exists — no edit needed.',
  );
} else {
  const disabledIndex =
    text.indexOf('  disabled:');

  if (disabledIndex >= 0) {
    text =
      text.slice(0, disabledIndex) +
      `  pressed: {
    opacity: 0.72,
  },
` +
      text.slice(disabledIndex);
  } else {
    const close =
      text.lastIndexOf('});');

    if (close < 0) {
      throw new Error(
        'SAFE STOP - StyleSheet closing anchor not found',
      );
    }

    text =
      text.slice(0, close) +
      `  pressed: {
    opacity: 0.72,
  },
` +
      text.slice(close);
  }

  fs.writeFileSync(
    file,
    text,
    'utf8',
  );

  console.log('');
  console.log('ENTITY RELATIONS PRESSED FIX');
  console.log('✓ added styles.pressed');
  console.log(
    '✓ no graph/navigation logic changed',
  );
}

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
