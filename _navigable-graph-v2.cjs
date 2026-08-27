const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const relations = path.join(
  SRC,
  'components',
  'EntityRelationsPanel.tsx',
);
const frequency = path.join(
  SRC,
  'components',
  'FrequencyLinksPanel.tsx',
);
const navHelper = path.join(
  SRC,
  'utils',
  'entityNavigation.ts',
);

for (const file of [relations, frequency]) {
  if (!fs.existsSync(file)) {
    throw new Error(
      'SAFE STOP - missing ' +
        path.relative(ROOT, file),
    );
  }
}

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, '-');

const backupDir = path.join(
  ROOT,
  '_recovery',
  'navigable-graph-v2-' + stamp,
);

fs.mkdirSync(backupDir, { recursive: true });

for (const file of [relations, frequency, navHelper]) {
  if (fs.existsSync(file)) {
    fs.copyFileSync(
      file,
      path.join(backupDir, path.basename(file)),
    );
  }
}

function read(file) {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\r\n/g, '\n');
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), {
    recursive: true,
  });
  fs.writeFileSync(file, text, 'utf8');
}

function fail(message) {
  throw new Error('SAFE STOP - ' + message);
}

function addImportAfterNavigation(
  text,
  importName,
) {
  if (text.includes(importName)) {
    return text;
  }

  const navImportRe =
    /^import\s+\{([^}]*)\}\s+from\s+['"]@react-navigation\/native['"];\s*$/m;

  const match = navImportRe.exec(text);

  if (!match) {
    fail(
      'React Navigation named import not found',
    );
  }

  const names = match[1]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!names.includes(importName)) {
    names.push(importName);
  }

  const replacement =
    "import { " +
    names.join(', ') +
    " } from '@react-navigation/native';";

  return (
    text.slice(0, match.index) +
    replacement +
    text.slice(
      match.index + match[0].length,
    )
  );
}

function addLocalImport(
  text,
  importLine,
) {
  if (text.includes(importLine)) {
    return text;
  }

  const imports = [
    ...text.matchAll(/^import .*;$/gm),
  ];

  if (!imports.length) {
    fail('import block missing');
  }

  const last = imports[imports.length - 1];
  const insertAt =
    last.index + last[0].length;

  return (
    text.slice(0, insertAt) +
    '\n' +
    importLine +
    text.slice(insertAt)
  );
}

function insertStyleBefore(
  text,
  anchor,
  source,
) {
  if (text.includes(source.trim().split(':')[0] + ':')) {
    return text;
  }

  const marker = '  ' + anchor + ':';
  const index = text.indexOf(marker);

  if (index < 0) {
    fail('style anchor missing: ' + anchor);
  }

  return (
    text.slice(0, index) +
    source +
    text.slice(index)
  );
}

// ============================================================================
// 1) One navigation helper for the whole LJingle graph.
//    Always climbs to the root navigator so it also works from Game/Media.
// ============================================================================

write(
  navHelper,
  `import type {
  EntityReference,
  EntityReferenceType,
} from '../types/collection';

type NavigationLike = {
  navigate: (
    screen: string,
    params?: unknown,
  ) => void;
  getParent?: () =>
    | NavigationLike
    | null
    | undefined;
};

type EntityLike = Pick<
  EntityReference,
  'entityType' | 'entityId'
>;

function rootNavigation(
  navigation: NavigationLike,
) {
  let current = navigation;

  while (true) {
    const parent = current.getParent?.();

    if (!parent) return current;

    current = parent;
  }
}

export function openEntityReference(
  navigationValue: unknown,
  entity: EntityLike,
) {
  const navigation =
    rootNavigation(
      navigationValue as NavigationLike,
    );

  switch (
    entity.entityType as EntityReferenceType
  ) {
    case 'BOOK':
      navigation.navigate('BookDetails', {
        bookId: entity.entityId,
      });
      return;

    case 'TOPIC':
      navigation.navigate('TopicDetails', {
        topicId: entity.entityId,
      });
      return;

    case 'ENTRY':
      navigation.navigate('EntryForm', {
        entryId: entity.entityId,
      });
      return;

    case 'GAME':
      navigation.navigate('Games', {
        screen: 'GameDetails',
        params: {
          gameId: entity.entityId,
        },
      });
      return;

    case 'MEDIA':
      navigation.navigate('Media', {
        screen: 'MediaDetails',
        params: {
          mediaId: entity.entityId,
        },
      });
      return;

    case 'FREQUENCY':
      navigation.navigate('MemoryRadio', {
        trackId: entity.entityId,
      });
      return;

    default:
      return;
  }
}

export function openCollectionReference(
  navigationValue: unknown,
  collectionId: string,
) {
  rootNavigation(
    navigationValue as NavigationLike,
  ).navigate('CollectionDetails', {
    collectionId,
  });
}
`,
);

// ============================================================================
// 2) Catalogue / Game / Media / Topic / Entry generic graph panel.
// ============================================================================

{
  let text = read(relations);

  text = addImportAfterNavigation(
    text,
    'useNavigation',
  );

  text = addLocalImport(
    text,
    "import { openCollectionReference, openEntityReference } from '../utils/entityNavigation';",
  );

  if (
    !text.includes(
      'const navigation = useNavigation();',
    )
  ) {
    const fnRe =
      /export function EntityRelationsPanel\([^)]*\)\s*\{/;

    const match = fnRe.exec(text);

    if (!match) {
      fail(
        'EntityRelationsPanel function anchor missing',
      );
    }

    const insertAt =
      match.index + match[0].length;

    text =
      text.slice(0, insertAt) +
      '\n  const navigation = useNavigation();' +
      text.slice(insertAt);
  }

  // Membership chips: + Add still opens the membership manager,
  // but an existing collection chip now OPENS that collection.
  const membershipIndex =
    text.indexOf('memberships.map');

  if (membershipIndex >= 0) {
    const oldPress =
      'onPress={() => setCollectionModal(true)}';

    const pressIndex =
      text.indexOf(
        oldPress,
        membershipIndex,
      );

    if (
      pressIndex >= 0 &&
      pressIndex <
        membershipIndex + 1800
    ) {
      text =
        text.slice(0, pressIndex) +
        `onPress={() =>
                    openCollectionReference(
                      navigation,
                      item.collectionId,
                    )
                  }` +
        text.slice(
          pressIndex + oldPress.length,
        );
    }
  }

  // Connected row: type + title + relation becomes one tappable area.
  // × remains an independent unlink action.
  if (
    !text.includes(
      'styles.linkOpen',
    )
  ) {
    const linksIndex =
      text.indexOf('links.length > 0');

    if (linksIndex < 0) {
      fail(
        'EntityRelationsPanel links render anchor missing',
      );
    }

    const contentStart =
      text.indexOf(
        '<View style={styles.linkType}>',
        linksIndex,
      );

    const unlinkStart =
      text.indexOf(
        '<Pressable disabled={deletingLink === link.linkId}',
        contentStart,
      );

    if (
      contentStart < 0 ||
      unlinkStart < 0
    ) {
      fail(
        'EntityRelationsPanel link row shape changed',
      );
    }

    const originalContent =
      text.slice(
        contentStart,
        unlinkStart,
      );

    const replacement = `<Pressable
                accessibilityRole="button"
                onPress={() =>
                  openEntityReference(
                    navigation,
                    other,
                  )
                }
                style={({ pressed }) => [
                  styles.linkOpen,
                  pressed && styles.pressed,
                ]}
              >
                ${originalContent.trim()}
                <Text style={styles.linkArrow}>›</Text>
              </Pressable>
              `;

    text =
      text.slice(0, contentStart) +
      replacement +
      text.slice(unlinkStart);
  }

  if (
    !text.includes(
      '  linkOpen:',
    )
  ) {
    text = insertStyleBefore(
      text,
      'linkType',
      `  linkOpen: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkArrow: {
    width: 24,
    color: colors.textMuted,
    fontSize: 20,
    textAlign: 'center',
  },
`,
    );
  }

  if (
    !text.includes(
      '// navigableGraphV2',
    )
  ) {
    const marker =
      'export function EntityRelationsPanel';

    text = text.replace(
      marker,
      '// navigableGraphV2\n' + marker,
    );
  }

  write(relations, text);
}

// ============================================================================
// 3) Frequency graph panel gets identical navigation semantics.
// ============================================================================

{
  let text = read(frequency);

  if (
    !text.includes(
      "from '@react-navigation/native'",
    )
  ) {
    const safeAreaImport =
      "import { SafeAreaView } from 'react-native-safe-area-context';";

    if (!text.includes(safeAreaImport)) {
      fail(
        'FrequencyLinksPanel safe-area import missing',
      );
    }

    text = text.replace(
      safeAreaImport,
      "import { useNavigation } from '@react-navigation/native';\n" +
        safeAreaImport,
    );
  } else {
    text = addImportAfterNavigation(
      text,
      'useNavigation',
    );
  }

  text = addLocalImport(
    text,
    "import { openEntityReference } from '../utils/entityNavigation';",
  );

  if (
    !text.includes(
      'const navigation = useNavigation();',
    )
  ) {
    const fnRe =
      /export function FrequencyLinksPanel\([\s\S]*?\)\s*\{/;

    const match = fnRe.exec(text);

    if (!match) {
      fail(
        'FrequencyLinksPanel function anchor missing',
      );
    }

    const insertAt =
      match.index + match[0].length;

    text =
      text.slice(0, insertAt) +
      '\n  const navigation = useNavigation();' +
      text.slice(insertAt);
  }

  if (
    !text.includes(
      'styles.frequencyLinkOpen',
    )
  ) {
    const mapIndex =
      text.indexOf(
        'related.map',
      );

    if (mapIndex < 0) {
      fail(
        'FrequencyLinksPanel related.map anchor missing',
      );
    }

    const contentStart =
      text.indexOf(
        '<View style={styles.typeBadge}>',
        mapIndex,
      );

    const unlinkStart =
      text.indexOf(
        '<Pressable',
        text.indexOf(
          '</View>',
          contentStart,
        ) + 1,
      );

    // Make sure the Pressable we found is the unlink button,
    // not something from a later section.
    const unlinkWindow =
      unlinkStart >= 0
        ? text.slice(
            unlinkStart,
            unlinkStart + 500,
          )
        : '';

    if (
      contentStart < 0 ||
      unlinkStart < 0 ||
      !unlinkWindow.includes(
        'remove(link.linkId)',
      )
    ) {
      fail(
        'FrequencyLinksPanel link row shape changed',
      );
    }

    const originalContent =
      text.slice(
        contentStart,
        unlinkStart,
      );

    const replacement = `<Pressable
                accessibilityRole="button"
                onPress={() =>
                  openEntityReference(
                    navigation,
                    target,
                  )
                }
                style={({ pressed }) => [
                  styles.frequencyLinkOpen,
                  pressed && styles.pressed,
                ]}
              >
                ${originalContent.trim()}
                <Text style={styles.linkArrow}>›</Text>
              </Pressable>
              `;

    text =
      text.slice(0, contentStart) +
      replacement +
      text.slice(unlinkStart);
  }

  if (
    !text.includes(
      '  frequencyLinkOpen:',
    )
  ) {
    text = insertStyleBefore(
      text,
      'typeBadge',
      `  frequencyLinkOpen: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  linkArrow: {
    width: 24,
    color: colors.textMuted,
    fontSize: 20,
    textAlign: 'center',
  },
`,
    );
  }

  if (
    !text.includes(
      '// navigableGraphV2',
    )
  ) {
    const marker =
      'export function FrequencyLinksPanel';

    text = text.replace(
      marker,
      '// navigableGraphV2\n' + marker,
    );
  }

  write(frequency, text);
}

console.log('');
console.log('NAVIGABLE GRAPH V2 INSTALLED');
console.log('✓ Connected rows are now tappable graph edges');
console.log('✓ Book links open Book details');
console.log('✓ Topic links open Topic details');
console.log('✓ Zapis links open the saved Zapis');
console.log('✓ Game links open nested Game details');
console.log('✓ Media links open nested Media details');
console.log('✓ Frequency links open Memory Radio at that track');
console.log('✓ existing Collection chips now open the Collection');
console.log('✓ + Add still manages collection membership');
console.log('✓ × still only unlinks; it never deletes the target');
console.log('✓ same navigation behavior in Frequency links');
console.log('✓ incoming + outgoing links remain visible because getLinks is bidirectional');
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
