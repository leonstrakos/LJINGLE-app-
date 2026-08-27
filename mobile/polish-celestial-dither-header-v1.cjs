const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = process.cwd();
const rel = 'src/components/CelestialAtmosphere.tsx';
const file = path.join(root, rel);

if (!fs.existsSync(file)) {
  console.error('SAFE STOP: missing ' + rel);
  process.exit(1);
}

function runTsc() {
  const r =
    process.platform === 'win32'
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
    text: `${r.stdout ?? ''}${r.stderr ?? ''}`
      .replace(/\r\n/g, '\n')
      .trim(),
  };
}

function diagnostics(text) {
  return new Set(
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) =>
        /(?:^|[\\/])[^:()]+\.\w+\(\d+,\d+\): error TS\d+:/.test(line),
      ),
  );
}

function newDiagnostics(before, after) {
  const oldSet = diagnostics(before);
  return [...diagnostics(after)].filter((line) => !oldSet.has(line));
}

console.log('Capturing TypeScript baseline...');
const before = runTsc();

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupRoot = path.join(
  root,
  '..',
  '_recovery',
  `celestial-dither-polish-${stamp}`,
);
const backup = path.join(backupRoot, rel);

fs.mkdirSync(path.dirname(backup), { recursive: true });
fs.copyFileSync(file, backup);

try {
  const next = `import { StyleSheet, Text, View } from 'react-native';

import { activeVisualSkinId } from '../theme/visualSkins';

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
  left: \`\${number}%\`;
  top: number;
  glyph: '✦' | '✧' | '·';
  size: number;
  opacity: number;
};

type Thread = {
  left: \`\${number}%\`;
  top: number;
  width: number;
  rotate: \`\${number}deg\`;
  opacity: number;
};

const GOLD = '#D69A20';
const BLUE = '#2A61B3';

const starFields: Record<Variant, Star[]> = {
  books: [
    { left: '4%', top: 12, glyph: '✦', size: 13, opacity: 0.72 },
    { left: '16%', top: 43, glyph: '·', size: 14, opacity: 0.34 },
    { left: '31%', top: 21, glyph: '✧', size: 11, opacity: 0.50 },
    { left: '49%', top: 55, glyph: '·', size: 13, opacity: 0.28 },
    { left: '67%', top: 17, glyph: '✦', size: 10, opacity: 0.48 },
    { left: '82%', top: 47, glyph: '✧', size: 10, opacity: 0.43 },
    { left: '94%', top: 14, glyph: '✦', size: 12, opacity: 0.63 },
  ],
  entries: [
    { left: '5%', top: 18, glyph: '✧', size: 12, opacity: 0.62 },
    { left: '20%', top: 48, glyph: '·', size: 14, opacity: 0.31 },
    { left: '38%', top: 16, glyph: '✦', size: 10, opacity: 0.48 },
    { left: '57%', top: 53, glyph: '·', size: 13, opacity: 0.27 },
    { left: '75%', top: 23, glyph: '✧', size: 11, opacity: 0.46 },
    { left: '93%', top: 42, glyph: '·', size: 14, opacity: 0.30 },
  ],
  media: [
    { left: '5%', top: 15, glyph: '✦', size: 12, opacity: 0.60 },
    { left: '23%', top: 50, glyph: '·', size: 14, opacity: 0.30 },
    { left: '41%', top: 23, glyph: '✧', size: 10, opacity: 0.43 },
    { left: '61%', top: 54, glyph: '·', size: 13, opacity: 0.27 },
    { left: '79%', top: 17, glyph: '✦', size: 11, opacity: 0.54 },
    { left: '94%', top: 45, glyph: '✧', size: 10, opacity: 0.42 },
  ],
  games: [
    { left: '6%', top: 48, glyph: '·', size: 14, opacity: 0.29 },
    { left: '22%', top: 15, glyph: '✧', size: 11, opacity: 0.49 },
    { left: '39%', top: 50, glyph: '✦', size: 10, opacity: 0.46 },
    { left: '58%', top: 18, glyph: '·', size: 14, opacity: 0.28 },
    { left: '77%', top: 48, glyph: '✧', size: 10, opacity: 0.43 },
    { left: '93%', top: 16, glyph: '✦', size: 11, opacity: 0.56 },
  ],
  topics: [
    { left: '5%', top: 15, glyph: '✦', size: 11, opacity: 0.56 },
    { left: '22%', top: 49, glyph: '·', size: 14, opacity: 0.29 },
    { left: '40%', top: 18, glyph: '✧', size: 11, opacity: 0.47 },
    { left: '60%', top: 52, glyph: '·', size: 13, opacity: 0.27 },
    { left: '80%', top: 20, glyph: '✦', size: 10, opacity: 0.47 },
    { left: '94%', top: 46, glyph: '✧', size: 10, opacity: 0.42 },
  ],
  catalogue: [
    { left: '4%', top: 14, glyph: '✦', size: 12, opacity: 0.63 },
    { left: '19%', top: 49, glyph: '·', size: 14, opacity: 0.30 },
    { left: '36%', top: 20, glyph: '✧', size: 10, opacity: 0.45 },
    { left: '54%', top: 55, glyph: '·', size: 13, opacity: 0.27 },
    { left: '72%', top: 18, glyph: '✦', size: 11, opacity: 0.52 },
    { left: '87%', top: 47, glyph: '✧', size: 10, opacity: 0.42 },
    { left: '95%', top: 15, glyph: '·', size: 14, opacity: 0.28 },
  ],
};

const constellationFields: Record<Variant, Thread[]> = {
  books: [
    { left: '7%', top: 34, width: 62, rotate: '-14deg', opacity: 0.20 },
    { left: '80%', top: 32, width: 54, rotate: '17deg', opacity: 0.17 },
  ],
  entries: [
    { left: '7%', top: 39, width: 52, rotate: '-18deg', opacity: 0.17 },
    { left: '77%', top: 34, width: 65, rotate: '11deg', opacity: 0.18 },
  ],
  media: [
    { left: '9%', top: 35, width: 56, rotate: '14deg', opacity: 0.17 },
    { left: '78%', top: 34, width: 58, rotate: '-15deg', opacity: 0.17 },
  ],
  games: [
    { left: '9%', top: 34, width: 58, rotate: '-12deg', opacity: 0.17 },
    { left: '76%', top: 34, width: 61, rotate: '16deg', opacity: 0.18 },
  ],
  topics: [
    { left: '8%', top: 36, width: 55, rotate: '-16deg', opacity: 0.18 },
    { left: '79%', top: 35, width: 56, rotate: '13deg', opacity: 0.17 },
  ],
  catalogue: [
    { left: '8%', top: 34, width: 58, rotate: '-14deg', opacity: 0.18 },
    { left: '79%', top: 34, width: 58, rotate: '14deg', opacity: 0.18 },
  ],
};

const dither = Array.from({ length: 38 }, (_, index) => {
  const row = index % 5;
  const column = Math.floor(index / 5);
  const baseLeft = 2 + column * 12.6;

  return {
    left: \`\${Math.min(97, baseLeft + row * 1.6)}%\` as \`\${number}%\`,
    top: 2 + row * 10,
    opacity: Math.max(0.018, 0.13 - row * 0.022),
  };
});

export function CelestialAtmosphere({
  variant = 'catalogue',
}: Props) {
  const aeroMode = activeVisualSkinId === 'aero';

  return (
    <View
      style={[
        styles.root,
        aeroMode && styles.rootAero,
      ]}
    >
      {dither.map((dot, index) => (
        <View
          key={\`dot-\${index}\`}
          style={[
            styles.dot,
            aeroMode && styles.dotAero,
            {
              left: dot.left,
              top: dot.top,
              opacity: dot.opacity,
            },
          ]}
        />
      ))}

      {constellationFields[variant].map((thread, index) => (
        <View
          key={\`thread-\${index}\`}
          style={[
            styles.thread,
            {
              left: thread.left,
              top: thread.top,
              width: thread.width,
              opacity: thread.opacity,
              transform: [{ rotate: thread.rotate }],
            },
          ]}
        />
      ))}

      {starFields[variant].map((star, index) => (
        <Text
          key={\`star-\${index}\`}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
    overflow: 'visible',
    pointerEvents: 'none',
  },
  rootAero: {
    opacity: 0.88,
  },
  dot: {
    position: 'absolute',
    width: 1,
    height: 1,
    borderRadius: 0.5,
    backgroundColor: BLUE,
  },
  dotAero: {
    width: 1.2,
    height: 1.2,
  },
  thread: {
    position: 'absolute',
    height: StyleSheet.hairlineWidth,
    backgroundColor: GOLD,
  },
  star: {
    position: 'absolute',
    color: GOLD,
    lineHeight: 15,
  },
});
`;

  fs.writeFileSync(file, next, 'utf8');
  console.log('  ✓ CelestialAtmosphere rewritten');

  console.log('\nChecking TypeScript...');
  const after = runTsc();
  const added = newDiagnostics(before.text, after.text);

  if (added.length > 0) {
    console.error('\nNEW TypeScript diagnostics — restoring atmosphere.');
    console.error(added.join('\n'));
    fs.copyFileSync(backup, file);
    process.exit(1);
  }

  console.log('\n✓ Celestial header polish applied.');
  console.log('✓ No background wash or filled rectangle.');
  console.log('✓ Dither fades downward instead of becoming a hard band.');
  console.log('✓ Sparse gold stars + two subtle constellation threads per section.');
  console.log('✓ Decorative overlay does not participate in layout.');
  console.log('✓ Aero/Frutiger gets a slightly richer texture without extra fill.');
  console.log('BACKUP: ' + backupRoot);

  if (after.status === 0) {
    console.log('TYPESCRIPT CLEAN ✓');
  } else {
    console.log('No new TypeScript diagnostics; existing baseline unchanged.');
  }
} catch (error) {
  fs.copyFileSync(backup, file);
  console.error('\nSAFE STOP: ' + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
