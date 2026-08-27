const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const portable = path.join(SRC, 'services', 'portableExport.ts');
const entry = path.join(SRC, 'screens', 'EntryFormScreen.tsx');

for (const file of [portable, entry]) {
  if (!fs.existsSync(file)) {
    throw new Error('SAFE STOP - missing ' + path.relative(ROOT, file));
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(
  ROOT,
  '_recovery',
  'share-cleanup-v1-' + stamp,
);

fs.mkdirSync(backupDir, { recursive: true });

for (const file of [portable, entry]) {
  fs.copyFileSync(
    file,
    path.join(backupDir, path.basename(file)),
  );
}

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

function fail(message) {
  throw new Error('SAFE STOP - ' + message);
}

// ---------------------------------------------------------------------------
// 1) Entry share gets its OWN state. Never hijack form saving.
// ---------------------------------------------------------------------------
{
  let text = read(entry);

  if (!text.includes('const [sharing, setSharing]')) {
    const savingMatch = text.match(
      /(\s+const \[saving,\s*setSaving\]\s*=\s*useState\(false\);)/,
    );

    if (!savingMatch || savingMatch.index == null) {
      fail('Entry saving state not found');
    }

    const insertAt =
      savingMatch.index + savingMatch[0].length;

    text =
      text.slice(0, insertAt) +
      '\n  const [sharing, setSharing] = useState(false);' +
      text.slice(insertAt);
  }

  const oldHandler = /  const shareEntry = async \(\) => \{\n    if \(!entryId \|\| saving\) return;\n\n    setSaving\(true\);\n    setSaveError\(null\);\n\n    try \{\n      await sharePortableEntry\(entryId\);\n    \} catch \(caught\) \{\n      setSaveError\(\n        caught instanceof Error\n          \? caught\.message\n          : 'Share nije uspio\.',\n      \);\n    \} finally \{\n      setSaving\(false\);\n    \}\n  \};/m;

  if (oldHandler.test(text)) {
    text = text.replace(
      oldHandler,
`  const shareEntry = async () => {
    if (!entryId || sharing) return;

    setSharing(true);
    setSaveError(null);

    try {
      await sharePortableEntry(entryId);
    } catch (caught) {
      setSaveError(
        caught instanceof Error
          ? caught.message
          : 'Share nije uspio.',
      );
    } finally {
      setSharing(false);
    }
  };`,
    );
  } else if (
    !text.includes('if (!entryId || sharing) return;')
  ) {
    fail('Entry share handler shape changed');
  }

  // Share button must use sharing, not saving.
  text = text.replace(
    /accessibilityLabel="Share zapis"([\s\S]{0,300}?)disabled=\{saving\}/m,
    'accessibilityLabel="Share zapis"$1disabled={sharing}',
  );

  text = text.replace(
    /pressed && styles\.pressed,\n\s+saving && styles\.disabled,/m,
    'pressed && styles.pressed,\n                    sharing && styles.disabled,',
  );

  write(entry, text);
  console.log('✓ Entry share no longer drives Save/Edit loading state');
}

// ---------------------------------------------------------------------------
// 2) Visual card does NOT need audio/image bytes.
//    Skip binary hydration only while building visual preview.
// ---------------------------------------------------------------------------
{
  let text = read(portable);

  if (!text.includes('let portableMetadataOnly = false;')) {
    const marker = 'async function assetFromUri(';
    const at = text.indexOf(marker);

    if (at < 0) {
      fail('assetFromUri missing');
    }

    text =
      text.slice(0, at) +
      `let portableMetadataOnly = false;\n\n` +
      text.slice(at);
  }

  if (!text.includes('// portableMetadataOnlyV1')) {
    const body =
      `): Promise<PortableAsset | null> {\n  try {`;

    if (!text.includes(body)) {
      fail('assetFromUri opening shape changed');
    }

    text = text.replace(
      body,
      `): Promise<PortableAsset | null> {\n  try {\n    // portableMetadataOnlyV1\n    // Visual cards only need graph/object metadata, not embedded binaries.\n    if (portableMetadataOnly) {\n      return null;\n    }`,
    );
  }

  // Replace current lazy web function with a clean branch:
  // choice first -> visual metadata-only build OR full build for Bridge/.ljingle.
  const startMarker = 'async function sharePortableLazyWeb(';
  const start = text.indexOf(startMarker);

  if (start < 0) {
    fail('sharePortableLazyWeb missing');
  }

  const nextMarker = '\nasync function sharePortableLazy(';
  const end = text.indexOf(nextMarker, start);

  if (end < 0) {
    fail('sharePortableLazyWeb end marker missing');
  }

  const replacement = `async function sharePortableLazyWeb(
  build: () => Promise<LjinglePortablePackage>,
) {
  if (portableLazyWebInFlight) {
    return null;
  }

  portableLazyWebInFlight = true;

  try {
    const preview = {
      title: 'LJingle object',
    } as LjinglePortablePackage;

    const choice =
      await webPortableShareChoice(preview);

    if (!choice) {
      return null;
    }

    if (choice === 'visual') {
      portableMetadataOnly = true;

      try {
        const pack = await build();

        return await sharePortableVisualCard(
          pack,
        );
      } finally {
        portableMetadataOnly = false;
      }
    }

    // Bridge and .ljingle intentionally build the complete canonical package.
    // Put a hard timeout around that work so a broken asset can never leave
    // the whole app permanently stuck in "sharing".
    const pack =
      await Promise.race([
        build(),
        new Promise<never>((_, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(
                  'Portable package build timed out after 20s. A linked media asset is not resolving.',
                ),
              ),
            20000,
          );
        }),
      ]);

    if (choice === 'bridge') {
      const sent =
        await sendPackageToSavedBridge(
          pack,
        );

      if (
        typeof window !== 'undefined'
      ) {
        window.alert(
          'Sent through Bridge to ' +
            sent.toBridgeId +
            '.',
        );
      }

      return sent.messageId;
    }

    if (choice === 'portable') {
      return sharePackage(pack);
    }

    return null;
  } finally {
    portableMetadataOnly = false;
    portableLazyWebInFlight = false;
  }
}
`;

  text =
    text.slice(0, start) +
    replacement +
    text.slice(end);

  // Make browser download more reliable: append anchor before click and revoke later.
  text = text.replace(
    `    anchor.href = href;
    anchor.download = filename;
    anchor.click();

    web.URL.revokeObjectURL(href);`,
    `    anchor.href = href;
    anchor.download = filename;
    web.document.body?.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(
      () => web.URL?.revokeObjectURL(href),
      0,
    );`,
  );

  write(portable, text);

  console.log('✓ Visual Card skips binary audio/image hydration');
  console.log('✓ Bridge/.ljingle still build full canonical package');
  console.log('✓ full build now fails visibly after 20s instead of hanging forever');
  console.log('✓ web .ljingle download anchor is attached before click');
  console.log('✓ Bridge gets visible browser success alert');
}

console.log('');
console.log('SHARE CLEANUP V1 INSTALLED');
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
