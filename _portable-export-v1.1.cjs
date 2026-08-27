const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const entryForm = path.join(SRC, 'screens', 'EntryFormScreen.tsx');
const radioScreen = path.join(SRC, 'screens', 'MemoryRadioScreen.tsx');
const portableService = path.join(SRC, 'services', 'portableExport.ts');
const portableTypes = path.join(SRC, 'types', 'portablePackage.ts');

for (const file of [entryForm, radioScreen, portableService, portableTypes]) {
  if (!fs.existsSync(file)) {
    throw new Error('SAFE STOP - missing ' + path.relative(ROOT, file));
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(ROOT, '_recovery', 'portable-export-v1-1-' + stamp);
fs.mkdirSync(backupDir, { recursive: true });

function backup(file) {
  fs.copyFileSync(file, path.join(backupDir, path.basename(file)));
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

backup(entryForm);
backup(radioScreen);

// ============================================================
// ENTRY FORM
// ============================================================

{
  let text = read(entryForm);

  if (!text.includes("from '../services/portableExport'")) {
    const entryImportRe =
      /import\s*\{\s*ApiError\s*,\s*entryApi\s*\}\s*from\s*['"]\.\.\/services\/entryApi['"];\s*/;

    if (!entryImportRe.test(text)) {
      fail('EntryForm entryApi import not found');
    }

    text = text.replace(
      entryImportRe,
      (match) =>
        match +
        "import { sharePortableEntry } from '../services/portableExport';\n",
    );
  }

  if (!text.includes('const shareEntry = async')) {
    const saveRe = /^  const save = async \(\) => \{/m;
    const saveMatch = saveRe.exec(text);

    if (!saveMatch) {
      fail('EntryForm save handler not found');
    }

    const handler = `  const shareEntry = async () => {
    if (!entryId || saving) return;

    setSaving(true);
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
      setSaving(false);
    }
  };

`;

    text =
      text.slice(0, saveMatch.index) +
      handler +
      text.slice(saveMatch.index);
  }

  if (!text.includes('SHARE .LJINGLE')) {
    const actionsRe = /^ {10}<View style=\{styles\.actions\}>/m;
    const actionsMatch = actionsRe.exec(text);

    if (!actionsMatch) {
      fail('EntryForm actions container not found');
    }

    const button = `          {editing && entryId ? (
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void shareEntry()}
              style={({ pressed }) => [
                {
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.separator,
                  backgroundColor: colors.surface,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 12,
                  fontWeight: '900',
                  letterSpacing: 0.5,
                }}
              >
                SHARE .LJINGLE
              </Text>
            </Pressable>
          ) : null}

`;

    text =
      text.slice(0, actionsMatch.index) +
      button +
      text.slice(actionsMatch.index);
  }

  write(entryForm, text);
}

// ============================================================
// MEMORY RADIO
// ============================================================

{
  let text = read(radioScreen);

  if (!text.includes("from '../services/portableExport'")) {
    const radioImportRe =
      /^import\s*\{[^}]*\bmemoryRadioApi\b[^}]*\}\s*from\s*['"]\.\.\/services\/memoryRadioApi['"];\s*$/m;

    const match = radioImportRe.exec(text);

    if (!match) {
      fail('MemoryRadio API import not found');
    }

    const insertion =
      match[0] +
      "\nimport { sharePortableFrequency } from '../services/portableExport';";

    text =
      text.slice(0, match.index) +
      insertion +
      text.slice(match.index + match[0].length);
  }

  if (!text.includes('const shareFrequency = async')) {
    const shuffleRe = /^  const shuffle = \(\) => \{/m;
    const shuffleMatch = shuffleRe.exec(text);

    if (!shuffleMatch) {
      fail('MemoryRadio shuffle handler not found');
    }

    const handler = `  const shareFrequency = async (
    memory: MemoryTrack,
  ) => {
    if (busyTrackId) return;

    setBusyTrackId(memory.trackId);
    setError(null);

    try {
      await sharePortableFrequency(memory.trackId);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Share nije uspio.',
      );
    } finally {
      setBusyTrackId(null);
    }
  };

`;

    text =
      text.slice(0, shuffleMatch.index) +
      handler +
      text.slice(shuffleMatch.index);
  }

  if (!text.includes('>SHARE</Text>')) {
    const rowActionsRe =
      /^ {20}<View style=\{styles\.rowActions\}>/m;

    const rowActionsMatch = rowActionsRe.exec(text);

    if (!rowActionsMatch) {
      fail('MemoryRadio rowActions container not found');
    }

    const replacement = `                    <View style={styles.rowActions}>
                      <Pressable
                        disabled={busy}
                        onPress={() => void shareFrequency(memory)}
                        style={({ pressed }) => [
                          styles.rowAction,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.rowActionText}>SHARE</Text>
                      </Pressable>`;

    text =
      text.slice(0, rowActionsMatch.index) +
      replacement +
      text.slice(rowActionsMatch.index + rowActionsMatch[0].length);
  }

  write(radioScreen, text);
}

console.log('');
console.log('PORTABLE EXPORT V1.1 PATCHED');
console.log('✓ robust EntryForm import/handler/button');
console.log('✓ robust MemoryRadio import/handler/button');
console.log('✓ existing portable service/types preserved');
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
  console.error('TYPESCRIPT FAILED');
  console.error('Backup:', backupDir);
  process.exitCode = 1;
}
