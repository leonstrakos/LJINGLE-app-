const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const FILE = path.join(
  MOBILE,
  'src',
  'screens',
  'ThemePickerScreen.tsx',
);

if (!fs.existsSync(FILE)) {
  throw new Error(
    'SAFE STOP - ThemePickerScreen.tsx missing',
  );
}

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, '-');

const backupDir = path.join(
  ROOT,
  '_recovery',
  'portable-import-nesting-fix-' + stamp,
);

fs.mkdirSync(backupDir, {
  recursive: true,
});

fs.copyFileSync(
  FILE,
  path.join(
    backupDir,
    'ThemePickerScreen.tsx',
  ),
);

let text = fs
  .readFileSync(FILE, 'utf8')
  .replace(/\r\n/g, '\n');

function fail(message) {
  throw new Error(
    'SAFE STOP - ' + message,
  );
}

const tag = '<PortableImportPanel />';
const count =
  text.split(tag).length - 1;

if (count !== 1) {
  fail(
    'expected exactly one PortableImportPanel, found ' +
      count,
  );
}

const tagIndex =
  text.indexOf(tag);

// Confirm the exact corruption shown by the audit:
// PortableImportPanel is between <Text style={styles.exportTitle}>
// and its closing </Text>, which itself is inside the JSON export Pressable.
const textOpen =
  text.lastIndexOf(
    '<Text style={styles.exportTitle}>',
    tagIndex,
  );

const textClose =
  text.indexOf(
    '</Text>',
    tagIndex,
  );

const pressableOpen =
  text.lastIndexOf(
    '<Pressable',
    tagIndex,
  );

const pressableClose =
  text.indexOf(
    '</Pressable>',
    tagIndex,
  );

if (
  textOpen < 0 ||
  textClose < 0 ||
  pressableOpen < 0 ||
  pressableClose < 0 ||
  !(
    pressableOpen <
      textOpen &&
    textOpen <
      tagIndex &&
    tagIndex <
      textClose &&
    textClose <
      pressableClose
  )
) {
  fail(
    'PortableImportPanel is not in the expected JSON backup Pressable/Text shape',
  );
}

// Remove the misplaced component plus nearby blank whitespace.
const lineStart =
  text.lastIndexOf(
    '\n',
    tagIndex,
  ) + 1;

const lineEndRaw =
  text.indexOf(
    '\n',
    tagIndex,
  );

const lineEnd =
  lineEndRaw < 0
    ? text.length
    : lineEndRaw + 1;

text =
  text.slice(0, lineStart) +
  text.slice(lineEnd);

// Locate JSON export Pressable again after removal.
const exportPressable =
  text.indexOf(
    '<Pressable',
    Math.max(
      0,
      pressableOpen - 100,
    ),
  );

if (exportPressable < 0) {
  fail(
    'JSON export Pressable could not be relocated',
  );
}

// Insert PortableImportPanel as a SIBLING before the JSON backup button.
// This restores intended ordering: portable import, then machine JSON backup.
const exportLineStart =
  text.lastIndexOf(
    '\n',
    exportPressable,
  ) + 1;

text =
  text.slice(0, exportLineStart) +
  '        <PortableImportPanel />\n\n' +
  text.slice(exportLineStart);

// Defensive validation: component must not sit inside Text or Pressable.
const finalIndex =
  text.indexOf(tag);

const prefix =
  text.slice(0, finalIndex);

const openPressables =
  (prefix.match(/<Pressable\b/g) || [])
    .length;

const closePressables =
  (prefix.match(/<\/Pressable>/g) || [])
    .length;

const openTexts =
  (prefix.match(/<Text\b/g) || [])
    .length;

const closeTexts =
  (prefix.match(/<\/Text>/g) || [])
    .length;

if (
  openPressables !== closePressables
) {
  fail(
    'PortableImportPanel would still have a Pressable ancestor',
  );
}

if (
  openTexts !== closeTexts
) {
  fail(
    'PortableImportPanel would still have a Text ancestor',
  );
}

fs.writeFileSync(
  FILE,
  text,
  'utf8',
);

console.log('');
console.log('PORTABLE IMPORT NESTING FIX INSTALLED');
console.log('✓ found the real nested-button source');
console.log('✓ PortableImportPanel removed from JSON backup title');
console.log('✓ PortableImportPanel is now a sibling of JSON backup button');
console.log('✓ no Pressable ancestor');
console.log('✓ no Text ancestor');
console.log('✓ BridgePanel untouched');
console.log('✓ share/export logic untouched');
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
