const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const files = {
  types: path.join(SRC, 'types', 'portablePackage.ts'),
  exportService: path.join(SRC, 'services', 'portableExport.ts'),
  importPanel: path.join(SRC, 'components', 'PortableImportPanel.tsx'),
};

for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    throw new Error(
      'SAFE STOP - missing ' +
        name +
        ': ' +
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
  'portable-canonical-visual-share-' + stamp,
);

fs.mkdirSync(backupDir, { recursive: true });

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

function backup(file) {
  if (!fs.existsSync(file)) return;

  fs.copyFileSync(
    file,
    path.join(
      backupDir,
      path.basename(file),
    ),
  );
}

function fail(message) {
  throw new Error('SAFE STOP - ' + message);
}

for (const file of Object.values(files)) {
  backup(file);
}

// ============================================================================
// 1) ONE CANONICAL .ljingle FORMAT
//    Keep a schema version internally, but there is no public V1/V2 split.
// ============================================================================

{
  let text = read(files.types);

  text = text.replace(
    /version:\s*1\s*\|\s*2\s*;/,
    'version: 1;',
  );

  write(files.types, text);
}

{
  let text = read(files.exportService);

  // Portable core must exist if provenance was already installed.
  // If it was not installed yet, visual share still works with current packages.
  text = text.replace(
    /pack\.version\s*=\s*2\s*;/g,
    'pack.version = 1;',
  );

  text = text.replace(
    /version:\s*2,/g,
    'version: 1,',
  );

  text = text.replace(
    /\(value\.version !== 1 && value\.version !== 2\)/g,
    'value.version !== 1',
  );

  // Current one-format rule.
  text = text.replace(
    /value\.version !== 2/g,
    'value.version !== 1',
  );

  write(files.exportService, text);
}

// ============================================================================
// 2) VISUAL CARD ENGINE
//    SVG on purpose: deterministic, crisp, shareable, no screenshot dependency.
// ============================================================================

const visualFile = path.join(
  SRC,
  'services',
  'portableVisualShare.ts',
);

backup(visualFile);

write(
  visualFile,
  `import {
  File as ExpoFile,
  Paths,
} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type {
  LjinglePortablePackage,
  PortableObject,
  PortableRelationship,
} from '../types/portablePackage';

function safeName(value: string) {
  const clean = value
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return clean || 'ljingle';
}

function xml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function words(
  value: string,
  max = 36,
  lines = 2,
) {
  const source = value.trim();

  if (!source) return [''];

  const tokens = source.split(/\\s+/);
  const out: string[] = [];
  let current = '';

  for (const token of tokens) {
    const next =
      current.length > 0
        ? current + ' ' + token
        : token;

    if (
      next.length > max &&
      current.length > 0
    ) {
      out.push(current);
      current = token;

      if (out.length === lines - 1) {
        break;
      }
    } else {
      current = next;
    }
  }

  if (out.length < lines && current) {
    out.push(current);
  }

  const consumed =
    out.join(' ').length;

  if (
    source.length > consumed &&
    out.length > 0
  ) {
    out[out.length - 1] =
      out[out.length - 1]
        .replace(/[.\\s]+$/, '') + '…';
  }

  return out.slice(0, lines);
}

function relationLabel(
  relationType: string,
  outgoing: boolean,
) {
  switch (relationType) {
    case 'CONTAINS':
      return outgoing
        ? 'Contains'
        : 'Inside collection';

    case 'INSPIRED_BY':
      return outgoing
        ? 'Inspirirano ovime'
        : 'Inspiriralo ovo';

    case 'ABOUT':
      return outgoing
        ? 'Govori o ovome'
        : 'O ovome govori';

    case 'REFERENCES':
      return outgoing
        ? 'Referencira ovo'
        : 'Ovo referencira ovu stavku';

    case 'ADAPTATION_OF':
      return outgoing
        ? 'Adaptirano prema ovome'
        : 'Adaptacija ovoga';

    case 'REMEMBERED_WITH':
      return 'Pamtim uz ovo';

    case 'RELATED':
      return 'Povezano';

    default:
      return relationType
        .replaceAll('_', ' ')
        .toLowerCase();
  }
}

function connectionRows(
  pack: LjinglePortablePackage,
) {
  const symmetric =
    new Set([
      'RELATED',
      'REMEMBERED_WITH',
    ]);

  return pack.relationships
    .filter(
      (relationship) =>
        relationship.sourcePortableId ===
          pack.rootPortableId ||
        relationship.targetPortableId ===
          pack.rootPortableId,
    )
    .slice(0, 5)
    .flatMap((relationship) => {
      const outgoing =
        relationship.sourcePortableId ===
        pack.rootPortableId;

      const otherPortableId =
        outgoing
          ? relationship.targetPortableId
          : relationship.sourcePortableId;

      const other =
        pack.objects.find(
          (object) =>
            object.portableId ===
            otherPortableId,
        );

      if (!other) return [];

      return [
        {
          marker: symmetric.has(
            relationship.relationType,
          )
            ? '↔'
            : outgoing
              ? 'TO'
              : 'FROM',
          label: relationLabel(
            relationship.relationType,
            outgoing,
          ),
          object: other,
          relationship,
        },
      ];
    });
}

function rootObject(
  pack: LjinglePortablePackage,
) {
  return (
    pack.objects.find(
      (object) =>
        object.portableId ===
        pack.rootPortableId,
    ) ?? pack.objects[0] ?? null
  );
}

function subtitleFor(
  root: PortableObject | null,
) {
  if (!root?.subtitle) return null;

  const clean = root.subtitle.trim();

  return clean || null;
}

function assetStats(
  pack: LjinglePortablePackage,
) {
  const images = pack.assets.filter(
    (asset) => asset.kind === 'IMAGE',
  ).length;

  const audio = pack.assets.filter(
    (asset) => asset.kind === 'AUDIO',
  ).length;

  return { images, audio };
}

export function portableVisualSvg(
  pack: LjinglePortablePackage,
) {
  const width = 1080;
  const height = 1350;

  const root = rootObject(pack);
  const subtitle = subtitleFor(root);
  const connections =
    connectionRows(pack);

  const stats = assetStats(pack);

  const titleLines =
    words(pack.title, 27, 3);

  const subtitleLines =
    subtitle
      ? words(subtitle, 58, 2)
      : [];

  const titleMarkup =
    titleLines
      .map(
        (line, index) =>
          \`<text x="150" y="\${255 + index * 72}" class="title">\${xml(line)}</text>\`,
      )
      .join('');

  const subtitleStart =
    280 +
    titleLines.length * 72;

  const subtitleMarkup =
    subtitleLines
      .map(
        (line, index) =>
          \`<text x="150" y="\${subtitleStart + index * 30}" class="subtitle">\${xml(line)}</text>\`,
      )
      .join('');

  const graphStart =
    Math.max(
      520,
      subtitleStart +
        subtitleLines.length * 30 +
        58,
    );

  const connectionMarkup =
    connections
      .map((edge, index) => {
        const y =
          graphStart + index * 126;

        const note =
          edge.relationship.note?.trim();

        const noteLine =
          note
            ? words(note, 52, 1)[0]
            : null;

        return \`
          <line x1="150" y1="\${y - 20}" x2="980" y2="\${y - 20}" class="hairline"/>
          <rect x="150" y="\${y}" width="66" height="34" rx="9" class="badge"/>
          <text x="183" y="\${y + 22}" text-anchor="middle" class="badgeText">\${xml(edge.marker)}</text>

          <text x="244" y="\${y + 12}" class="edgeTitle">\${xml(words(edge.object.title, 42, 1)[0] ?? '')}</text>
          <text x="244" y="\${y + 42}" class="edgeMeta">\${xml(edge.label)} · \${xml(edge.object.entityType)}</text>
          \${noteLine ? \`<text x="244" y="\${y + 72}" class="edgeNote">\${xml(noteLine)}</text>\` : ''}
        \`;
      })
      .join('');

  const emptyGraph =
    connections.length === 0
      ? \`
        <line x1="150" y1="\${graphStart - 20}" x2="980" y2="\${graphStart - 20}" class="hairline"/>
        <text x="150" y="\${graphStart + 24}" class="empty">No direct graph connections in this portable object.</text>
      \`
      : '';

  const provenance =
    pack.provenance
      ? 'STABLE PROVENANCE · DIRECTED GRAPH'
      : 'LJINGLE PORTABLE OBJECT';

  return \`<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="\${width}"
  height="\${height}"
  viewBox="0 0 \${width} \${height}"
>
  <defs>
    <style>
      .bg { fill: #F2EEE5; }
      .rail { fill: #111111; }
      .gold { fill: #B89B57; }
      .ink { fill: #111111; }
      .muted { fill: #6F6A61; }
      .hairline { stroke: #D5CFC2; stroke-width: 2; }
      .badge { fill: #E7E0D2; }
      .kicker {
        fill: #6F6A61;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 20px;
        font-weight: 700;
        letter-spacing: 4px;
      }
      .title {
        fill: #111111;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 66px;
        font-weight: 700;
        letter-spacing: -2px;
      }
      .subtitle {
        fill: #6F6A61;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 23px;
      }
      .meta {
        fill: #6F6A61;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 1.5px;
      }
      .section {
        fill: #6F6A61;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 3px;
      }
      .badgeText {
        fill: #6F6A61;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 1px;
      }
      .edgeTitle {
        fill: #111111;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 24px;
        font-weight: 800;
      }
      .edgeMeta {
        fill: #6F6A61;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 17px;
        font-weight: 600;
      }
      .edgeNote {
        fill: #8A8378;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 18px;
        font-style: italic;
      }
      .empty {
        fill: #8A8378;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 18px;
      }
      .footer {
        fill: #6F6A61;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 2px;
      }
      .railText {
        fill: #F2EEE5;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 20px;
        font-weight: 800;
        letter-spacing: 5px;
      }
    </style>
  </defs>

  <rect width="\${width}" height="\${height}" class="bg"/>
  <rect width="90" height="\${height}" class="rail"/>

  <text
    x="46"
    y="72"
    text-anchor="middle"
    class="railText"
  >LJ</text>

  <rect
    x="31"
    y="113"
    width="29"
    height="5"
    rx="2.5"
    class="gold"
  />

  <text x="150" y="116" class="kicker">\${xml(pack.kind)} · LJINGLE</text>

  \${titleMarkup}
  \${subtitleMarkup}

  <text x="150" y="\${graphStart - 66}" class="meta">
    \${pack.objects.length} OBJECTS · \${pack.relationships.length} RELATIONS · \${stats.images} IMAGES · \${stats.audio} AUDIO
  </text>

  <text x="150" y="\${graphStart - 34}" class="section">CONNECTIONS</text>

  \${connectionMarkup}
  \${emptyGraph}

  <line x1="150" y1="1242" x2="980" y2="1242" class="hairline"/>

  <text x="150" y="1287" class="footer">\${xml(provenance)}</text>
  <text x="980" y="1287" text-anchor="end" class="footer">.LJINGLE</text>
</svg>\`;
}

async function webDownload(
  text: string,
  filename: string,
) {
  const web =
    globalThis as unknown as {
      Blob?: typeof Blob;
      URL?: typeof URL;
      document?: Document;
    };

  if (
    !web.Blob ||
    !web.URL ||
    !web.document
  ) {
    throw new Error(
      'Web visual export nije dostupan.',
    );
  }

  const blob = new web.Blob(
    [text],
    {
      type: 'image/svg+xml;charset=utf-8',
    },
  );

  const href =
    web.URL.createObjectURL(blob);

  const anchor =
    web.document.createElement('a');

  anchor.href = href;
  anchor.download = filename;
  anchor.click();

  web.URL.revokeObjectURL(href);

  return filename;
}

export async function sharePortableVisualCard(
  pack: LjinglePortablePackage,
) {
  const filename =
    safeName(pack.title) +
    '-ljingle-card.svg';

  const svg =
    portableVisualSvg(pack);

  if (Platform.OS === 'web') {
    return webDownload(
      svg,
      filename,
    );
  }

  const file = new ExpoFile(
    Paths.cache,
    filename,
  );

  if (file.exists) {
    file.delete();
  }

  file.create();
  file.write(svg);

  const available =
    await Sharing.isAvailableAsync();

  if (!available) {
    throw new Error(
      'System share nije dostupan na ovom uređaju.',
    );
  }

  await Sharing.shareAsync(
    file.uri,
    {
      dialogTitle:
        'Share LJingle visual card',
      mimeType: 'image/svg+xml',
      UTI: 'public.svg-image',
    },
  );

  return filename;
}
`,
);

// ============================================================================
// 3) SHARE CHOOSER
//    Existing share glyphs keep working. They now open:
//    - Portable .ljingle
//    - Visual card
// ============================================================================

{
  let text = read(files.exportService);

  if (
    !text.includes(
      "from './portableVisualShare'",
    )
  ) {
    const importMatches =
      [...text.matchAll(/^import .*;$/gm)];

    if (!importMatches.length) {
      fail(
        'portableExport import block missing',
      );
    }

    const last =
      importMatches[
        importMatches.length - 1
      ];

    const insertAt =
      last.index + last[0].length;

    text =
      text.slice(0, insertAt) +
      "\nimport { sharePortableVisualCard } from './portableVisualShare';" +
      text.slice(insertAt);
  }

  // Add Alert to react-native import.
  text = text.replace(
    "import { Platform } from 'react-native';",
    "import { Alert, Platform } from 'react-native';",
  );

  if (
    !text.includes(
      'async function choosePortableShare(',
    )
  ) {
    const sharePackageAnchor =
      'async function sharePackage(';

    const index =
      text.indexOf(
        sharePackageAnchor,
      );

    if (index < 0) {
      fail(
        'portableExport sharePackage anchor changed',
      );
    }

    const chooser = `async function webPortableShareChoice(
  pack: LjinglePortablePackage,
) {
  const web = globalThis as unknown as {
    document?: Document;
  };

  if (!web.document) {
    throw new Error(
      'Web share menu nije dostupan.',
    );
  }

  return new Promise<string | null>(
    (resolve) => {
      const document = web.document!;

      const overlay =
        document.createElement('div');

      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.zIndex = '999999';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'flex-end';
      overlay.style.justifyContent = 'center';
      overlay.style.padding = '18px';
      overlay.style.background =
        'rgba(17,17,17,0.28)';
      overlay.style.backdropFilter =
        'blur(6px)';

      const sheet =
        document.createElement('div');

      sheet.style.width = 'min(520px, 100%)';
      sheet.style.border =
        '1px solid rgba(30,30,30,0.12)';
      sheet.style.borderRadius = '22px';
      sheet.style.padding = '18px';
      sheet.style.boxSizing = 'border-box';
      sheet.style.background = '#F2EEE5';
      sheet.style.boxShadow =
        '0 18px 70px rgba(0,0,0,0.18)';
      sheet.style.fontFamily =
        'Arial, Helvetica, sans-serif';

      const kicker =
        document.createElement('div');

      kicker.textContent =
        'SHARE FROM LJINGLE';
      kicker.style.fontSize = '10px';
      kicker.style.fontWeight = '800';
      kicker.style.letterSpacing = '1.4px';
      kicker.style.color = '#6F6A61';

      const title =
        document.createElement('div');

      title.textContent = pack.title;
      title.style.marginTop = '7px';
      title.style.fontFamily =
        'Georgia, Times New Roman, serif';
      title.style.fontSize = '26px';
      title.style.fontWeight = '700';
      title.style.color = '#111111';

      const copy =
        document.createElement('div');

      copy.textContent =
        'Send the portable object or a visual archive card.';
      copy.style.marginTop = '6px';
      copy.style.fontSize = '12px';
      copy.style.lineHeight = '18px';
      copy.style.color = '#6F6A61';

      const actions =
        document.createElement('div');

      actions.style.display = 'grid';
      actions.style.gap = '8px';
      actions.style.marginTop = '18px';

      const button = (
        label: string,
        value: string | null,
        primary = false,
      ) => {
        const element =
          document.createElement('button');

        element.type = 'button';
        element.textContent = label;
        element.style.minHeight = '48px';
        element.style.borderRadius = '14px';
        element.style.border = primary
          ? '1px solid #111111'
          : '1px solid rgba(30,30,30,0.12)';
        element.style.background =
          primary
            ? '#111111'
            : '#F8F5EE';
        element.style.color =
          primary
            ? '#F2EEE5'
            : '#111111';
        element.style.fontSize = '11px';
        element.style.fontWeight = '800';
        element.style.letterSpacing =
          '0.5px';
        element.style.cursor = 'pointer';

        element.onclick = () => {
          overlay.remove();
          resolve(value);
        };

        return element;
      };

      actions.appendChild(
        button(
          'SHARE VISUAL CARD',
          'visual',
          true,
        ),
      );

      actions.appendChild(
        button(
          'SHARE .LJINGLE',
          'portable',
        ),
      );

      actions.appendChild(
        button(
          'CANCEL',
          null,
        ),
      );

      sheet.appendChild(kicker);
      sheet.appendChild(title);
      sheet.appendChild(copy);
      sheet.appendChild(actions);

      overlay.appendChild(sheet);

      overlay.onclick = (
        event,
      ) => {
        if (
          event.target === overlay
        ) {
          overlay.remove();
          resolve(null);
        }
      };

      document.body.appendChild(
        overlay,
      );
    },
  );
}

async function choosePortableShare(
  pack: LjinglePortablePackage,
) {
  let choice: string | null = null;

  if (Platform.OS === 'web') {
    choice =
      await webPortableShareChoice(
        pack,
      );
  } else {
    choice =
      await new Promise<string | null>(
        (resolve) => {
          Alert.alert(
            'Share from LJingle',
            pack.title,
            [
              {
                text: 'Visual card',
                onPress: () =>
                  resolve('visual'),
              },
              {
                text: '.ljingle',
                onPress: () =>
                  resolve('portable'),
              },
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () =>
                  resolve(null),
              },
            ],
            {
              cancelable: true,
              onDismiss: () =>
                resolve(null),
            },
          );
        },
      );
  }

  if (choice === 'visual') {
    return sharePortableVisualCard(
      pack,
    );
  }

  if (choice === 'portable') {
    return sharePackage(pack);
  }

  return null;
}

`;

    text =
      text.slice(0, index) +
      chooser +
      text.slice(index);
  }

  // Existing screens call these functions. Keep signatures, change only behavior.
  const replacements = [
    [
      /export async function sharePortableEntry\(\s*entryId:\s*string,\s*\)\s*\{\s*return sharePackage\(\s*await buildPortableEntryPackage\(\s*entryId,\s*\),\s*\);\s*\}/m,
      `export async function sharePortableEntry(
  entryId: string,
) {
  return choosePortableShare(
    await buildPortableEntryPackage(
      entryId,
    ),
  );
}`,
    ],
    [
      /export async function sharePortableFrequency\(\s*trackId:\s*string,\s*\)\s*\{\s*return sharePackage\(\s*await buildPortableFrequencyPackage\(\s*trackId,\s*\),\s*\);\s*\}/m,
      `export async function sharePortableFrequency(
  trackId: string,
) {
  return choosePortableShare(
    await buildPortableFrequencyPackage(
      trackId,
    ),
  );
}`,
    ],
    [
      /export async function sharePortableCollection\(\s*collectionId:\s*string,\s*\)\s*\{\s*return sharePackage\(\s*await buildPortableCollectionPackage\(\s*collectionId,\s*\),\s*\);\s*\}/m,
      `export async function sharePortableCollection(
  collectionId: string,
) {
  return choosePortableShare(
    await buildPortableCollectionPackage(
      collectionId,
    ),
  );
}`,
    ],
    [
      /export async function sharePortableTopic\(\s*topicId:\s*string,\s*\)\s*\{\s*return sharePackage\(\s*await buildPortableTopicPackage\(\s*topicId,\s*\),\s*\);\s*\}/m,
      `export async function sharePortableTopic(
  topicId: string,
) {
  return choosePortableShare(
    await buildPortableTopicPackage(
      topicId,
    ),
  );
}`,
    ],
  ];

  let changed = 0;

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(text)) {
      text = text.replace(
        pattern,
        replacement,
      );
      changed += 1;
    }
  }

  if (changed < 3) {
    fail(
      'portable share function shapes changed; updated only ' +
        changed,
    );
  }

  write(files.exportService, text);
}

// ============================================================================
// 4) IMPORT PREVIEW — remove public V2/legacy language.
// ============================================================================

{
  let text = read(files.importPanel);

  text = text.replace(
    /\{preview\.pack\.kind\}\s*·\s*LJINGLE V\s*\{preview\.pack\.version\}/g,
    "{preview.pack.kind} · LJINGLE PORTABLE",
  );

  text = text.replace(
    /LJINGLE V\s*\{preview\.pack\.version\}/g,
    'LJINGLE PORTABLE',
  );

  // V2-core preview had a conditional that would call canonical v1 "legacy".
  text = text.replace(
    /\{preview\.pack\.version >= 2 \? \(\s*<View style=\{styles\.provenanceRow\}>[\s\S]*?<\/View>\s*\) : \(\s*<Text style=\{styles\.legacy\}>[\s\S]*?<\/Text>\s*\)\}/m,
    `{preview.pack.provenance ? (
              <View style={styles.provenanceRow}>
                <Text style={styles.provenanceDot}>
                  ◉
                </Text>

                <Text style={styles.provenance}>
                  Stable provenance · directed graph
                </Text>
              </View>
            ) : null}`,
  );

  write(files.importPanel, text);
}

console.log('');
console.log('PORTABLE CANONICAL + VISUAL SHARE INSTALLED');
console.log('✓ one canonical .ljingle format — no user-facing V1/V2 split');
console.log('✓ internal schema version stays 1');
console.log('✓ provenance / stable origin IDs stay intact');
console.log('✓ existing share glyphs now open a share choice');
console.log('✓ SHARE VISUAL CARD exports a clean vector archive card');
console.log('✓ SHARE .LJINGLE sends the real portable graph object');
console.log('✓ visual card includes root item, counts, TO/FROM/↔ edges and notes');
console.log('✓ no screenshot/image dependency added');
console.log('✓ web gets a custom LJingle share sheet');
console.log('✓ native gets the system-style choice then normal share sheet');
console.log('✓ Bridge can later reuse the same portable package + visual grammar');
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
