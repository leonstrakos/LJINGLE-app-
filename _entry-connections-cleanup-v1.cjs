const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const file = path.join(
  MOBILE,
  'src',
  'screens',
  'EntryFormScreen.tsx',
);

if (!fs.existsSync(file)) {
  throw new Error('SAFE STOP - EntryFormScreen.tsx missing');
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(
  ROOT,
  '_recovery',
  'entry-connections-cleanup-v1-' + stamp,
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

function removeExistingGenericPanel(source) {
  const pattern =
    /\n?[ \t]*\{editing\s*&&\s*entryId\s*\?\s*\(\s*<EntityRelationsPanel[\s\S]*?\/>\s*\)\s*:\s*null\}\s*(?:\{\/\*\s*connectionsUnifyV1\s*\*\/\})?\s*/g;

  return source.replace(pattern, '\n');
}

function balancedViewRange(source, openIndex) {
  const tagRe = /<\/?View\b[^>]*>/g;
  tagRe.lastIndex = openIndex;

  let depth = 0;
  let started = false;

  while (true) {
    const match = tagRe.exec(source);
    if (!match) break;

    const tag = match[0];
    const isClose = tag.startsWith('</View');

    if (!started) {
      if (match.index !== openIndex || isClose) {
        fail('linksCard opening View parser lost its anchor');
      }
      started = true;
      depth = 1;
      continue;
    }

    if (isClose) {
      depth -= 1;
      if (depth === 0) {
        let end = tagRe.lastIndex;

        // Consume one following newline only.
        if (source[end] === '\n') end += 1;

        return { start: openIndex, end };
      }
    } else if (!tag.endsWith('/>')) {
      depth += 1;
    }
  }

  fail('could not find closing View for old linksCard');
}

// ------------------------------------------------------------------
// 1) Remove the generic panel from wherever the previous patch
//    accidentally inserted it (between Cancel / Save in current UI).
// ------------------------------------------------------------------

text = removeExistingGenericPanel(text);

// ------------------------------------------------------------------
// 2) Replace the OLD Book / Topic / Activity "Poveznice" card with
//    the same generic Collections & connections panel used by catalogue.
// ------------------------------------------------------------------

const oldLinksAnchor = '<View style={styles.linksCard}>';

let insertionPoint = text.indexOf(oldLinksAnchor);

if (insertionPoint >= 0) {
  const range = balancedViewRange(text, insertionPoint);

  text =
    text.slice(0, range.start) +
    text.slice(range.end);

  insertionPoint = range.start;
} else {
  // If another fork already removed the old visual card, place the
  // generic panel immediately before the save-error / final controls.
  const saveErrorIndex = text.lastIndexOf('{saveError ?');

  if (saveErrorIndex >= 0) {
    insertionPoint = saveErrorIndex;
  } else {
    const finalScrollClose = text.lastIndexOf('</ScrollView>');

    if (finalScrollClose < 0) {
      fail('old linksCard gone and no safe fallback insertion point found');
    }

    insertionPoint = finalScrollClose;
  }
}

const panel = `          {editing && entryId ? (
            <EntityRelationsPanel
              entityType="ENTRY"
              entityId={entryId}
              title={title.trim() || 'Zapis'}
            />
          ) : null}
          {/* entryConnectionsCleanupV1 */}

`;

text =
  text.slice(0, insertionPoint) +
  panel +
  text.slice(insertionPoint);

// ------------------------------------------------------------------
// 3) Ensure the generic panel import exists.
// ------------------------------------------------------------------

if (!text.includes("from '../components/EntityRelationsPanel'")) {
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

// ------------------------------------------------------------------
// 4) Visual old Poveznice UI is gone. We intentionally keep its
//    backing state/API fields for now so editing an older Zapis does
//    not silently erase legacy book/topic/activity data on Save.
// ------------------------------------------------------------------

fs.writeFileSync(file, text, 'utf8');

console.log('');
console.log('ENTRY CONNECTIONS CLEANUP V1 INSTALLED');
console.log('✓ old Poveznice Book / Topic / Activity card removed from UI');
console.log('✓ catalogue-style Collections & connections is now full-width');
console.log('✓ panel moved out of the Cancel / Save row');
console.log('✓ legacy relation values are preserved internally on older Zapisi');
console.log('✓ Topics and Frequency UI untouched');
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
