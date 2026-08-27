const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = process.cwd();

const targets = {
  entrance: 'src/components/CardEntranceView.tsx',
  book: 'src/components/BookCard.tsx',
  media: 'src/components/MediaCard.tsx',
  game: 'src/games/components/GameCard.tsx',
  recent: 'src/components/RecentActivityCard.tsx',
  active: 'src/components/ActiveTimerCard.tsx',
  topic: 'src/components/TopicActivityCard.tsx',
  modal: 'src/components/DeleteConfirmationModal.tsx',
};

function abs(rel) {
  return path.join(root, rel);
}

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
  console.error('\nSAFE STOP: project is not TypeScript-clean. Nothing changed.');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backups = [];
const created = [];

function save(rel, next) {
  const file = abs(rel);

  if (fs.existsSync(file)) {
    const prev = fs.readFileSync(file, 'utf8');
    if (prev === next) return;

    const backup = `${file}.before-card-motion-${stamp}.bak`;
    fs.copyFileSync(file, backup);
    backups.push([file, backup]);
  } else {
    created.push(file);
  }

  fs.writeFileSync(file, next, 'utf8');
  console.log(`  ${rel}`);
}

function restore() {
  for (const file of created) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  for (const [file, backup] of backups.reverse()) {
    if (fs.existsSync(backup)) fs.copyFileSync(backup, file);
  }
}

function addImport(src, line) {
  if (src.includes(line)) return src;
  const imports = [...src.matchAll(/^import .*?;$/gm)];
  if (!imports.length) throw new Error(`Could not find imports for ${line}`);
  const last = imports[imports.length - 1];
  const at = last.index + last[0].length;
  return src.slice(0, at) + '\n' + line + src.slice(at);
}

function wrapReturnPressable(src, openTagPattern, label) {
  if (src.includes('CardEntranceView')) return src;

  const returnStart = src.indexOf('  return (');
  if (returnStart < 0) throw new Error(`Return not found: ${label}`);

  const openIdx = src.indexOf(openTagPattern, returnStart);
  if (openIdx < 0) throw new Error(`Open tag not found: ${label}`);

  const closeNeedle = '\n    </Pressable>\n  );';
  const closeIdx = src.indexOf(closeNeedle, openIdx);
  if (closeIdx < 0) throw new Error(`Close Pressable not found: ${label}`);

  src = src.slice(0, openIdx) +
    '    <CardEntranceView>\n' +
    src.slice(openIdx, closeIdx + '\n    </Pressable>'.length) +
    '\n    </CardEntranceView>' +
    src.slice(closeIdx + '\n    </Pressable>'.length);

  return src;
}

try {
  // Reusable entrance wrapper. Mount-only, not tied to scroll position.
  const entrance = `import { type ReactNode, useEffect, useRef } from 'react';
import { Animated } from 'react-native';

import { semanticTiming } from '../utils/semanticMotion';
import { useReducedMotion } from '../utils/useReducedMotion';

type Props = {
  children: ReactNode;
  distance?: number;
};

// cardEntranceV1
// Small one-time entrance when the component mounts.
// No scroll listeners, no layout animation, transform + opacity only.
export function CardEntranceView({ children, distance = 8 }: Props) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reducedMotion ? 0 : distance)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: semanticTiming.enter.duration,
        easing: semanticTiming.enter.easing,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: semanticTiming.enter.duration,
        easing: semanticTiming.enter.easing,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, reducedMotion, translateY]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
      }}
    >
      {children}
    </Animated.View>
  );
}
`;
  save(targets.entrance, entrance);

  // Book
  {
    let src = fs.readFileSync(abs(targets.book), 'utf8');
    src = addImport(src, "import { CardEntranceView } from './CardEntranceView';");
    if (!src.includes('<CardEntranceView>')) {
      src = wrapReturnPressable(src, '    <Pressable', 'book card');
    }
    save(targets.book, src);
  }

  // Media
  {
    let src = fs.readFileSync(abs(targets.media), 'utf8');
    src = addImport(src, "import { CardEntranceView } from './CardEntranceView';");
    if (!src.includes('<CardEntranceView>')) {
      src = wrapReturnPressable(src, '    <Pressable', 'media card');
    }
    save(targets.media, src);
  }

  // Game
  {
    let src = fs.readFileSync(abs(targets.game), 'utf8');
    src = addImport(src, "import { CardEntranceView } from '../../components/CardEntranceView';");
    if (!src.includes('<CardEntranceView>')) {
      src = wrapReturnPressable(src, '    <Pressable', 'game card');
    }
    save(targets.game, src);
  }

  // Recent activity: preserve existing swipe Animated.View and only fade/settle the whole thing.
  {
    let src = fs.readFileSync(abs(targets.recent), 'utf8');
    src = addImport(src, "import { CardEntranceView } from './CardEntranceView';");

    if (!src.includes('<CardEntranceView>')) {
      const oldOpen = '  return (\n    <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>';
      const oldClose = '    </Animated.View>\n  );';

      if (!src.includes(oldOpen) || !src.includes(oldClose)) {
        throw new Error('Target not found: recent activity wrapper');
      }

      src = src.replace(
        oldOpen,
        '  return (\n    <CardEntranceView distance={6}>\n      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>'
      );

      const last = src.lastIndexOf(oldClose);
      src = src.slice(0, last) +
        '      </Animated.View>\n    </CardEntranceView>\n  );' +
        src.slice(last + oldClose.length);
    }

    save(targets.recent, src);
  }

  // Active timer card: mount settle only. No extra timer-state animation here.
  {
    let src = fs.readFileSync(abs(targets.active), 'utf8');
    src = addImport(src, "import { CardEntranceView } from './CardEntranceView';");

    if (!src.includes('<CardEntranceView')) {
      const open = '  return (\n    <View style={styles.card}>';
      const close = '    </View>\n  );';

      if (!src.includes(open) || !src.includes(close)) {
        throw new Error('Target not found: active timer card');
      }

      src = src.replace(
        open,
        '  return (\n    <CardEntranceView distance={6}>\n      <View style={styles.card}>'
      );

      const last = src.lastIndexOf(close);
      src = src.slice(0, last) +
        '      </View>\n    </CardEntranceView>\n  );' +
        src.slice(last + close.length);
    }

    save(targets.active, src);
  }

  // Topic activity card
  {
    let src = fs.readFileSync(abs(targets.topic), 'utf8');
    src = addImport(src, "import { CardEntranceView } from './CardEntranceView';");

    if (!src.includes('<CardEntranceView')) {
      const open = '  return (\n    <View style={[styles.card, running && styles.cardRunning]}>';
      const close = '    </View>\n  );';

      if (!src.includes(open) || !src.includes(close)) {
        throw new Error('Target not found: topic activity card');
      }

      src = src.replace(
        open,
        '  return (\n    <CardEntranceView distance={6}>\n      <View style={[styles.card, running && styles.cardRunning]}>'
      );

      const last = src.lastIndexOf(close);
      src = src.slice(0, last) +
        '      </View>\n    </CardEntranceView>\n  );' +
        src.slice(last + close.length);
    }

    save(targets.topic, src);
  }

  // Delete modal: keep RN modal fade and add subtle dialog settle.
  {
    let src = fs.readFileSync(abs(targets.modal), 'utf8');
    src = addImport(src, "import { CardEntranceView } from './CardEntranceView';");

    if (!src.includes('<CardEntranceView distance={10}>')) {
      const open = '      <View style={styles.backdrop}>\n        <View accessibilityLabel={accessibilityLabel ?? dialogTitle} accessibilityRole="alert" style={styles.dialog}>';
      const close = '        </View>\n      </View>';

      if (!src.includes(open) || !src.includes(close)) {
        throw new Error('Target not found: delete modal dialog');
      }

      src = src.replace(
        open,
        '      <View style={styles.backdrop}>\n        <CardEntranceView distance={10}>\n          <View accessibilityLabel={accessibilityLabel ?? dialogTitle} accessibilityRole="alert" style={styles.dialog}>'
      );

      const idx = src.indexOf(close, src.indexOf('<CardEntranceView distance={10}>'));
      if (idx < 0) throw new Error('Target not found: delete modal closing');

      src = src.slice(0, idx) +
        '          </View>\n        </CardEntranceView>\n      </View>' +
        src.slice(idx + close.length);
    }

    save(targets.modal, src);
  }

  if (!runTsc('Post-patch TypeScript check...')) {
    console.error('\nTypeScript failed — restoring all touched files.');
    restore();
    process.exit(1);
  }

  console.log('\n✓ TypeScript clean.');
  console.log('✓ Book / Media / Game cards get a subtle one-time entrance.');
  console.log('✓ Recent activity, active timer and topic activity cards get the same gentle settle.');
  console.log('✓ Delete confirmation dialog gets a small settle on top of its existing fade.');
  console.log('✓ No scroll listeners, no parallax, no layout animation.');
  console.log('✓ Reduce Motion respected.');
  console.log('✓ Existing swipe/timer motion remains intact.');
} catch (error) {
  console.error(`\nSAFE STOP: ${error.message}`);
  restore();
  process.exit(1);
}
