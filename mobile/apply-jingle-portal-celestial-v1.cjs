const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = process.cwd();

const existingTargets = [
  'App.tsx',
  'src/audio/uiFeedback.ts',
  'src/screens/BookListScreen.tsx',
  'src/screens/EntryListScreen.tsx',
  'src/screens/MediaListScreen.tsx',
  'src/games/screens/GameListScreen.tsx',
  'src/screens/TopicListScreen.tsx',
  'src/screens/CatalogueHomeScreen.tsx',
].filter((rel) => fs.existsSync(path.join(root, rel)));

const createdTargets = [
  'src/components/CelestialAtmosphere.tsx',
  'src/components/JinglePortalButton.tsx',
];

function runTsc() {
  const r = process.platform === 'win32'
    ? cp.spawnSync('cmd.exe', ['/d', '/s', '/c', 'npx tsc --noEmit'], {
        cwd: root,
        encoding: 'utf8',
      })
    : cp.spawnSync('npx', ['tsc', '--noEmit'], {
        cwd: root,
        encoding: 'utf8',
      });

  return {
    status: r.status ?? 1,
    text: `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(/\r\n/g, '\n').trim(),
  };
}

function norm(text) {
  return text
    .replace(/Found \d+ errors?.*$/gm, '')
    .replace(/\r/g, '')
    .trim();
}

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function insertImport(src, importLine) {
  if (src.includes(importLine)) return src;

  const lines = src.split(/\r?\n/);
  let lastImport = -1;

  for (let i = 0; i < lines.length; i += 1) {
    if (/^import\b/.test(lines[i])) lastImport = i;
  }

  if (lastImport < 0) {
    throw new Error('Could not locate import block.');
  }

  lines.splice(lastImport + 1, 0, importLine);
  return lines.join('\n');
}

function addAtmosphere(src, variant) {
  if (src.includes(`<CelestialAtmosphere variant="${variant}"`)) return src;

  const safeAreaOpen =
    /(<SafeAreaView\b[^>]*>\s*)/m;

  if (!safeAreaOpen.test(src)) {
    throw new Error(`Could not locate SafeAreaView for ${variant}.`);
  }

  return src.replace(
    safeAreaOpen,
    `$1<CelestialAtmosphere variant="${variant}" />\n      `
  );
}

console.log('Capturing current TypeScript baseline...');
const before = runTsc();

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const recoveryRoot = path.join(
  root,
  '..',
  '_recovery',
  `jingle-portal-celestial-${stamp}`,
);

fs.mkdirSync(recoveryRoot, { recursive: true });

const backups = new Map();
for (const rel of existingTargets) {
  const src = path.join(root, rel);
  const dst = path.join(recoveryRoot, rel);
  ensureDir(dst);
  fs.copyFileSync(src, dst);
  backups.set(rel, dst);
}

const preExistingCreated = new Map();
for (const rel of createdTargets) {
  const file = path.join(root, rel);
  if (fs.existsSync(file)) {
    const dst = path.join(recoveryRoot, rel);
    ensureDir(dst);
    fs.copyFileSync(file, dst);
    preExistingCreated.set(rel, dst);
  }
}

function restore() {
  for (const [rel, backup] of backups) {
    fs.copyFileSync(backup, path.join(root, rel));
  }

  for (const rel of createdTargets) {
    const file = path.join(root, rel);
    if (preExistingCreated.has(rel)) {
      fs.copyFileSync(preExistingCreated.get(rel), file);
    } else if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
}

try {
  // -----------------------------------------------------------------------
  // Re-enable user-triggered web sounds while still suppressing app-open
  // autoplay. This keeps the bell audible when clicked in the web preview.
  // -----------------------------------------------------------------------
  {
    const rel = 'src/audio/uiFeedback.ts';
    const file = path.join(root, rel);
    let src = fs.readFileSync(file, 'utf8');

    src = src.replace(
      `if (Platform.OS === 'web') return;`,
      `if (Platform.OS === 'web' && cue === 'open') return;`
    );

    fs.writeFileSync(file, src, 'utf8');
    console.log('  ✓ user-triggered Jingle audio allowed on web');
  }

  // -----------------------------------------------------------------------
  // Reusable celestial/dither atmosphere.
  // -----------------------------------------------------------------------
  {
    const rel = 'src/components/CelestialAtmosphere.tsx';
    const file = path.join(root, rel);
    ensureDir(file);

    const content = `import { StyleSheet, Text, View } from 'react-native';

type Variant =
  | 'books'
  | 'entries'
  | 'media'
  | 'games'
  | 'topics'
  | 'catalogue';

type Props = {
  variant?: Variant;
};

type Star = {
  left: string;
  top: number;
  glyph: '✦' | '✧' | '·';
  size: number;
  opacity: number;
};

const starsByVariant: Record<Variant, Star[]> = {
  books: [
    { left: '5%', top: 34, glyph: '✦', size: 16, opacity: 0.74 },
    { left: '15%', top: 76, glyph: '·', size: 18, opacity: 0.42 },
    { left: '25%', top: 28, glyph: '✧', size: 13, opacity: 0.52 },
    { left: '39%', top: 61, glyph: '✦', size: 10, opacity: 0.44 },
    { left: '51%', top: 24, glyph: '·', size: 18, opacity: 0.4 },
    { left: '63%', top: 70, glyph: '✧', size: 13, opacity: 0.5 },
    { left: '76%', top: 31, glyph: '✦', size: 15, opacity: 0.66 },
    { left: '90%', top: 80, glyph: '·', size: 18, opacity: 0.4 },
  ],
  entries: [
    { left: '7%', top: 48, glyph: '✧', size: 15, opacity: 0.65 },
    { left: '18%', top: 24, glyph: '·', size: 16, opacity: 0.38 },
    { left: '31%', top: 71, glyph: '✦', size: 11, opacity: 0.45 },
    { left: '45%', top: 35, glyph: '·', size: 18, opacity: 0.4 },
    { left: '59%', top: 78, glyph: '✧', size: 14, opacity: 0.52 },
    { left: '72%', top: 25, glyph: '✦', size: 13, opacity: 0.6 },
    { left: '87%', top: 59, glyph: '·', size: 18, opacity: 0.42 },
  ],
  media: [
    { left: '8%', top: 31, glyph: '✦', size: 13, opacity: 0.58 },
    { left: '21%', top: 72, glyph: '·', size: 18, opacity: 0.36 },
    { left: '35%', top: 40, glyph: '✧', size: 12, opacity: 0.48 },
    { left: '49%', top: 80, glyph: '·', size: 18, opacity: 0.38 },
    { left: '64%', top: 27, glyph: '✦', size: 14, opacity: 0.58 },
    { left: '81%', top: 66, glyph: '✧', size: 12, opacity: 0.48 },
    { left: '92%', top: 29, glyph: '·', size: 18, opacity: 0.38 },
  ],
  games: [
    { left: '6%', top: 70, glyph: '·', size: 17, opacity: 0.38 },
    { left: '19%', top: 26, glyph: '✧', size: 14, opacity: 0.5 },
    { left: '34%', top: 61, glyph: '✦', size: 12, opacity: 0.53 },
    { left: '48%', top: 28, glyph: '·', size: 18, opacity: 0.36 },
    { left: '62%', top: 74, glyph: '✧', size: 13, opacity: 0.46 },
    { left: '77%', top: 35, glyph: '✦', size: 14, opacity: 0.58 },
    { left: '91%', top: 67, glyph: '·', size: 18, opacity: 0.38 },
  ],
  topics: [
    { left: '7%', top: 33, glyph: '✦', size: 13, opacity: 0.56 },
    { left: '20%', top: 74, glyph: '·', size: 17, opacity: 0.38 },
    { left: '35%', top: 29, glyph: '✧', size: 13, opacity: 0.49 },
    { left: '50%', top: 67, glyph: '✦', size: 11, opacity: 0.46 },
    { left: '65%', top: 25, glyph: '·', size: 18, opacity: 0.36 },
    { left: '78%', top: 71, glyph: '✧', size: 13, opacity: 0.5 },
    { left: '91%', top: 32, glyph: '✦', size: 12, opacity: 0.5 },
  ],
  catalogue: [
    { left: '6%', top: 30, glyph: '✦', size: 15, opacity: 0.64 },
    { left: '18%', top: 75, glyph: '·', size: 18, opacity: 0.38 },
    { left: '32%', top: 38, glyph: '✧', size: 13, opacity: 0.48 },
    { left: '48%', top: 74, glyph: '·', size: 18, opacity: 0.36 },
    { left: '62%', top: 28, glyph: '✦', size: 14, opacity: 0.58 },
    { left: '77%', top: 70, glyph: '✧', size: 13, opacity: 0.48 },
    { left: '91%', top: 36, glyph: '·', size: 18, opacity: 0.4 },
  ],
};

const ditherRows = [
  { top: 0, opacity: 0.18, step: 18 },
  { top: 12, opacity: 0.14, step: 22 },
  { top: 27, opacity: 0.11, step: 28 },
  { top: 45, opacity: 0.08, step: 34 },
  { top: 66, opacity: 0.055, step: 42 },
  { top: 90, opacity: 0.035, step: 54 },
];

export function CelestialAtmosphere({
  variant = 'catalogue',
}: Props) {
  const stars = starsByVariant[variant];

  return (
    <View style={styles.root}>
      <View style={styles.blueWash} />
      <View style={styles.goldWash} />

      {ditherRows.map((row, rowIndex) => (
        <View key={row.top} style={[styles.ditherRow, { top: row.top }]}>
          {Array.from({ length: Math.ceil(420 / row.step) }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  left: index * row.step + ((rowIndex % 2) * row.step) / 2,
                  opacity: row.opacity,
                },
              ]}
            />
          ))}
        </View>
      ))}

      {stars.map((star, index) => (
        <Text
          key={index}
          style={[
            styles.star,
            {
              left: star.left,
              top: star.top,
              fontSize: star.size,
              opacity: star.opacity,
            },
          ]}
        >
          {star.glyph}
        </Text>
      ))}

      <View style={[styles.thread, styles.threadOne]} />
      <View style={[styles.thread, styles.threadTwo]} />
      <View style={[styles.thread, styles.threadThree]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    height: 180,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  blueWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 112,
    backgroundColor: 'rgba(46, 103, 196, 0.055)',
  },
  goldWash: {
    position: 'absolute',
    top: 0,
    left: '35%',
    right: '10%',
    height: 96,
    backgroundColor: 'rgba(214, 157, 34, 0.035)',
  },
  ditherRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
  },
  dot: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#1647A8',
  },
  star: {
    position: 'absolute',
    color: '#D89B1D',
    lineHeight: 19,
  },
  thread: {
    position: 'absolute',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(216, 155, 29, 0.18)',
    transformOrigin: 'left center',
  },
  threadOne: {
    width: 76,
    left: '12%',
    top: 56,
    transform: [{ rotate: '-18deg' }],
  },
  threadTwo: {
    width: 88,
    right: '13%',
    top: 52,
    transform: [{ rotate: '21deg' }],
  },
  threadThree: {
    width: 52,
    left: '58%',
    top: 82,
    transform: [{ rotate: '-9deg' }],
  },
});
`;

    fs.writeFileSync(file, content, 'utf8');
    console.log('  ✓ CelestialAtmosphere added');
  }

  // -----------------------------------------------------------------------
  // Floating Jingle orb: the only persistent global navigation chrome.
  // Tap rings and opens the existing Command Palette.
  // -----------------------------------------------------------------------
  {
    const rel = 'src/components/JinglePortalButton.tsx';
    const file = path.join(root, rel);
    ensureDir(file);

    const content = `import { useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { playUiCue } from '../audio/uiFeedback';
import { JingleBellIcon } from './JingleBellIcon';

type Props = {
  onOpen: () => void;
};

export function JinglePortalButton({ onOpen }: Props) {
  const ring = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const animateRing = () => {
    ring.stopAnimation();
    scale.stopAnimation();

    Animated.parallel([
      Animated.sequence([
        Animated.timing(ring, {
          toValue: -1,
          duration: 70,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(ring, {
          toValue: 1,
          duration: 90,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(ring, {
          toValue: -0.55,
          duration: 80,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(ring, {
          toValue: 0,
          speed: 18,
          bounciness: 7,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 0.93,
          speed: 26,
          bounciness: 4,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(scale, {
          toValue: 1,
          speed: 19,
          bounciness: 9,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    ]).start();
  };

  const activate = () => {
    animateRing();
    void playUiCue('jingle');
    onOpen();
  };

  const rotate = ring.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  return (
    <View style={styles.anchor}>
      <View style={styles.halo} />
      <Text style={[styles.spark, styles.sparkLeft]}>✦</Text>
      <Text style={[styles.spark, styles.sparkTop]}>·</Text>
      <Text style={[styles.spark, styles.sparkRight]}>✧</Text>

      <Pressable
        accessibilityLabel="Otvori Jingle"
        accessibilityRole="button"
        hitSlop={12}
        onLongPress={activate}
        onPress={activate}
        delayLongPress={420}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        <Animated.View
          style={[
            styles.bellWrap,
            {
              transform: [{ rotate }, { scale }],
            },
          ]}
        >
          <JingleBellIcon
            active
            inactiveOpacity={1}
            style={styles.bell}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: '50%',
    bottom: 18,
    width: 84,
    height: 84,
    marginLeft: -42,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 85,
  },
  halo: {
    position: 'absolute',
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(5, 50, 126, 0.10)',
  },
  button: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#063991',
    borderWidth: 1,
    borderColor: 'rgba(230, 180, 63, 0.72)',
    shadowColor: '#061C4B',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 10,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  bellWrap: {
    width: 50,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bell: {
    width: 48,
    height: 54,
  },
  spark: {
    position: 'absolute',
    color: '#DDA01E',
    fontSize: 12,
  },
  sparkLeft: {
    left: 0,
    top: 27,
  },
  sparkTop: {
    top: -2,
    left: 41,
    fontSize: 17,
  },
  sparkRight: {
    right: -1,
    top: 24,
  },
});
`;

    fs.writeFileSync(file, content, 'utf8');
    console.log('  ✓ JinglePortalButton added');
  }

  // -----------------------------------------------------------------------
  // App: global floating Jingle -> existing Command Palette.
  // No bottom navigation is added.
  // -----------------------------------------------------------------------
  {
    const rel = 'App.tsx';
    const file = path.join(root, rel);
    let src = fs.readFileSync(file, 'utf8');

    src = insertImport(
      src,
      `import { JinglePortalButton } from './src/components/JinglePortalButton';`
    );

    if (!src.includes('<JinglePortalButton')) {
      const paletteAnchor = `      <CommandPalette
        navigation={navigationRef}
        openSignal={paletteOpenSignal}
      />`;

      if (!src.includes(paletteAnchor)) {
        throw new Error('App CommandPalette anchor not found.');
      }

      src = src.replace(
        paletteAnchor,
        `${paletteAnchor}

      <JinglePortalButton
        onOpen={() => {
          setPaletteOpenSignal((current) => current + 1);
        }}
      />`
      );
    }

    fs.writeFileSync(file, src, 'utf8');
    console.log('  ✓ App uses one floating Jingle portal');
  }

  // -----------------------------------------------------------------------
  // Add the same celestial language to the main catalogue/research screens.
  // -----------------------------------------------------------------------
  const screenVariants = [
    ['src/screens/BookListScreen.tsx', 'books'],
    ['src/screens/EntryListScreen.tsx', 'entries'],
    ['src/screens/MediaListScreen.tsx', 'media'],
    ['src/games/screens/GameListScreen.tsx', 'games'],
    ['src/screens/TopicListScreen.tsx', 'topics'],
    ['src/screens/CatalogueHomeScreen.tsx', 'catalogue'],
  ];

  for (const [rel, variant] of screenVariants) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) {
      console.log(`  • skipped ${rel} (not present)`);
      continue;
    }

    let src = fs.readFileSync(file, 'utf8');

    src = insertImport(
      src,
      `import { CelestialAtmosphere } from '../components/CelestialAtmosphere';`
        .replace(
          `'../components`,
          rel.startsWith('src/games/') ? `'../../components` : `'../components`
        )
    );

    src = addAtmosphere(src, variant);

    fs.writeFileSync(file, src, 'utf8');
    console.log(`  ✓ ${variant} atmosphere`);
  }

  console.log('\nChecking TypeScript against baseline...');
  const after = runTsc();

  if (after.status !== 0 && norm(after.text) !== norm(before.text)) {
    console.error('\nNEW TypeScript diagnostics detected — restoring this entire patch.');
    console.error('\n--- New TypeScript output ---\n');
    console.error(after.text);
    restore();
    process.exit(1);
  }

  console.log('\n✓ Jingle portal + celestial visual system applied.');
  console.log('✓ No bottom navigation added.');
  console.log('✓ Floating Jingle is the persistent global control.');
  console.log('✓ Tap/long-press rings the bell and opens the existing Command Palette.');
  console.log('✓ User-triggered Jingle sound works on web; app-open autoplay stays suppressed.');
  console.log('✓ Books / Entries / Media / Games / Topics / Catalogue share deterministic stars + dither.');
  console.log('✓ No random star reshuffling between renders.');
  console.log('BACKUP: ' + recoveryRoot);

  if (after.status === 0) {
    console.log('TYPESCRIPT CLEAN ✓');
  } else {
    console.log('No new TypeScript diagnostics; existing baseline unchanged.');
  }
} catch (error) {
  restore();
  console.error('\nSAFE STOP: ' + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
