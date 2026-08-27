const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const portable = path.join(SRC, 'services', 'portableExport.ts');
const settings = path.join(SRC, 'screens', 'ThemePickerScreen.tsx');
const bridge = path.join(SRC, 'components', 'BridgePanel.tsx');

for (const file of [portable, settings, bridge]) {
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
  'share-immediate-bridge-nesting-' + stamp,
);

fs.mkdirSync(backupDir, { recursive: true });

for (const file of [portable, settings, bridge]) {
  fs.copyFileSync(
    file,
    path.join(backupDir, path.basename(file)),
  );
}

function read(file) {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\r\n/g, '\n');
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

function fail(message) {
  throw new Error('SAFE STOP - ' + message);
}

// ============================================================================
// 1) SETTINGS: guarantee BridgePanel is not inside ANY Pressable.
// ============================================================================

{
  let text = read(settings);
  const tag = '<BridgePanel />';
  const originalIndex = text.indexOf(tag);

  if (originalIndex < 0) {
    fail('BridgePanel tag missing from ThemePickerScreen');
  }

  function pressableDepthBefore(source, index) {
    const tokens =
      source
        .slice(0, index)
        .match(/<\/?Pressable\b[^>]*>/g) || [];

    let depth = 0;

    for (const token of tokens) {
      if (token.startsWith('</')) {
        depth = Math.max(0, depth - 1);
      } else if (!token.endsWith('/>')) {
        depth += 1;
      }
    }

    return depth;
  }

  const depth = pressableDepthBefore(
    text,
    originalIndex,
  );

  if (depth > 0) {
    text =
      text.slice(0, originalIndex) +
      text.slice(originalIndex + tag.length);

    let cursor = originalIndex;
    let remaining = depth;

    while (remaining > 0) {
      const close =
        text.indexOf('</Pressable>', cursor);

      if (close < 0) {
        fail(
          'BridgePanel is inside Pressable but closing tag was not found',
        );
      }

      cursor =
        close + '</Pressable>'.length;
      remaining -= 1;
    }

    text =
      text.slice(0, cursor) +
      '\n\n        <BridgePanel />' +
      text.slice(cursor);
  }

  const finalIndex = text.indexOf(tag);
  const finalDepth =
    pressableDepthBefore(text, finalIndex);

  if (finalDepth !== 0) {
    fail(
      'BridgePanel still has Pressable ancestor after relocation',
    );
  }

  write(settings, text);

  console.log(
    depth > 0
      ? '✓ BridgePanel moved out of Pressable ancestor'
      : '✓ BridgePanel already outside Settings Pressables',
  );
}

// ============================================================================
// 2) Audit BridgePanel itself for nested Pressables.
//    Original BridgePanel has sibling buttons, not nested buttons.
// ============================================================================

{
  const text = read(bridge);
  const tokens =
    [...text.matchAll(/<\/?Pressable\b[^>]*>/g)];

  let depth = 0;
  let nested = 0;

  for (const match of tokens) {
    const token = match[0];

    if (token.startsWith('</')) {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (!token.endsWith('/>')) {
      if (depth > 0) {
        nested += 1;
      }
      depth += 1;
    }
  }

  if (nested > 0) {
    const audit = path.join(
      ROOT,
      '_bridge-panel-nested-pressable-audit.txt',
    );

    fs.writeFileSync(audit, text, 'utf8');

    fail(
      'BridgePanel itself contains nested Pressables; wrote _bridge-panel-nested-pressable-audit.txt',
    );
  }

  console.log(
    '✓ BridgePanel contains no nested Pressables internally',
  );
}

// ============================================================================
// 3) WEB SHARE: choose FIRST, build package SECOND.
//    This makes the chooser appear immediately even if Frequency audio needs
//    IndexedDB hydration + base64 encoding.
// ============================================================================

{
  let text = read(portable);

  if (
    !text.includes(
      'async function sharePortableLazyWeb(',
    )
  ) {
    const exportMarker =
      'export async function sharePortableEntry(';

    const insertAt =
      text.indexOf(exportMarker);

    if (insertAt < 0) {
      fail('sharePortableEntry export missing');
    }

    const helper = `
let portableLazyWebInFlight = false;

async function sharePortableLazyWeb(
  build: () => Promise<LjinglePortablePackage>,
) {
  if (portableLazyWebInFlight) {
    return null;
  }

  portableLazyWebInFlight = true;

  try {
    // IMPORTANT: open chooser BEFORE hydrating/base64-encoding assets.
    const preview = {
      title: 'LJingle object',
    } as LjinglePortablePackage;

    const choice =
      await webPortableShareChoice(preview);

    if (!choice) {
      return null;
    }

    const pack = await build();

    if (choice === 'visual') {
      return sharePortableVisualCard(pack);
    }

    if (choice === 'bridge') {
      const sent =
        await sendPackageToSavedBridge(
          pack,
        );

      return sent.messageId;
    }

    if (choice === 'portable') {
      return sharePackage(pack);
    }

    return null;
  } finally {
    portableLazyWebInFlight = false;
  }
}

async function sharePortableLazy(
  build: () => Promise<LjinglePortablePackage>,
) {
  if (Platform.OS === 'web') {
    return sharePortableLazyWeb(build);
  }

  return choosePortableShare(
    await build(),
  );
}

`;

    text =
      text.slice(0, insertAt) +
      helper +
      text.slice(insertAt);
  }

  const replacements = [
    {
      name: 'Entry',
      regex:
        /export async function sharePortableEntry\(\s*entryId:\s*string,\s*\)\s*\{[\s\S]*?\n\}/m,
      replacement: `export async function sharePortableEntry(
  entryId: string,
) {
  return sharePortableLazy(
    () =>
      buildPortableEntryPackage(
        entryId,
      ),
  );
}`,
    },
    {
      name: 'Frequency',
      regex:
        /export async function sharePortableFrequency\(\s*trackId:\s*string,\s*\)\s*\{[\s\S]*?\n\}/m,
      replacement: `export async function sharePortableFrequency(
  trackId: string,
) {
  return sharePortableLazy(
    () =>
      buildPortableFrequencyPackage(
        trackId,
      ),
  );
}`,
    },
    {
      name: 'Collection',
      regex:
        /export async function sharePortableCollection\(\s*collectionId:\s*string,\s*\)\s*\{[\s\S]*?\n\}/m,
      replacement: `export async function sharePortableCollection(
  collectionId: string,
) {
  return sharePortableLazy(
    () =>
      buildPortableCollectionPackage(
        collectionId,
      ),
  );
}`,
    },
    {
      name: 'Topic',
      regex:
        /export async function sharePortableTopic\(\s*topicId:\s*string,\s*\)\s*\{[\s\S]*?\n\}/m,
      replacement: `export async function sharePortableTopic(
  topicId: string,
) {
  return sharePortableLazy(
    () =>
      buildPortableTopicPackage(
        topicId,
      ),
  );
}`,
    },
  ];

  for (const item of replacements) {
    if (!item.regex.test(text)) {
      fail(
        'could not locate sharePortable' +
          item.name +
          ' function',
      );
    }

    text = text.replace(
      item.regex,
      item.replacement,
    );
  }

  write(portable, text);

  console.log(
    '✓ web share chooser now opens before package/audio building',
  );
  console.log(
    '✓ Entry / Frequency / Collection / Topic use the same lazy web flow',
  );
}

console.log('');
console.log('SHARE IMMEDIATE + BRIDGE NESTING FIX INSTALLED');
console.log('✓ no server changes');
console.log('✓ no data changes');
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
  console.error('TYPESCRIPT HAS ERRORS');
  console.error('Backup:', backupDir);
  process.exitCode = 1;
}
