const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const file = path.join(MOBILE, 'src', 'screens', 'EntryFormScreen.tsx');

if (!fs.existsSync(file)) {
  throw new Error('SAFE STOP - EntryFormScreen.tsx missing');
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(
  ROOT,
  '_recovery',
  'connections-unify-v1-1-entry-' + stamp,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  file,
  path.join(backupDir, 'EntryFormScreen.tsx'),
);

let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function fail(message) {
  throw new Error('SAFE STOP - ' + message);
}

// ------------------------------------------------------------------
// 1) Import the same generic relation panel used by catalogue/games.
// ------------------------------------------------------------------

if (!text.includes("from '../components/EntityRelationsPanel'")) {
  const preferred =
    "import { EntryLinkPicker } from '../components/EntryLinkPicker';";

  if (text.includes(preferred)) {
    text = text.replace(
      preferred,
      preferred +
        "\nimport { EntityRelationsPanel } from '../components/EntityRelationsPanel';",
    );
  } else {
    const importMatches = [...text.matchAll(/^import .*;$/gm)];

    if (!importMatches.length) {
      fail('EntryForm import block not found');
    }

    const last = importMatches[importMatches.length - 1];
    const insertAt = last.index + last[0].length;

    text =
      text.slice(0, insertAt) +
      "\nimport { EntityRelationsPanel } from '../components/EntityRelationsPanel';" +
      text.slice(insertAt);
  }
}

// ------------------------------------------------------------------
// 2) Insert panel once. Avoid brittle "styles.actions" dependency.
//    Preferred placement: immediately before the form's final action
//    area. Fallback: before the outer/main ScrollView closes.
// ------------------------------------------------------------------

if (!text.includes('entityType="ENTRY"')) {
  const panel = `          {editing && entryId ? (
            <EntityRelationsPanel
              entityType="ENTRY"
              entityId={entryId}
              title={title.trim() || 'Zapis'}
            />
          ) : null}
          {/* connectionsUnifyV1 */}

`;

  let insertAt = -1;

  // A) Old/current common action wrapper.
  const actionAnchors = [
    '          <View style={styles.actions}>',
    '        <View style={styles.actions}>',
    '      <View style={styles.actions}>',
  ];

  for (const anchor of actionAnchors) {
    const index = text.indexOf(anchor);
    if (index >= 0) {
      insertAt = index;
      break;
    }
  }

  // B) Find the final save button area and insert before its nearest
  // parent View, regardless of the style name used by another fork.
  if (insertAt < 0) {
    const saveNeedles = [
      "label={editing ? 'Spremi promjene' : 'Spremi zapis'}",
      'Spremi promjene',
      'Spremi zapis',
    ];

    let saveIndex = -1;

    for (const needle of saveNeedles) {
      saveIndex = text.lastIndexOf(needle);
      if (saveIndex >= 0) break;
    }

    if (saveIndex >= 0) {
      const windowStart = Math.max(0, saveIndex - 2200);
      const beforeSave = text.slice(windowStart, saveIndex);

      const viewMatches = [...beforeSave.matchAll(/^[ \t]*<View\b[^\n>]*>/gm)];

      if (viewMatches.length) {
        const candidate = viewMatches[viewMatches.length - 1];
        insertAt = windowStart + candidate.index;
      }
    }
  }

  // C) Robust final fallback: insert before the last ScrollView closing
  // tag before KeyboardAvoidingView/SafeArea end.
  if (insertAt < 0) {
    const keyboardClose = text.lastIndexOf('</KeyboardAvoidingView>');
    const searchEnd = keyboardClose >= 0 ? keyboardClose : text.length;
    const scrollIndex = text.lastIndexOf('</ScrollView>', searchEnd);

    if (scrollIndex >= 0) {
      insertAt = scrollIndex;
    }
  }

  if (insertAt < 0) {
    fail('could not find a safe EntryForm insertion point');
  }

  text =
    text.slice(0, insertAt) +
    panel +
    text.slice(insertAt);
}

fs.writeFileSync(file, text, 'utf8');

console.log('');
console.log('CONNECTIONS UNIFY V1.1 — ENTRY COMPLETE');
console.log('✓ generic Collections & connections panel added to saved Zapisi');
console.log('✓ no dependency on styles.actions anchor');
console.log('✓ existing @Topic / slash-command work preserved');
console.log('✓ Frequency + catalogue changes from V1 remain untouched');
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
  console.error('The patch was written; paste the current TS output.');
  console.error('Backup:', backupDir);
  process.exitCode = 1;
}
