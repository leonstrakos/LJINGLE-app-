const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const bridgeApi = path.join(
  SRC,
  'services',
  'bridgeApi.ts',
);

const settings = path.join(
  SRC,
  'screens',
  'ThemePickerScreen.tsx',
);

for (const file of [bridgeApi, settings]) {
  if (!fs.existsSync(file)) {
    throw new Error(
      'SAFE STOP - missing ' +
        path.relative(ROOT, file),
    );
  }
}

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, '-');

const backupDir = path.join(
  ROOT,
  '_recovery',
  'bridge-fix-v1-1-' + stamp,
);

fs.mkdirSync(backupDir, {
  recursive: true,
});

function read(file) {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\r\n/g, '\n');
}

function write(file, text) {
  fs.writeFileSync(
    file,
    text,
    'utf8',
  );
}

for (const file of [bridgeApi, settings]) {
  fs.copyFileSync(
    file,
    path.join(
      backupDir,
      path.basename(file),
    ),
  );
}

// ============================================================================
// 1) TypeScript HeadersInit fix
// ============================================================================

{
  let text = read(bridgeApi);

  const old = `  const headers = identity
    ? await identityHeaders()
    : bootstrapHeaders();

  const response = await fetch(
    BRIDGE_API_BASE + route,
    {
      ...init,
      headers: {
        ...headers,
        ...(init.body
          ? {
              'Content-Type':
                'application/json',
            }
          : {}),
        ...(init.headers || {}),
      },
    },
  );`;

  const replacement = `  const baseHeaders = identity
    ? await identityHeaders()
    : bootstrapHeaders();

  const headers = new Headers();

  for (const [key, value] of Object.entries(
    baseHeaders,
  )) {
    if (value) {
      headers.set(key, String(value));
    }
  }

  if (init.body) {
    headers.set(
      'Content-Type',
      'application/json',
    );
  }

  if (init.headers) {
    new Headers(init.headers).forEach(
      (value, key) => {
        headers.set(key, value);
      },
    );
  }

  const response = await fetch(
    BRIDGE_API_BASE + route,
    {
      ...init,
      headers,
    },
  );`;

  if (text.includes(old)) {
    text = text.replace(
      old,
      replacement,
    );
  } else if (
    !text.includes(
      'const headers = new Headers();',
    )
  ) {
    throw new Error(
      'SAFE STOP - bridgeApi request headers block changed',
    );
  }

  write(bridgeApi, text);
}

// ============================================================================
// 2) Move BridgePanel OUTSIDE JSON backup Pressable
//    This fixes both:
//      - clicking Bridge downloading JSON
//      - <button> nested inside <button> web warning
// ============================================================================

{
  let text = read(settings);

  const bridgeTag = '<BridgePanel />';

  const count =
    text.split(bridgeTag).length - 1;

  if (count !== 1) {
    throw new Error(
      'SAFE STOP - expected exactly one BridgePanel, found ' +
        count,
    );
  }

  // Remove it wherever V1 accidentally inserted it.
  text = text.replace(
    /\n[ \t]*<BridgePanel \/>/,
    '',
  );

  // Put Bridge as its own sibling immediately before JSON backup export.
  const exportAnchor = `<Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => void exportData()}`;

  const index =
    text.indexOf(exportAnchor);

  if (index < 0) {
    throw new Error(
      'SAFE STOP - JSON export Pressable anchor changed',
    );
  }

  text =
    text.slice(0, index) +
    `<BridgePanel />

        ` +
    text.slice(index);

  if (
    !text.includes(
      '<BridgePanel />\n\n        <Pressable\n          accessibilityRole="button"\n          disabled={saving}\n          onPress={() => void exportData()}',
    )
  ) {
    throw new Error(
      'SAFE STOP - BridgePanel was not placed as export sibling',
    );
  }

  write(settings, text);
}

console.log('');
console.log('BRIDGE FIX V1.1 INSTALLED');
console.log('✓ bridgeApi HeadersInit TypeScript error fixed');
console.log('✓ BridgePanel moved outside JSON backup Pressable');
console.log('✓ clicking Bridge no longer triggers JSON download');
console.log('✓ Bridge buttons are no longer nested inside JSON export button');
console.log('✓ no Bridge identity/data reset');
console.log('✓ no server changes');
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
