const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const recoveryRoot = path.join(
  root,
  '..',
  '_recovery',
  `jingle-portal-celestial-v2-${stamp}`,
);
fs.mkdirSync(recoveryRoot, { recursive: true });

function run(cmd, args) {
  return cp.spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
  });
}

function runTsc() {
  const r = process.platform === 'win32'
    ? run('cmd.exe', ['/d', '/s', '/c', 'npx tsc --noEmit'])
    : run('npx', ['tsc', '--noEmit']);

  return {
    status: r.status ?? 1,
    text: `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(/\r\n/g, '\n').trim(),
  };
}

function diagnostics(text) {
  const lines = text.split('\n');
  return new Set(
    lines
      .map((line) => line.trim())
      .filter((line) => /(?:^|[\\/])[^:()]+\.\w+\(\d+,\d+\): error TS\d+:/.test(line)),
  );
}

function newDiagnostics(before, after) {
  const b = diagnostics(before);
  return [...diagnostics(after)].filter((line) => !b.has(line));
}

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function backupFile(rel, backups) {
  if (backups.has(rel)) return;
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return;

  const target = path.join(recoveryRoot, rel);
  ensureDir(target);
  fs.copyFileSync(file, target);
  backups.set(rel, target);
}

function insertImport(src, line) {
  if (src.includes(line)) return src;

  const importRegex = /(^|\n)import\b[\s\S]*?;\s*(?=\n|$)/g;
  let match;
  let lastEnd = -1;

  while ((match = importRegex.exec(src)) !== null) {
    lastEnd = match.index + match[0].length;
  }

  if (lastEnd < 0) {
    throw new Error('Could not safely locate complete import declarations.');
  }

  return src.slice(0, lastEnd) + '\n' + line + src.slice(lastEnd);
}

function addAtmosphereToHero(src, variant) {
  const marker = '<View style={styles.hero}>';

  if (!src.includes(marker)) {
    return { src, changed: false };
  }

  if (src.includes(`<CelestialAtmosphere variant="${variant}" />`)) {
    return { src, changed: false };
  }

  return {
    src: src.replace(
      marker,
      `${marker}\n        <CelestialAtmosphere variant="${variant}" />`,
    ),
    changed: true,
  };
}

const backups = new Map();
const created = new Set();

function restore() {
  for (const [rel, backup] of backups) {
    fs.copyFileSync(backup, path.join(root, rel));
  }

  for (const rel of created) {
    if (!backups.has(rel)) {
      const file = path.join(root, rel);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
}

try {
  // ---------------------------------------------------------------------
  // Clean only OUR known broken helper script from mobile root.
  // It is not app source, but tsconfig currently sees .cjs syntax.
  // Preserve it in _recovery rather than deleting it.
  // ---------------------------------------------------------------------
  const obsolete = 'apply-books-pages-ui-session-v1.cjs';
  const obsoletePath = path.join(root, obsolete);

  if (fs.existsSync(obsoletePath)) {
    const check = cp.spawnSync(process.execPath, ['--check', obsoletePath], {
      cwd: root,
      encoding: 'utf8',
    });

    if ((check.status ?? 1) !== 0) {
      const archived = path.join(recoveryRoot, 'obsolete-patch-scripts', obsolete);
      ensureDir(archived);
      fs.copyFileSync(obsoletePath, archived);
      fs.unlinkSync(obsoletePath);
      console.log('  ✓ archived broken old helper: ' + obsolete);
    }
  }

  console.log('Capturing TypeScript baseline...');
  const before = runTsc();

  // ---------------------------------------------------------------------
  // Components
  // ---------------------------------------------------------------------
  const atmosphereRel = 'src/components/CelestialAtmosphere.tsx';
  const atmospherePath = path.join(root, atmosphereRel);
  if (fs.existsSync(atmospherePath)) backupFile(atmosphereRel, backups);
  else created.add(atmosphereRel);
  ensureDir(atmospherePath);

  fs.writeFileSync(
    atmospherePath,
`import { StyleSheet, Text, View } from 'react-native';

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

const starFields: Record<Variant, Star[]> = {
  books: [
    { left: '4%', top: 18, glyph: '✦', size: 15, opacity: 0.75 },
    { left: '16%', top: 62, glyph: '·', size: 18, opacity: 0.42 },
    { left: '29%', top: 30, glyph: '✧', size: 12, opacity: 0.5 },
    { left: '43%', top: 77, glyph: '✦', size: 10, opacity: 0.42 },
    { left: '58%', top: 22, glyph: '·', size: 18, opacity: 0.38 },
    { left: '72%', top: 64, glyph: '✧', size: 13, opacity: 0.52 },
    { left: '86%', top: 25, glyph: '✦', size: 14, opacity: 0.68 },
  ],
  entries: [
    { left: '7%', top: 34, glyph: '✧', size: 14, opacity: 0.63 },
    { left: '20%', top: 18, glyph: '·', size: 18, opacity: 0.38 },
    { left: '34%', top: 71, glyph: '✦', size: 10, opacity: 0.44 },
    { left: '49%', top: 28, glyph: '·', size: 18, opacity: 0.38 },
    { left: '64%', top: 72, glyph: '✧', size: 13, opacity: 0.5 },
    { left: '80%', top: 24, glyph: '✦', size: 13, opacity: 0.62 },
    { left: '92%', top: 58, glyph: '·', size: 18, opacity: 0.4 },
  ],
  media: [
    { left: '6%', top: 25, glyph: '✦', size: 13, opacity: 0.6 },
    { left: '22%', top: 68, glyph: '·', size: 18, opacity: 0.36 },
    { left: '38%', top: 30, glyph: '✧', size: 12, opacity: 0.48 },
    { left: '54%', top: 72, glyph: '·', size: 18, opacity: 0.36 },
    { left: '70%', top: 20, glyph: '✦', size: 14, opacity: 0.6 },
    { left: '86%', top: 63, glyph: '✧', size: 12, opacity: 0.48 },
  ],
  games: [
    { left: '6%', top: 66, glyph: '·', size: 18, opacity: 0.36 },
    { left: '20%', top: 20, glyph: '✧', size: 13, opacity: 0.5 },
    { left: '36%', top: 60, glyph: '✦', size: 11, opacity: 0.52 },
    { left: '52%', top: 24, glyph: '·', size: 18, opacity: 0.36 },
    { left: '68%', top: 69, glyph: '✧', size: 13, opacity: 0.48 },
    { left: '84%', top: 28, glyph: '✦', size: 13, opacity: 0.6 },
  ],
  topics: [
    { left: '6%', top: 24, glyph: '✦', size: 13, opacity: 0.58 },
    { left: '21%', top: 69, glyph: '·', size: 18, opacity: 0.36 },
    { left: '36%', top: 22, glyph: '✧', size: 13, opacity: 0.5 },
    { left: '52%', top: 65, glyph: '✦', size: 10, opacity: 0.44 },
    { left: '68%', top: 20, glyph: '·', size: 18, opacity: 0.36 },
    { left: '84%', top: 67, glyph: '✧', size: 13, opacity: 0.5 },
  ],
  catalogue: [
    { left: '5%', top: 22, glyph: '✦', size: 14, opacity: 0.64 },
    { left: '20%', top: 68, glyph: '·', size: 18, opacity: 0.38 },
    { left: '36%', top: 27, glyph: '✧', size: 13, opacity: 0.5 },
    { left: '52%', top: 72, glyph: '·', size: 18, opacity: 0.36 },
    { left: '69%', top: 22, glyph: '✦', size: 13, opacity: 0.58 },
    { left: '86%', top: 64, glyph: '✧', size: 13, opacity: 0.48 },
  ],
};

const ditherRows = [
  { top: 3, dots: 16, opacity: 0.17 },
  { top: 17, dots: 14, opacity: 0.13 },
  { top: 34, dots: 12, opacity: 0.09 },
  { top: 55, dots: 10, opacity: 0.06 },
  { top: 80, dots: 8, opacity: 0.035 },
];

export function CelestialAtmosphere({
  variant = 'catalogue',
}: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.blueBand} />
      <View style={styles.goldBand} />

      {ditherRows.map((row, rowIndex) => (
        <View key={row.top} style={[styles.ditherRow, { top: row.top }]}>
          {Array.from({ length: row.dots }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  left: \`\${((index + 0.5 * (rowIndex % 2)) / row.dots) * 100}%\`,
                  opacity: row.opacity,
                },
              ]}
            />
          ))}
        </View>
      ))}

      {starFields[variant].map((star, index) => (
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

      <View style={[styles.thread, styles.threadLeft]} />
      <View style={[styles.thread, styles.threadRight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    height: 112,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  blueBand: {
    position: 'absolute',
    left: -40,
    right: -40,
    top: -26,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(47, 105, 205, 0.055)',
  },
  goldBand: {
    position: 'absolute',
    left: '35%',
    right: '8%',
    top: -18,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(220, 161, 35, 0.038)',
  },
  ditherRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
  },
  dot: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#1347A6',
  },
  star: {
    position: 'absolute',
    color: '#D99C1D',
    lineHeight: 18,
  },
  thread: {
    position: 'absolute',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(217, 156, 29, 0.17)',
  },
  threadLeft: {
    left: '11%',
    top: 54,
    width: 70,
    transform: [{ rotate: '-17deg' }],
  },
  threadRight: {
    right: '11%',
    top: 49,
    width: 82,
    transform: [{ rotate: '18deg' }],
  },
});
`,
    'utf8',
  );
  console.log('  ✓ CelestialAtmosphere');

  const portalRel = 'src/components/JinglePortal.tsx';
  const portalPath = path.join(root, portalRel);
  if (fs.existsSync(portalPath)) backupFile(portalRel, backups);
  else created.add(portalRel);
  ensureDir(portalPath);

  fs.writeFileSync(
    portalPath,
`import { useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { playUiCue } from '../audio/uiFeedback';
import { colors } from '../theme/colors';
import { JingleBellIcon } from './JingleBellIcon';

export type JinglePortalRoute =
  | 'Today'
  | 'Catalogue'
  | 'BookList'
  | 'Entries'
  | 'Topics'
  | 'Games'
  | 'Media'
  | 'Stats'
  | 'ThemePicker';

type Props = {
  onNavigate: (route: JinglePortalRoute) => void;
  onOpenPalette: () => void;
};

const destinations: Array<{
  route: JinglePortalRoute;
  mark: string;
  title: string;
  detail: string;
}> = [
  { route: 'Today', mark: '⌂', title: 'Početna', detail: 'Danas i aktivni tragovi' },
  { route: 'Catalogue', mark: '◇', title: 'Katalog', detail: 'Sve zbirke na jednom mjestu' },
  { route: 'BookList', mark: '▣', title: 'Knjige', detail: 'Čitanje, stranice i bilješke' },
  { route: 'Entries', mark: '✎', title: 'Zapisi', detail: 'Misli, citati i opažanja' },
  { route: 'Topics', mark: '✦', title: 'Teme', detail: 'Poveži svoj osobni indeks' },
  { route: 'Games', mark: '⌘', title: 'Igre', detail: 'Igranje i vrijeme' },
  { route: 'Media', mark: '▷', title: 'Filmovi i serije', detail: 'Gledanje i katalog' },
  { route: 'Stats', mark: '↗', title: 'Statistika', detail: 'Pregled tragova i vremena' },
];

export function JinglePortal({
  onNavigate,
  onOpenPalette,
}: Props) {
  const [panelVisible, setPanelVisible] = useState(false);
  const longPressTriggered = useRef(false);
  const ring = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const animateBell = () => {
    ring.stopAnimation();
    scale.stopAnimation();

    Animated.parallel([
      Animated.sequence([
        Animated.timing(ring, {
          toValue: -1,
          duration: 65,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(ring, {
          toValue: 1,
          duration: 85,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(ring, {
          toValue: -0.45,
          duration: 75,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(ring, {
          toValue: 0,
          speed: 19,
          bounciness: 7,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 0.92,
          speed: 28,
          bounciness: 4,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(scale, {
          toValue: 1,
          speed: 18,
          bounciness: 9,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    ]).start();
  };

  const ringBell = () => {
    animateBell();
    void playUiCue('jingle');
  };

  const openPanel = () => {
    ringBell();
    setPanelVisible(true);
  };

  const openPalette = () => {
    ringBell();
    setPanelVisible(false);
    onOpenPalette();
  };

  const rotate = ring.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-11deg', '0deg', '11deg'],
  });

  return (
    <>
      <View style={styles.anchor}>
        <View style={styles.halo} />
        <Text style={[styles.spark, styles.sparkLeft]}>✦</Text>
        <Text style={[styles.spark, styles.sparkTop]}>·</Text>
        <Text style={[styles.spark, styles.sparkRight]}>✧</Text>

        <Pressable
          accessibilityLabel="Jingle"
          accessibilityRole="button"
          delayLongPress={430}
          hitSlop={12}
          onLongPress={() => {
            longPressTriggered.current = true;
            openPalette();
          }}
          onPress={() => {
            if (longPressTriggered.current) {
              longPressTriggered.current = false;
              return;
            }
            openPanel();
          }}
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
            <JingleBellIcon active style={styles.bell} />
          </Animated.View>
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setPanelVisible(false)}
        transparent
        visible={panelVisible}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Zatvori Jingle"
            onPress={() => setPanelVisible(false)}
            style={styles.scrim}
          />

          <View style={styles.sheet}>
            <View style={styles.sheetStars}>
              <Text style={[styles.sheetStar, { left: '8%', top: 14 }]}>✦</Text>
              <Text style={[styles.sheetStar, { left: '25%', top: 42 }]}>·</Text>
              <Text style={[styles.sheetStar, { right: '24%', top: 23 }]}>✧</Text>
              <Text style={[styles.sheetStar, { right: '8%', top: 50 }]}>·</Text>
            </View>

            <View style={styles.handle} />

            <View style={styles.brandRow}>
              <View style={styles.brandBell}>
                <JingleBellIcon active style={styles.brandBellIcon} />
              </View>
              <View style={styles.brandCopy}>
                <Text style={styles.brandEyebrow}>LJINGLE</Text>
                <Text style={styles.brandTitle}>Kamo želiš?</Text>
                <Text style={styles.brandSubtitle}>
                  Zvono je tvoj ulaz kroz aplikaciju.
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={openPalette}
              style={({ pressed }) => [
                styles.searchAction,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.searchMark}>⌕</Text>
              <View style={styles.searchCopy}>
                <Text style={styles.searchTitle}>Pretraži sve</Text>
                <Text style={styles.searchDetail}>
                  Command Palette · naredbe i brze akcije
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>

            <ScrollView
              contentContainerStyle={styles.destinationList}
              showsVerticalScrollIndicator={false}
            >
              {destinations.map((item) => (
                <Pressable
                  key={item.route}
                  accessibilityRole="button"
                  onPress={() => {
                    setPanelVisible(false);
                    onNavigate(item.route);
                  }}
                  style={({ pressed }) => [
                    styles.destination,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.destinationMark}>
                    <Text style={styles.destinationMarkText}>{item.mark}</Text>
                  </View>

                  <View style={styles.destinationCopy}>
                    <Text style={styles.destinationTitle}>{item.title}</Text>
                    <Text style={styles.destinationDetail}>{item.detail}</Text>
                  </View>

                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}

              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setPanelVisible(false);
                  onNavigate('ThemePicker');
                }}
                style={({ pressed }) => [
                  styles.settings,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.settingsText}>Postavke</Text>
                <Text style={styles.settingsText}>›</Text>
              </Pressable>
            </ScrollView>

            <Text style={styles.longPressHint}>
              Drži zvono za Command Palette
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: '50%',
    bottom: 17,
    width: 84,
    height: 84,
    marginLeft: -42,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 90,
  },
  halo: {
    position: 'absolute',
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(6, 55, 142, 0.10)',
  },
  button: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#073D99',
    borderWidth: 1,
    borderColor: 'rgba(226, 169, 45, 0.82)',
    shadowColor: '#061C4B',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 10,
  },
  buttonPressed: {
    opacity: 0.9,
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
    color: '#DCA01F',
    fontSize: 12,
  },
  sparkLeft: {
    left: 0,
    top: 28,
  },
  sparkTop: {
    top: -2,
    left: 40,
    fontSize: 17,
  },
  sparkRight: {
    right: 0,
    top: 25,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 12, 29, 0.28)',
  },
  sheet: {
    maxHeight: '84%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.separator,
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  sheetStars: {
    ...StyleSheet.absoluteFillObject,
    height: 115,
    pointerEvents: 'none',
  },
  sheetStar: {
    position: 'absolute',
    color: '#DCA01F',
    opacity: 0.4,
    fontSize: 14,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.separator,
    marginBottom: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingBottom: 14,
  },
  brandBell: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#073D99',
    borderWidth: 1,
    borderColor: 'rgba(226, 169, 45, 0.72)',
  },
  brandBellIcon: {
    width: 40,
    height: 45,
  },
  brandCopy: {
    flex: 1,
    paddingLeft: 14,
  },
  brandEyebrow: {
    color: '#164AA9',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  brandTitle: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    marginTop: 2,
  },
  brandSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  searchAction: {
    minHeight: 66,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#071F4F',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchMark: {
    color: '#E0A42B',
    fontSize: 25,
    width: 34,
  },
  searchCopy: {
    flex: 1,
  },
  searchTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  searchDetail: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11,
    marginTop: 3,
  },
  destinationList: {
    paddingBottom: 8,
  },
  destination: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  destinationMark: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(217, 156, 29, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(217, 156, 29, 0.22)',
  },
  destinationMarkText: {
    color: '#164AA9',
    fontSize: 18,
    fontWeight: '700',
  },
  destinationCopy: {
    flex: 1,
    paddingHorizontal: 12,
  },
  destinationTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  destinationDetail: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  chevron: {
    color: '#D99C1D',
    fontSize: 27,
    lineHeight: 28,
  },
  settings: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  settingsText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  longPressHint: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 11,
    marginTop: 8,
  },
  pressed: {
    opacity: 0.66,
  },
});
`,
    'utf8',
  );
  console.log('  ✓ JinglePortal');

  // ---------------------------------------------------------------------
  // Audio: app-open is suppressed on web, user-triggered Jingle is allowed.
  // ---------------------------------------------------------------------
  const audioRel = 'src/audio/uiFeedback.ts';
  const audioPath = path.join(root, audioRel);
  backupFile(audioRel, backups);
  let audio = fs.readFileSync(audioPath, 'utf8');

  audio = audio.replace(
    /if \(Platform\.OS === 'web'(?: && cue === 'open')?\) return;/,
    `if (Platform.OS === 'web' && cue === 'open') return;`,
  );

  fs.writeFileSync(audioPath, audio, 'utf8');
  console.log('  ✓ web audio policy');

  // ---------------------------------------------------------------------
  // App: one global floating Jingle. Tap = navigation panel.
  // Long-press = existing Command Palette.
  // ---------------------------------------------------------------------
  const appRel = 'App.tsx';
  const appPath = path.join(root, appRel);
  backupFile(appRel, backups);
  let app = fs.readFileSync(appPath, 'utf8');

  app = insertImport(
    app,
    `import { JinglePortal } from './src/components/JinglePortal';`,
  );

  if (!app.includes('<JinglePortal')) {
    const paletteMatch = app.match(
      /<CommandPalette\b[\s\S]*?\/>/m,
    );

    if (!paletteMatch) {
      throw new Error(
        'App contains no self-closing <CommandPalette ... /> instance to attach JinglePortal after.',
      );
    }

    const palette = paletteMatch[0];

    app = app.replace(
      palette,
      `${palette}

      <JinglePortal
        onNavigate={(route) => {
          if (!navigationRef.isReady()) return;
          navigationRef.navigate(route as any);
        }}
        onOpenPalette={() => {
          setPaletteOpenSignal((current) => current + 1);
        }}
      />`,
    );
  }

  fs.writeFileSync(appPath, app, 'utf8');
  console.log('  ✓ App Jingle portal');

  // ---------------------------------------------------------------------
  // Main screens: deterministic stars + dither inside existing hero.
  // No random redraws, no theme dependency.
  // ---------------------------------------------------------------------
  const surfaces = [
    ['src/screens/BookListScreen.tsx', '../components/CelestialAtmosphere', 'books'],
    ['src/screens/EntryListScreen.tsx', '../components/CelestialAtmosphere', 'entries'],
    ['src/screens/MediaListScreen.tsx', '../components/CelestialAtmosphere', 'media'],
    ['src/games/screens/GameListScreen.tsx', '../../components/CelestialAtmosphere', 'games'],
    ['src/screens/TopicListScreen.tsx', '../components/CelestialAtmosphere', 'topics'],
    ['src/screens/CatalogueHomeScreen.tsx', '../components/CelestialAtmosphere', 'catalogue'],
  ];

  for (const [rel, importPath, variant] of surfaces) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) {
      console.log('  • skipped missing ' + rel);
      continue;
    }

    backupFile(rel, backups);
    let src = fs.readFileSync(file, 'utf8');

    const result = addAtmosphereToHero(src, variant);

    if (!result.changed && !src.includes(`<CelestialAtmosphere variant="${variant}" />`)) {
      console.log(`  • ${rel}: no hero anchor, left untouched`);
      continue;
    }

    src = insertImport(
      result.src,
      `import { CelestialAtmosphere } from '${importPath}';`,
    );

    fs.writeFileSync(file, src, 'utf8');
    console.log(`  ✓ ${variant} celestial hero`);
  }

  console.log('\nChecking TypeScript...');
  const after = runTsc();
  const added = newDiagnostics(before.text, after.text);

  if (added.length > 0) {
    console.error('\nNEW TypeScript diagnostics detected — restoring v2.');
    console.error('\n--- New diagnostics only ---\n');
    console.error(added.join('\n'));
    restore();
    process.exit(1);
  }

  console.log('\n✓ Jingle portal + celestial v2 applied.');
  console.log('✓ NO bottom navigation bar.');
  console.log('✓ Tap Jingle: ring + navigation/action panel.');
  console.log('✓ Long-press Jingle: ring + existing Command Palette.');
  console.log('✓ Panel routes to Home, Catalogue, Books, Entries, Topics, Games, Media, Stats, Settings.');
  console.log('✓ User-triggered Jingle sound works on web; app-open autoplay stays suppressed.');
  console.log('✓ Deterministic stars + lightweight dither added to supported hero headers.');
  console.log('✓ Old broken books-pages v1 helper archived out of mobile root if it was still present.');
  console.log('BACKUP: ' + recoveryRoot);

  if (after.status === 0) {
    console.log('TYPESCRIPT CLEAN ✓');
  } else {
    console.log('No NEW TypeScript diagnostics; existing baseline diagnostics remain unchanged.');
  }
} catch (error) {
  restore();
  console.error('\nSAFE STOP: ' + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
