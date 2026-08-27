const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const file = path.join(
  MOBILE,
  'src',
  'screens',
  'ThemePickerScreen.tsx',
);

if (!fs.existsSync(file)) {
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
  'cloud-history-compact-v1-' + stamp,
);

fs.mkdirSync(backupDir, {
  recursive: true,
});

fs.copyFileSync(
  file,
  path.join(
    backupDir,
    'ThemePickerScreen.tsx',
  ),
);

let text = fs
  .readFileSync(file, 'utf8')
  .replace(/\r\n/g, '\n');

function fail(message) {
  throw new Error(
    'SAFE STOP - ' + message,
  );
}

// state
if (
  !text.includes(
    'const [cloudHistoryExpanded, setCloudHistoryExpanded]',
  )
) {
  const anchor = `  const [cloudSnapshots, setCloudSnapshots] =
    useState<CloudSnapshotMeta[]>([]);`;

  if (!text.includes(anchor)) {
    fail('cloudSnapshots state anchor changed');
  }

  text = text.replace(
    anchor,
    `${anchor}

  const [cloudHistoryExpanded, setCloudHistoryExpanded] =
    useState(false);`,
  );
}

// Request less metadata. Server retention becomes authoritative anyway.
text = text.replace(
  'await listCloudSnapshots(30);',
  'await listCloudSnapshots(12);',
);

// Find the current CLOUD HISTORY render block.
const startNeedle =
  `          <Text style={[styles.importLabel, { marginTop: 18 }]}>
            CLOUD HISTORY
          </Text>`;

const start = text.indexOf(startNeedle);

if (start < 0) {
  fail('CLOUD HISTORY heading changed');
}

const endNeedle =
  `        </View>
        <BridgePanel />`;

let end = text.indexOf(
  endNeedle,
  start,
);

// Bridge may be before or after JSON block depending on previous fix.
// Fallback to JSON export button as stable boundary.
if (end < 0) {
  const exportNeedle =
    `<Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => void exportData()}`;

  end = text.indexOf(
    exportNeedle,
    start,
  );

  if (end < 0) {
    fail('cloud history end boundary changed');
  }
}

const oldBlock = text.slice(
  start,
  end,
);

if (
  !oldBlock.includes(
    'cloudSnapshots.map',
  )
) {
  fail('cloud history list shape changed');
}

const newBlock = `          <View style={styles.cloudHistoryHeader}>
            <View style={styles.cloudHistoryHeaderCopy}>
              <Text style={styles.importLabel}>
                CLOUD HISTORY
              </Text>

              <Text style={styles.cloudHistorySummary}>
                {cloudSnapshots.length > 0
                  ? \`\${cloudSnapshots.length} retained checkpoints\`
                  : 'No checkpoints yet'}
              </Text>
            </View>

            {cloudSnapshots.length > 1 ? (
              <Pressable
                accessibilityRole="button"
                disabled={cloudHistoryBusy}
                onPress={() =>
                  setCloudHistoryExpanded(
                    (current) => !current,
                  )
                }
                style={({ pressed }) => [
                  styles.cloudHistoryToggle,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.cloudHistoryToggleText}>
                  {cloudHistoryExpanded
                    ? 'HIDE'
                    : 'OLDER'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {cloudSnapshots[0] ? (
            <View style={styles.cloudLatest}>
              <View style={styles.cloudLatestTop}>
                <View style={styles.cloudLatestCopy}>
                  <Text style={styles.cloudLatestKicker}>
                    LATEST CHECKPOINT
                  </Text>

                  <Text style={styles.cloudLatestTitle}>
                    Revision {cloudSnapshots[0].revision}
                  </Text>

                  <Text style={styles.importMeta}>
                    {cloudSnapshots[0].createdAt
                      ? new Date(
                          cloudSnapshots[0].createdAt,
                        ).toLocaleString('hr-HR')
                      : 'Unknown date'}
                    {' · '}
                    {(
                      cloudSnapshots[0].backupBytes /
                      1024 /
                      1024
                    ).toFixed(1)} MB
                  </Text>
                </View>

                <Pressable
                  disabled={cloudHistoryBusy}
                  onPress={() =>
                    restoreCloudRevision(
                      cloudSnapshots[0]!.revision,
                    )
                  }
                  style={({ pressed }) => [
                    styles.cloudLatestRestore,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.cloudLatestRestoreText}>
                    RESTORE
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {cloudHistoryExpanded ? (
            <View style={styles.cloudOlder}>
              {cloudSnapshots
                .slice(1)
                .map((snapshot) => (
                  <View
                    key={snapshot.revision}
                    style={styles.cloudOlderRow}
                  >
                    <View style={styles.cloudOlderCopy}>
                      <Text style={styles.cloudOlderTitle}>
                        Revision {snapshot.revision}
                      </Text>

                      <Text style={styles.cloudOlderMeta}>
                        {snapshot.createdAt
                          ? new Date(
                              snapshot.createdAt,
                            ).toLocaleString('hr-HR')
                          : 'Unknown date'}
                        {' · '}
                        {(
                          snapshot.backupBytes /
                          1024 /
                          1024
                        ).toFixed(1)} MB
                      </Text>
                    </View>

                    <View style={styles.cloudOlderActions}>
                      <Pressable
                        disabled={cloudHistoryBusy}
                        onPress={() =>
                          restoreCloudRevision(
                            snapshot.revision,
                          )
                        }
                        style={({ pressed }) => [
                          styles.cloudTextAction,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.cloudTextActionText}>
                          Restore
                        </Text>
                      </Pressable>

                      <Pressable
                        disabled={cloudHistoryBusy}
                        onPress={() =>
                          deleteCloudRevision(
                            snapshot.revision,
                          )
                        }
                        style={({ pressed }) => [
                          styles.cloudTextAction,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.cloudDeleteText}>
                          Delete
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
            </View>
          ) : null}

`;

text =
  text.slice(0, start) +
  newBlock +
  text.slice(end);

// Styles: insert before importNote or restartOverlay.
if (
  !text.includes(
    '  cloudHistoryHeader:',
  )
) {
  const styleAnchor =
    '  importNote:';

  const index = text.indexOf(
    styleAnchor,
  );

  if (index < 0) {
    fail('style anchor importNote changed');
  }

  const styles = `  cloudHistoryHeader: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cloudHistoryHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  cloudHistorySummary: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 9,
  },
  cloudHistoryToggle: {
    minHeight: 32,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: colors.fill,
  },
  cloudHistoryToggleText: {
    color: colors.text,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  cloudLatest: {
    marginTop: 9,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  cloudLatestTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cloudLatestCopy: {
    flex: 1,
    minWidth: 0,
  },
  cloudLatestKicker: {
    color: colors.textMuted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  cloudLatestTitle: {
    marginTop: 3,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  cloudLatestRestore: {
    minHeight: 34,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: colors.fill,
  },
  cloudLatestRestoreText: {
    color: colors.text,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  cloudOlder: {
    marginTop: 2,
  },
  cloudOlderRow: {
    minHeight: 54,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  cloudOlderCopy: {
    flex: 1,
    minWidth: 0,
  },
  cloudOlderTitle: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
  },
  cloudOlderMeta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 8,
  },
  cloudOlderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cloudTextAction: {
    minHeight: 30,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloudTextActionText: {
    color: colors.text,
    fontSize: 8,
    fontWeight: '800',
  },
  cloudDeleteText: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
  },
`;

  text =
    text.slice(0, index) +
    styles +
    text.slice(index);
}

fs.writeFileSync(
  file,
  text,
  'utf8',
);

console.log('');
console.log('CLOUD HISTORY COMPACT V1 INSTALLED');
console.log('✓ latest checkpoint always visible');
console.log('✓ older revisions collapsed behind OLDER');
console.log('✓ older rows are compact, not giant cards');
console.log('✓ list request reduced from 30 to 12');
console.log('✓ restore/delete semantics unchanged');
console.log('✓ local-first sync logic unchanged');
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
