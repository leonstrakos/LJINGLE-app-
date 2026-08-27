const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const portable = path.join(SRC, 'services', 'portableExport.ts');
const settings = path.join(SRC, 'screens', 'ThemePickerScreen.tsx');

for (const file of [portable, settings]) {
  if (!fs.existsSync(file)) {
    throw new Error(
      'SAFE STOP - missing ' + path.relative(ROOT, file),
    );
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(
  ROOT,
  '_recovery',
  'share-unfreeze-settings-v1-' + stamp,
);

fs.mkdirSync(backupDir, { recursive: true });

for (const file of [portable, settings]) {
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

// ============================================================================
// 1) WEB ASSET EXPORT: replace JS byte->binary concatenation with FileReader.
//    The old loop can lock the browser for large Frequency audio.
// ============================================================================

{
  let text = read(portable);

  if (!text.includes('// portableFileReaderBase64V1')) {
    const old = `      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      let binary = '';
      const step = 0x8000;

      for (
        let index = 0;
        index < bytes.length;
        index += step
      ) {
        binary += String.fromCharCode(
          ...bytes.subarray(
            index,
            Math.min(index + step, bytes.length),
          ),
        );
      }

      const base64 =
        (globalThis as unknown as {
          btoa?: (value: string) => string;
        }).btoa?.(binary) ?? null;`;

    if (!text.includes(old)) {
      // Current file may already contain the hydrateWebAudio fetch patch, but
      // the encoding block itself should still have these semantic markers.
      const start = text.indexOf(
        '      const buffer = await blob.arrayBuffer();',
      );
      const endNeedle = '        }).btoa?.(binary) ?? null;';
      const end = text.indexOf(endNeedle, start);

      if (start < 0 || end < 0) {
        fail(
          'web byte/base64 block shape changed; no file modified',
        );
      }

      const replacement = `      // portableFileReaderBase64V1
      // Browser-native async conversion avoids freezing the JS thread on
      // large audio files.
      const base64 =
        await new Promise<string | null>(
          (resolve, reject) => {
            const reader = new FileReader();

            reader.onerror = () =>
              reject(
                reader.error ||
                  new Error(
                    'Browser could not read portable asset.',
                  ),
              );

            reader.onload = () => {
              const result =
                typeof reader.result === 'string'
                  ? reader.result
                  : '';

              const comma =
                result.indexOf(',');

              resolve(
                comma >= 0
                  ? result.slice(comma + 1)
                  : null,
              );
            };

            reader.readAsDataURL(blob);
          },
        );

      const byteLength = blob.size;`;

      text =
        text.slice(0, start) +
        replacement +
        text.slice(end + endNeedle.length);

      // Existing return uses bytes.length.
      text = text.replace(
        /byteLength:\s*bytes\.length,/,
        'byteLength,',
      );
    } else {
      const replacement = `      // portableFileReaderBase64V1
      // Browser-native async conversion avoids freezing the JS thread on
      // large audio files.
      const base64 =
        await new Promise<string | null>(
          (resolve, reject) => {
            const reader = new FileReader();

            reader.onerror = () =>
              reject(
                reader.error ||
                  new Error(
                    'Browser could not read portable asset.',
                  ),
              );

            reader.onload = () => {
              const result =
                typeof reader.result === 'string'
                  ? reader.result
                  : '';

              const comma =
                result.indexOf(',');

              resolve(
                comma >= 0
                  ? result.slice(comma + 1)
                  : null,
              );
            };

            reader.readAsDataURL(blob);
          },
        );

      const byteLength = blob.size;`;

      text = text.replace(old, replacement);
      text = text.replace(
        /byteLength:\s*bytes\.length,/,
        'byteLength,',
      );
    }
  }

  write(portable, text);
  console.log(
    '✓ web audio/image base64 now uses async FileReader (no JS freeze loop)',
  );
}

// ============================================================================
// 2) SETTINGS: move BridgePanel to the end of ScrollView content.
//    This is intentionally simple and structural: remove its one occurrence,
//    then put it immediately before the OUTERMOST closing ScrollView.
// ============================================================================

{
  let text = read(settings);
  const tag = '<BridgePanel />';
  const count = text.split(tag).length - 1;

  if (count !== 1) {
    fail(
      'expected exactly one BridgePanel in ThemePickerScreen, found ' +
        count,
    );
  }

  text = text.replace(
    /\n[ \t]*<BridgePanel \/>/,
    '',
  );

  // ThemePicker has nested ScrollView components. The last closing one is the
  // outer content boundary, after all cards/buttons are already closed.
  const close = text.lastIndexOf('</ScrollView>');

  if (close < 0) {
    fail('ThemePicker closing ScrollView not found');
  }

  text =
    text.slice(0, close) +
    `        <BridgePanel />\n      ` +
    text.slice(close);

  // Defensive source audit: at Bridge position, count actual JSX Pressable
  // opening/closing tags. Multi-line props are handled.
  const bridgeIndex = text.indexOf(tag);
  const prefix = text.slice(0, bridgeIndex);
  const openCount =
    (prefix.match(/<Pressable(?:\s|>)[\s\S]*?>/g) || [])
      .filter((token) => !token.endsWith('/>'))
      .length;
  const closeCount =
    (prefix.match(/<\/Pressable\s*>/g) || []).length;

  if (openCount !== closeCount) {
    // Do not write a structure we cannot prove.
    fail(
      'BridgePanel would still be inside Pressable at end of ScrollView ' +
        `(opens=${openCount}, closes=${closeCount})`,
    );
  }

  write(settings, text);

  console.log(
    '✓ BridgePanel moved after Settings cards/buttons, before outer ScrollView close',
  );
  console.log(
    '✓ source audit confirms no Pressable ancestor at BridgePanel',
  );
}

console.log('');
console.log('SHARE UNFREEZE + SETTINGS STRUCTURE FIX INSTALLED');
console.log('✓ no server changes');
console.log('✓ no local data changes');
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
