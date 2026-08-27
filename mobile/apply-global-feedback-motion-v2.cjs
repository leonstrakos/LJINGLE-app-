const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = process.cwd();

function runTsc(label) {
  console.log(`\n${label}`);
  const result =
    process.platform === 'win32'
      ? cp.spawnSync('cmd.exe', ['/d', '/s', '/c', 'npx tsc --noEmit'], {
          cwd: root,
          stdio: 'inherit',
        })
      : cp.spawnSync('npx', ['tsc', '--noEmit'], {
          cwd: root,
          stdio: 'inherit',
        });

  if (result.error) {
    console.error(result.error.message);
    return false;
  }
  return result.status === 0;
}

if (!runTsc('Preflight TypeScript check...')) {
  console.error('\nSAFE STOP: projekt nije clean prije patcha. Ništa nije promijenjeno.');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backups = [];
const touched = [];

function abs(rel) {
  return path.join(root, rel);
}

function ensureFile(rel) {
  if (!fs.existsSync(abs(rel))) {
    throw new Error(`Missing file: ${rel}`);
  }
}

function save(rel, next) {
  ensureFile(rel);
  const target = abs(rel);
  const prev = fs.readFileSync(target, 'utf8');
  if (prev === next) return;

  const backup = `${target}.before-global-feedback-motion-v2-${stamp}.bak`;
  fs.copyFileSync(target, backup);
  backups.push([target, backup]);
  fs.writeFileSync(target, next, 'utf8');
  touched.push(rel);
}

function restore() {
  for (const [target, backup] of backups.reverse()) {
    if (fs.existsSync(backup)) fs.copyFileSync(backup, target);
  }
}

function addImport(src, importLine) {
  if (src.includes(importLine)) return src;

  const imports = [...src.matchAll(/^import .*?;$/gm)];
  if (!imports.length) {
    throw new Error(`No imports found for: ${importLine}`);
  }

  const last = imports[imports.length - 1];
  const at = last.index + last[0].length;
  return src.slice(0, at) + '\n' + importLine + src.slice(at);
}

function insertAfterLine(src, rx, lineToAdd, label) {
  if (src.includes(lineToAdd.trim())) return src;

  let found = false;
  const out = src.replace(rx, (match, indent = '') => {
    if (found) return match;
    found = true;
    const pad = indent || (match.match(/^\s*/)?.[0] ?? '');
    return `${match}\n${pad}${lineToAdd.trim()}`;
  });

  if (!found) {
    throw new Error(`Target not found: ${label}`);
  }

  return out;
}

function insertBeforeLine(src, rx, lineToAdd, label) {
  if (src.includes(lineToAdd.trim())) return src;

  let found = false;
  const out = src.replace(rx, (match, indent = '') => {
    if (found) return match;
    found = true;
    const pad = indent || (match.match(/^\s*/)?.[0] ?? '');
    return `${pad}${lineToAdd.trim()}\n${match}`;
  });

  if (!found) {
    throw new Error(`Target not found: ${label}`);
  }

  return out;
}

try {
  // --------------------------------------------------------
  // A) Global central button spring
  // --------------------------------------------------------
  {
    const rel = 'src/components/AnimatedPressable.tsx';
    ensureFile(rel);
    let src = fs.readFileSync(abs(rel), 'utf8');

    if (src.includes("style?: StyleProp<ViewStyle>;")) {
      src = src.replace(
        "  style?: StyleProp<ViewStyle>;",
        "  style?: PressableProps['style'];"
      );

      src = src.replace(
`        style={({ pressed }) => [
          style,
          pressed ? pressedStyle : null,
        ]}`,
`        style={(state) => [
          typeof style === 'function'
            ? style(state)
            : style,
          state.pressed ? pressedStyle : null,
        ]}`
      );

      src = src.replace(
`  type StyleProp,
  type ViewStyle,
`,
''
      );
    }

    save(rel, src);
  }

  {
    const rel = 'src/components/PrimaryButton.tsx';
    ensureFile(rel);
    let src = fs.readFileSync(abs(rel), 'utf8');

    if (!src.includes('<AnimatedPressable')) {
      src = src.replace(
        "import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';",
        "import { ActivityIndicator, StyleSheet, Text } from 'react-native';"
      );

      src = addImport(
        src,
        "import { AnimatedPressable } from './AnimatedPressable';"
      );

      src = src.replace(
        /<Pressable(\s+accessibilityRole="button")/,
        '<AnimatedPressable$1\n      cue={false}'
      );

      src = src.replace(
        /style=\{\(\{ pressed \}\) => \[\s*styles\.button,\s*styles\[variant\],\s*pressed && !isDisabled && styles\.pressed,\s*isDisabled && styles\.disabled,\s*\]\}/m,
`style={[
        styles.button,
        styles[variant],
        isDisabled && styles.disabled,
      ]}
      pressedStyle={!isDisabled ? styles.pressed : undefined}`
      );

      src = src.replace('</Pressable>', '</AnimatedPressable>');

      src = src.replace(
        /pressed:\s*\{\s*opacity:\s*0\.8,\s*transform:\s*\[\{\s*scale:\s*0\.99\s*\}\],\s*\},/m,
`pressed: {
    opacity: 0.86,
  },`
      );
    }

    save(rel, src);
  }

  // --------------------------------------------------------
  // B) CREATE success sounds
  // --------------------------------------------------------
  const createTargets = [
    {
      rel: 'src/screens/BookFormScreen.tsx',
      importLine: "import { createdFeedback } from '../utils/crudFeedback';",
      anchor: /^(\s*)await bookApi\.create\(payload\);$/m,
      after: true,
      label: 'book create',
    },
    {
      rel: 'src/screens/MediaFormScreen.tsx',
      importLine: "import { createdFeedback } from '../utils/crudFeedback';",
      anchor: /^(\s*)const created = await mediaApi\.create\(payload\);$/m,
      after: true,
      label: 'media create',
    },
    {
      rel: 'src/games/screens/GameFormScreen.tsx',
      importLine: "import { createdFeedback } from '../../utils/crudFeedback';",
      anchor: /^(\s*)await gameApi\.create\(payload\);$/m,
      after: true,
      label: 'game create',
    },
    {
      rel: 'src/screens/EntryFormScreen.tsx',
      importLine: "import { createdFeedback } from '../utils/crudFeedback';",
      anchor: /^(\s*)savedEntryId = created\.entryId;$/m,
      after: true,
      label: 'entry create',
    },
    {
      rel: 'src/screens/CollectionsScreen.tsx',
      importLine: "import { createdFeedback } from '../utils/crudFeedback';",
      anchor: /^(\s*)setCollections\(\(current\) =>/m,
      after: false,
      label: 'collection create',
    },
    {
      rel: 'src/screens/TopicListScreen.tsx',
      importLine: "import { createdFeedback } from '../utils/crudFeedback';",
      anchor: /^(\s*)setTopics\(\(current\) =>/m,
      after: false,
      label: 'topic create',
    },
    {
      rel: 'src/screens/MediaSearchScreen.tsx',
      importLine: "import { createdFeedback } from '../utils/crudFeedback';",
      anchor: /^(\s*)const created = await mediaApi\.create\(payload\);$/m,
      after: true,
      label: 'media search create',
    },
  ];

  for (const target of createTargets) {
    ensureFile(target.rel);
    let src = fs.readFileSync(abs(target.rel), 'utf8');

    if (!src.includes('createdFeedback();')) {
      src = addImport(src, target.importLine);
      src = target.after
        ? insertAfterLine(src, target.anchor, 'createdFeedback();', target.label)
        : insertBeforeLine(src, target.anchor, 'createdFeedback();', target.label);
      save(target.rel, src);
    }
  }

  // --------------------------------------------------------
  // C) DELETE success sounds
  // --------------------------------------------------------
  const deleteTargets = [
    {
      rel: 'src/screens/BookDetailsScreen.tsx',
      importLine: "import { deletedFeedback } from '../utils/crudFeedback';",
      anchor: /^(\s*)await bookApi\.remove\(bookId\);$/m,
      label: 'book delete',
    },
    {
      rel: 'src/screens/MediaDetailsScreen.tsx',
      importLine: "import { deletedFeedback } from '../utils/crudFeedback';",
      anchor: /^(\s*)await mediaApi\.remove\(mediaId\);$/m,
      label: 'media delete',
    },
    {
      rel: 'src/games/screens/GameDetailsScreen.tsx',
      importLine: "import { deletedFeedback } from '../../utils/crudFeedback';",
      anchor: /^(\s*)await gameApi\.remove\(gameId\);$/m,
      label: 'game delete',
    },
    {
      rel: 'src/screens/EntryListScreen.tsx',
      importLine: "import { deletedFeedback } from '../utils/crudFeedback';",
      anchor: /^(\s*)await entryApi\.remove\(deleteTarget\.entryId\);$/m,
      label: 'entry delete',
    },
    {
      rel: 'src/screens/CollectionDetailsScreen.tsx',
      importLine: "import { deletedFeedback } from '../utils/crudFeedback';",
      anchor: /^(\s*)await collectionApi\.remove\(collectionId\);$/m,
      label: 'collection delete',
    },
  ];

  for (const target of deleteTargets) {
    ensureFile(target.rel);
    let src = fs.readFileSync(abs(target.rel), 'utf8');

    if (!src.includes('deletedFeedback();')) {
      src = addImport(src, target.importLine);
      src = insertAfterLine(
        src,
        target.anchor,
        'deletedFeedback();',
        target.label
      );
      save(target.rel, src);
    }
  }

  console.log('\nTouched files:');
  for (const rel of touched) {
    console.log(`  ${rel}`);
  }

  if (!runTsc('Post-patch TypeScript check...')) {
    console.error('\nTypeScript failed — restoring every touched file.');
    restore();
    process.exit(1);
  }

  console.log('\n✓ TypeScript clean.');
  console.log('✓ PrimaryButton spring motion active.');
  console.log('✓ Create sound wired after successful main create operations.');
  console.log('✓ Delete sound wired after successful main delete operations.');
  console.log('✓ Jingle sound + shake untouched.');
  console.log('✓ Global screen transition untouched.');
} catch (error) {
  console.error(`\nSAFE STOP: ${error.message}`);
  restore();
  process.exit(1);
}
