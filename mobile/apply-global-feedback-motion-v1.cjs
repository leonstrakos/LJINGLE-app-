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

function file(rel) {
  return path.join(root, rel);
}

function save(rel, next) {
  const target = file(rel);
  if (!fs.existsSync(target)) {
    throw new Error(`Missing file: ${rel}`);
  }
  const prev = fs.readFileSync(target, 'utf8');
  if (prev === next) return false;

  const backup = `${target}.before-global-feedback-motion-${stamp}.bak`;
  fs.copyFileSync(target, backup);
  backups.push([target, backup]);
  fs.writeFileSync(target, next, 'utf8');
  touched.push(rel);
  return true;
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
    throw new Error(`No import block found for ${importLine}`);
  }

  const last = imports[imports.length - 1];
  const at = last.index + last[0].length;
  return src.slice(0, at) + '\n' + importLine + src.slice(at);
}

function replaceOnce(src, oldText, newText, label) {
  if (!src.includes(oldText)) {
    throw new Error(`Target not found: ${label}`);
  }
  return src.replace(oldText, newText);
}

try {
  // ----------------------------------------------------------
  // 1) AnimatedPressable: support normal Pressable style callbacks.
  // ----------------------------------------------------------
  {
    const rel = 'src/components/AnimatedPressable.tsx';
    let src = fs.readFileSync(file(rel), 'utf8');

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

    // Remove now-unused style imports only if present.
    src = src.replace(
`  type StyleProp,
  type ViewStyle,
`,
''
    );

    save(rel, src);
  }

  // ----------------------------------------------------------
  // 2) PrimaryButton: real spring press motion, no generic sound.
  // ----------------------------------------------------------
  {
    const rel = 'src/components/PrimaryButton.tsx';
    let src = fs.readFileSync(file(rel), 'utf8');

    src = src.replace(
      "import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';",
      "import { ActivityIndicator, StyleSheet, Text } from 'react-native';"
    );

    src = addImport(
      src,
      "import { AnimatedPressable } from './AnimatedPressable';"
    );

    src = replaceOnce(
      src,
      '    <Pressable\n      accessibilityRole="button"',
      '    <AnimatedPressable\n      accessibilityRole="button"\n      cue={false}',
      'PrimaryButton opening tag'
    );

    src = src.replace(
`      style={({ pressed }) => [
        styles.button,
        styles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}`,
`      style={[
        styles.button,
        styles[variant],
        isDisabled && styles.disabled,
      ]}
      pressedStyle={!isDisabled ? styles.pressed : undefined}`
    );

    src = replaceOnce(
      src,
      '    </Pressable>',
      '    </AnimatedPressable>',
      'PrimaryButton closing tag'
    );

    src = src.replace(
`  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },`,
`  pressed: {
    opacity: 0.86,
  },`
    );

    save(rel, src);
  }

  // ----------------------------------------------------------
  // Helper patches for successful CREATE events.
  // ----------------------------------------------------------
  const createPatches = [
    {
      rel: 'src/screens/BookFormScreen.tsx',
      importLine: "import { createdFeedback } from '../utils/crudFeedback';",
      oldText: `      } else {
        await bookApi.create(payload);
      }`,
      newText: `      } else {
        await bookApi.create(payload);
        createdFeedback();
      }`,
      label: 'book create',
    },
    {
      rel: 'src/screens/MediaFormScreen.tsx',
      importLine: "import { createdFeedback } from '../utils/crudFeedback';",
      oldText: `      } else {
        const created = await mediaApi.create(payload);
        navigation.replace('MediaDetails', { mediaId: created.mediaId });
      }`,
      newText: `      } else {
        const created = await mediaApi.create(payload);
        createdFeedback();
        navigation.replace('MediaDetails', { mediaId: created.mediaId });
      }`,
      label: 'media create',
    },
    {
      rel: 'src/games/screens/GameFormScreen.tsx',
      importLine: "import { createdFeedback } from '../../utils/crudFeedback';",
      oldText: `      } else {
        await gameApi.create(payload);
      }`,
      newText: `      } else {
        await gameApi.create(payload);
        createdFeedback();
      }`,
      label: 'game create',
    },
    {
      rel: 'src/screens/EntryFormScreen.tsx',
      importLine: "import { createdFeedback } from '../utils/crudFeedback';",
      oldText: `      } else {
        const created = await entryApi.create(payload);
        savedEntryId = created.entryId;
      }`,
      newText: `      } else {
        const created = await entryApi.create(payload);
        savedEntryId = created.entryId;
        createdFeedback();
      }`,
      label: 'entry create',
    },
    {
      rel: 'src/screens/CollectionsScreen.tsx',
      importLine: "import { createdFeedback } from '../utils/crudFeedback';",
      oldText: `      const created = await collectionApi.create({
        name: name.trim(),
        description: description.trim() || null,
        symbol: symbol.trim() || '◇',
      });`,
      newText: `      const created = await collectionApi.create({
        name: name.trim(),
        description: description.trim() || null,
        symbol: symbol.trim() || '◇',
      });
      createdFeedback();`,
      label: 'collection create',
    },
    {
      rel: 'src/screens/TopicListScreen.tsx',
      importLine: "import { createdFeedback } from '../utils/crudFeedback';",
      oldText: `      const created = await topicApi.create({
        name: trimmedName,
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
      });`,
      newText: `      const created = await topicApi.create({
        name: trimmedName,
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
      });
      createdFeedback();`,
      label: 'topic create',
    },
    {
      rel: 'src/screens/MediaSearchScreen.tsx',
      importLine: "import { createdFeedback } from '../utils/crudFeedback';",
      oldText: `      const created = await mediaApi.create(payload);
      navigation.replace('MediaDetails', { mediaId: created.mediaId });`,
      newText: `      const created = await mediaApi.create(payload);
      createdFeedback();
      navigation.replace('MediaDetails', { mediaId: created.mediaId });`,
      label: 'media search create',
    },
  ];

  for (const patch of createPatches) {
    let src = fs.readFileSync(file(patch.rel), 'utf8');

    if (!src.includes('createdFeedback();')) {
      src = addImport(src, patch.importLine);
      src = replaceOnce(
        src,
        patch.oldText,
        patch.newText,
        patch.label
      );
      save(patch.rel, src);
    }
  }

  // ----------------------------------------------------------
  // Successful DELETE events.
  // ----------------------------------------------------------
  const deletePatches = [
    {
      rel: 'src/screens/BookDetailsScreen.tsx',
      importLine: "import { deletedFeedback } from '../utils/crudFeedback';",
      oldText: `      await bookApi.remove(bookId);
      await deleteCatalogueCoverOverride('BOOK', bookId).catch(() => undefined);`,
      newText: `      await bookApi.remove(bookId);
      deletedFeedback();
      await deleteCatalogueCoverOverride('BOOK', bookId).catch(() => undefined);`,
      label: 'book delete',
    },
    {
      rel: 'src/screens/MediaDetailsScreen.tsx',
      importLine: "import { deletedFeedback } from '../utils/crudFeedback';",
      oldText: `      await mediaApi.remove(mediaId);
      // mediaDetailsCoverNullGuardV1`,
      newText: `      await mediaApi.remove(mediaId);
      deletedFeedback();
      // mediaDetailsCoverNullGuardV1`,
      label: 'media delete',
    },
    {
      rel: 'src/games/screens/GameDetailsScreen.tsx',
      importLine: "import { deletedFeedback } from '../../utils/crudFeedback';",
      oldText: `      await gameApi.remove(gameId);
      await deleteCatalogueCoverOverride('GAME', gameId).catch(() => undefined);`,
      newText: `      await gameApi.remove(gameId);
      deletedFeedback();
      await deleteCatalogueCoverOverride('GAME', gameId).catch(() => undefined);`,
      label: 'game delete',
    },
    {
      rel: 'src/screens/EntryListScreen.tsx',
      importLine: "import { deletedFeedback } from '../utils/crudFeedback';",
      oldText: `      await entryApi.remove(deleteTarget.entryId);
      setEntries((current) =>`,
      newText: `      await entryApi.remove(deleteTarget.entryId);
      deletedFeedback();
      setEntries((current) =>`,
      label: 'entry delete',
    },
    {
      rel: 'src/screens/CollectionDetailsScreen.tsx',
      importLine: "import { deletedFeedback } from '../utils/crudFeedback';",
      oldText: `      await collectionApi.remove(collectionId);
      navigation.goBack();`,
      newText: `      await collectionApi.remove(collectionId);
      deletedFeedback();
      navigation.goBack();`,
      label: 'collection delete',
    },
  ];

  for (const patch of deletePatches) {
    let src = fs.readFileSync(file(patch.rel), 'utf8');

    if (!src.includes('deletedFeedback();')) {
      src = addImport(src, patch.importLine);
      src = replaceOnce(
        src,
        patch.oldText,
        patch.newText,
        patch.label
      );
      save(patch.rel, src);
    }
  }

  console.log('\nTouched files:');
  for (const rel of touched) {
    console.log(`  ${rel}`);
  }

  if (!runTsc('Post-patch TypeScript check...')) {
    console.error('\nTypeScript failed — restoring all touched files.');
    restore();
    process.exit(1);
  }

  console.log('\n✓ TypeScript clean.');
  console.log('✓ PrimaryButton now has real spring press motion.');
  console.log('✓ Create sound fires only after successful creates in main CRUD flows.');
  console.log('✓ Delete sound fires only after successful deletes in main CRUD flows.');
  console.log('✓ Existing Jingle sound + shake remains untouched.');
  console.log('✓ Existing global screen transition remains untouched.');
  console.log('✓ Existing timer start/stop semantic feedback remains untouched.');
} catch (error) {
  console.error(`\nSAFE STOP: ${error.message}`);
  restore();
  process.exit(1);
}
