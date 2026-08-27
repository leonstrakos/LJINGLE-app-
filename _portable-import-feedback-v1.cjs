const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const FILE = path.join(
  MOBILE,
  'src',
  'components',
  'PortableImportPanel.tsx',
);

if (!fs.existsSync(FILE)) {
  throw new Error('SAFE STOP - PortableImportPanel.tsx missing');
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(
  ROOT,
  '_recovery',
  'portable-import-feedback-' + stamp,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  FILE,
  path.join(backupDir, 'PortableImportPanel.tsx'),
);

let text = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

const anchor = `      {lastImport?.jingleCandidates
        .length ? (`;

if (!text.includes(anchor)) {
  throw new Error(
    'SAFE STOP - import result insertion anchor not found',
  );
}

if (!text.includes('IMPORT COMPLETE')) {
  const card = `      {lastImport ? (
        <View style={styles.importResult}>
          <Text style={styles.importResultKicker}>
            {lastImport.imported === 0 &&
            lastImport.reused > 0
              ? 'ALREADY IN ARCHIVE'
              : 'IMPORT COMPLETE'}
          </Text>

          <Text style={styles.importResultCounts}>
            Imported {lastImport.imported}
            {'  ✧  '}
            Reused {lastImport.reused}
            {'  ✧  '}
            Relations {lastImport.relationships}
          </Text>

          <Text style={styles.importResultCopy}>
            {lastImport.imported === 0 &&
            lastImport.reused > 0
              ? 'Existing local objects were reused; no duplicate was created.'
              : 'The LJingle package is now in your local archive.'}
          </Text>
        </View>
      ) : null}

`;

  text = text.replace(anchor, card + anchor);
}

const styleAnchor = `  jingleAfterImport: {`;

if (!text.includes(styleAnchor)) {
  throw new Error(
    'SAFE STOP - import result style anchor not found',
  );
}

if (!text.includes('importResult: {')) {
  const styles = `  importResult: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    backgroundColor: colors.fill,
  },
  importResultKicker: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  importResultCounts: {
    marginTop: 6,
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  importResultCopy: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 14,
  },
`;

  text = text.replace(styleAnchor, styles + styleAnchor);
}

fs.writeFileSync(FILE, text, 'utf8');

console.log('');
console.log('PORTABLE IMPORT FEEDBACK INSTALLED');
console.log('✓ import result stays visible after preview closes');
console.log('✓ shows Imported / Reused / Relations');
console.log('✓ duplicate imports say ALREADY IN ARCHIVE');
console.log('✓ no database/import semantics changed');
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
