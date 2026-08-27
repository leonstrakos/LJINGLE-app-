const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = process.cwd();
const rel = 'src/components/JinglePortal.tsx';
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

function styleBlock(src, name, mutate) {
  const token = `  ${name}: {`;
  const start = src.indexOf(token);
  if (start < 0) throw new Error('style block not found: ' + name);

  const end = src.indexOf('\n  },', start);
  if (end < 0) throw new Error('style block end not found: ' + name);

  const blockEnd = end + '\n  },'.length;
  const block = src.slice(start, blockEnd);

  return src.slice(0, start) + mutate(block) + src.slice(blockEnd);
}

console.log('Capturing TypeScript baseline...');
const before = runTsc();

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupRoot = path.join(
  root,
  '..',
  '_recovery',
  `jingle-toggle-shake-panel-${stamp}`,
);
const backup = path.join(backupRoot, rel);

fs.mkdirSync(path.dirname(backup), { recursive: true });
fs.copyFileSync(file, backup);

try {
  let src = fs.readFileSync(file, 'utf8');

  // ---------------------------------------------------------------------
  // 1) Stronger physical ring: more oscillations + scale pulse.
  // ---------------------------------------------------------------------
  const animationRx =
    /const animateBell = \(\) => \{[\s\S]*?\n  \};\n\n  const ringBell = \(\) => \{/m;

  if (!animationRx.test(src)) {
    throw new Error('animateBell block not found');
  }

  src = src.replace(
    animationRx,
`const animateBell = () => {
    ring.stopAnimation();
    scale.stopAnimation();

    ring.setValue(0);
    scale.setValue(1);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(ring, {
          toValue: -1,
          duration: 42,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(ring, {
          toValue: 1,
          duration: 52,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(ring, {
          toValue: -0.82,
          duration: 48,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(ring, {
          toValue: 0.7,
          duration: 46,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(ring, {
          toValue: -0.46,
          duration: 44,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(ring, {
          toValue: 0.34,
          duration: 42,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(ring, {
          toValue: 0,
          speed: 24,
          bounciness: 6,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.86,
          duration: 55,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(scale, {
          toValue: 1.16,
          speed: 28,
          bounciness: 10,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(scale, {
          toValue: 1,
          speed: 20,
          bounciness: 7,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    ]).start();
  };

  const ringBell = () => {`
  );

  // More obvious swing.
  src = src.replace(
    /outputRange:\s*\[['"]-15deg['"],\s*['"]0deg['"],\s*['"]15deg['"]\]/,
    `outputRange: ['-19deg', '0deg', '19deg']`,
  );
  src = src.replace(
    /outputRange:\s*\[['"]-11deg['"],\s*['"]0deg['"],\s*['"]11deg['"]\]/,
    `outputRange: ['-19deg', '0deg', '19deg']`,
  );

  // ---------------------------------------------------------------------
  // 2) One behavior:
  // tap closed -> open panel
  // tap open   -> close panel
  // long press -> immediately open Command Palette
  // ---------------------------------------------------------------------
  const openPanelRx =
    /const openPanel = \(\) => \{\s*ringBell\(\);\s*setPanelVisible\(true\);\s*\};/m;

  if (openPanelRx.test(src)) {
    src = src.replace(
      openPanelRx,
`const togglePanel = () => {
    ringBell();
    setPanelVisible((current) => !current);
  };`,
    );
  } else if (!src.includes('const togglePanel = () =>')) {
    throw new Error('openPanel/togglePanel handler not found');
  }

  src = src.replace(/\bopenPanel\(\);/g, 'togglePanel();');

  // ---------------------------------------------------------------------
  // 3) Extract a reusable floating bell control so the SAME bell can be
  // rendered both outside and on top of the Modal.
  // ---------------------------------------------------------------------
  if (!src.includes('const renderFloatingBell =')) {
    const returnIndex = src.indexOf('\n  return (\n');
    if (returnIndex < 0) throw new Error('component return anchor not found');

    const helper = `

  const renderFloatingBell = (insidePanel = false) => (
    <View style={[styles.anchor, insidePanel && styles.anchorOnPanel]}>
      {bellBackgroundEnabled ? (
        <View style={[styles.halo, aeroMode && styles.aeroHalo]} />
      ) : null}

      <Text style={[styles.spark, styles.sparkLeft]}>✦</Text>
      <Text style={[styles.spark, styles.sparkTop]}>·</Text>
      <Text style={[styles.spark, styles.sparkRight]}>✧</Text>

      <Pressable
        accessibilityLabel={insidePanel ? 'Zatvori Jingle' : 'Jingle'}
        accessibilityRole="button"
        delayLongPress={430}
        hitSlop={14}
        onLongPress={() => {
          longPressTriggered.current = true;
          openPalette();
        }}
        onPress={() => {
          if (longPressTriggered.current) {
            longPressTriggered.current = false;
            return;
          }

          togglePanel();
        }}
        style={({ pressed }) => [
          styles.button,
          bellBackgroundEnabled && aeroMode && styles.aeroButton,
          bellBackgroundEnabled && aeroMode && webGlassStyle,
          bellBackgroundEnabled && aeroMode && { borderColor: activeAccentColor },
          !bellBackgroundEnabled && styles.buttonNaked,
          pressed && styles.buttonPressed,
        ]}
      >
        {aeroMode && bellBackgroundEnabled ? (
          <View style={styles.glassHighlight} />
        ) : null}

        <Animated.View
          style={[
            styles.bellWrap,
            {
              transform: [
                { rotate },
                { scale },
                { scale: bellBackgroundEnabled ? 1 : 1.24 },
              ],
            },
          ]}
        >
          <JingleBellIcon active style={styles.bell} />
        </Animated.View>
      </Pressable>
    </View>
  );`;

    src = src.slice(0, returnIndex) + helper + src.slice(returnIndex);
  }

  // Replace the existing outer bell JSX with helper.
  const outerBellRx =
    /<View style=\{styles\.anchor\}>[\s\S]*?<\/Pressable>\s*<\/View>\s*\n\s*<Modal/m;

  if (outerBellRx.test(src)) {
    src = src.replace(
      outerBellRx,
      `{renderFloatingBell()}

      <Modal`,
    );
  } else if (!src.includes('{renderFloatingBell()}')) {
    throw new Error('outer floating bell JSX not found');
  }

  // ---------------------------------------------------------------------
  // 4) Keep bell visible ABOVE the open modal/panel.
  // Add a duplicate rendered through the same helper inside Modal root.
  // ---------------------------------------------------------------------
  if (!src.includes('{renderFloatingBell(true)}')) {
    const modalCloseAnchor = `          </View>
        </View>
      </Modal>`;

    if (!src.includes(modalCloseAnchor)) {
      throw new Error('Modal closing anchor not found');
    }

    src = src.replace(
      modalCloseAnchor,
`          </View>

          {renderFloatingBell(true)}
        </View>
      </Modal>`,
    );
  }

  // ---------------------------------------------------------------------
  // 5) Remove redundant little bell beside "Kamo želiš?"
  // ---------------------------------------------------------------------
  const brandBellRx =
    /<View style=\{styles\.brandBell\}>[\s\S]*?<JingleBellIcon[\s\S]*?<\/View>\s*/m;

  if (brandBellRx.test(src)) {
    src = src.replace(brandBellRx, '');
  }

  // Remove left padding that only existed because of that icon.
  if (src.includes('  brandCopy: {')) {
    src = styleBlock(src, 'brandCopy', (block) =>
      block.replace(/\n\s*paddingLeft:\s*\d+,/, ''),
    );
  }

  // Panel bell should sit above sheet.
  if (!src.includes('  anchorOnPanel: {')) {
    const haloIndex = src.indexOf('  halo: {');
    if (haloIndex < 0) throw new Error('halo style anchor not found');

    src =
      src.slice(0, haloIndex) +
`  anchorOnPanel: {
    zIndex: 999,
    elevation: 40,
  },
` +
      src.slice(haloIndex);
  }

  fs.writeFileSync(file, src, 'utf8');
  console.log('  ✓ toggleable Jingle panel');
  console.log('  ✓ floating bell remains visible over panel');
  console.log('  ✓ stronger shake / scale vibration');
  console.log('  ✓ redundant panel-header bell removed');

  console.log('\nChecking TypeScript...');
  const after = runTsc();
  const added = newDiagnostics(before.text, after.text);

  if (added.length > 0) {
    console.error('\nNEW TypeScript diagnostics — restoring JinglePortal.');
    console.error(added.join('\n'));
    fs.copyFileSync(backup, file);
    process.exit(1);
  }

  console.log('\n✓ Jingle interaction polish applied.');
  console.log('✓ Tap: ring + open panel.');
  console.log('✓ Tap again while panel is open: ring + close panel.');
  console.log('✓ Long press: ring + immediately open Command Palette.');
  console.log('✓ Bell remains rendered above the open panel.');
  console.log('✓ Sound/haptic still go through existing semantic Jingle feedback.');
  console.log('BACKUP: ' + backupRoot);

  if (after.status === 0) console.log('TYPESCRIPT CLEAN ✓');
  else console.log('No new TypeScript diagnostics; existing baseline unchanged.');
} catch (error) {
  fs.copyFileSync(backup, file);
  console.error('\nSAFE STOP: ' + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
