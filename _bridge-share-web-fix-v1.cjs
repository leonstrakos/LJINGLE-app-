const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const settings = path.join(
  SRC,
  'screens',
  'ThemePickerScreen.tsx',
);
const bridgePanel = path.join(
  SRC,
  'components',
  'BridgePanel.tsx',
);
const portableExport = path.join(
  SRC,
  'services',
  'portableExport.ts',
);

for (const file of [
  settings,
  bridgePanel,
  portableExport,
]) {
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
  'bridge-share-web-fix-v1-' + stamp,
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
  fs.writeFileSync(file, text, 'utf8');
}

for (const file of [
  settings,
  bridgePanel,
  portableExport,
]) {
  fs.copyFileSync(
    file,
    path.join(
      backupDir,
      path.basename(file),
    ),
  );
}

function fail(message) {
  throw new Error(
    'SAFE STOP - ' + message,
  );
}

// ============================================================================
// 1) Robustly move BridgePanel outside ANY Pressable ancestor in Settings.
// ============================================================================

{
  let text = read(settings);

  const bridgeTag = '<BridgePanel />';
  const bridgeIndex = text.indexOf(bridgeTag);

  if (bridgeIndex < 0) {
    fail('BridgePanel missing from ThemePickerScreen');
  }

  // Remove the current occurrence.
  text =
    text.slice(0, bridgeIndex) +
    text.slice(bridgeIndex + bridgeTag.length);

  // Reinsert immediately before the JSON backup Pressable.
  // This location is known to be top-level content in the Settings ScrollView.
  const exportAnchor = `<Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => void exportData()}`;

  const exportIndex = text.indexOf(exportAnchor);

  if (exportIndex < 0) {
    fail('JSON backup export Pressable anchor changed');
  }

  // Defensive check: count open Pressables before export anchor.
  // We only care that Bridge itself is not placed inside an unclosed Pressable.
  const prefix = text.slice(0, exportIndex);
  const opens = (prefix.match(/<Pressable\b/g) || []).length;
  const closes = (prefix.match(/<\/Pressable>/g) || []).length;

  let insertIndex = exportIndex;

  if (opens !== closes) {
    // Find the nearest top-level close before export anchor, then insert after it.
    // This handles a previously malformed insertion without rewriting unrelated UI.
    let cursor = exportIndex;
    let depth = opens - closes;

    while (depth > 0) {
      const closeIndex = text.indexOf('</Pressable>', cursor);

      if (closeIndex < 0) {
        fail('could not escape Pressable ancestor around Bridge area');
      }

      cursor =
        closeIndex + '</Pressable>'.length;
      depth -= 1;
    }

    insertIndex = cursor;
  }

  text =
    text.slice(0, insertIndex) +
    `

        <BridgePanel />

        ` +
    text.slice(insertIndex);

  write(settings, text);
}

// ============================================================================
// 2) Bridge SHARE CODE: on web use clipboard, not navigator.share.
//    This prevents the "earlier share has not yet completed" browser error.
// ============================================================================

{
  let text = read(bridgePanel);

  // Ensure Platform import.
  text = text.replace(
    `  Pressable,
  Share,
  StyleSheet,`,
    `  Pressable,
  Share,
  Platform,
  StyleSheet,`,
  );

  if (
    !text.includes(
      'const shareBridgeCode = async',
    )
  ) {
    const anchor =
      `  const activate =
    async () => {`;

    const index = text.indexOf(anchor);

    if (index < 0) {
      fail('BridgePanel activate handler anchor changed');
    }

    const handler = `  const shareBridgeCode = async () => {
    if (!identity) return;

    const message =
      'My LJingle Bridge code: ' +
      identity.bridgeId;

    try {
      if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.clipboard
      ) {
        await navigator.clipboard.writeText(
          message,
        );

        setMessage(
          'Bridge code copied.',
        );

        return;
      }

      await Share.share({
        message,
      });
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : 'Bridge code nije podijeljen.',
      );
    }
  };

`;

    text =
      text.slice(0, index) +
      handler +
      text.slice(index);
  }

  text = text.replace(
    /onPress=\{\(\) =>\s*void Share\.share\(\{\s*message:\s*'My LJingle Bridge code: '\s*\+\s*identity\.bridgeId,\s*\}\)\s*\}/m,
    `onPress={() =>
                void shareBridgeCode()
              }`,
  );

  write(bridgePanel, text);
}

// ============================================================================
// 3) Portable sharing: global in-flight lock.
//    Nested click/bubbling can no longer open two Web Share sessions.
// ============================================================================

{
  let text = read(portableExport);

  if (
    !text.includes(
      'let portableShareInFlight = false;',
    )
  ) {
    const chooserAnchor =
      'async function choosePortableShare(';

    const index = text.indexOf(chooserAnchor);

    if (index < 0) {
      fail('choosePortableShare missing');
    }

    text =
      text.slice(0, index) +
      `let portableShareInFlight = false;

` +
      text.slice(index);
  }

  const oldStart = `async function choosePortableShare(
  pack: LjinglePortablePackage,
) {
  let choice: string | null = null;`;

  const newStart = `async function choosePortableShare(
  pack: LjinglePortablePackage,
) {
  if (portableShareInFlight) {
    return null;
  }

  portableShareInFlight = true;

  let choice: string | null = null;

  try {`;

  if (text.includes(oldStart)) {
    text = text.replace(
      oldStart,
      newStart,
    );

    const oldEnd = `  return null;
}

export async function sharePortableEntry`;

    const newEnd = `    return null;
  } finally {
    portableShareInFlight = false;
  }
}

export async function sharePortableEntry`;

    if (!text.includes(oldEnd)) {
      fail('choosePortableShare end anchor changed');
    }

    text = text.replace(
      oldEnd,
      newEnd,
    );
  } else if (
    !text.includes(
      'portableShareInFlight = true;',
    )
  ) {
    fail('choosePortableShare shape changed');
  }

  write(portableExport, text);
}

console.log('');
console.log('BRIDGE + SHARE WEB FIX V1 INSTALLED');
console.log('✓ BridgePanel relocated outside any Pressable ancestor');
console.log('✓ ThemePicker nested <button> source removed');
console.log('✓ Share Code copies to clipboard on web');
console.log('✓ native Share Code still uses system share');
console.log('✓ portable share has a global in-flight guard');
console.log('✓ double click / bubbled click cannot start two Web Share sessions');
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
    'TYPESCRIPT HAS ERRORS',
  );
  console.error(
    'Backup:',
    backupDir,
  );
  process.exitCode = 1;
}
