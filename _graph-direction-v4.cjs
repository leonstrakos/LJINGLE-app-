const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const files = {
  relations: path.join(SRC, 'components', 'EntityRelationsPanel.tsx'),
  frequency: path.join(SRC, 'components', 'FrequencyLinksPanel.tsx'),
  direction: path.join(SRC, 'utils', 'connectionDirection.ts'),
};

for (const [name, file] of Object.entries(files)) {
  if (name === 'direction') continue;
  if (!fs.existsSync(file)) {
    throw new Error(
      'SAFE STOP - missing ' + name + ': ' + path.relative(ROOT, file),
    );
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(
  ROOT,
  '_recovery',
  'graph-direction-v4-' + stamp,
);
fs.mkdirSync(backupDir, { recursive: true });

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}
function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}
function backup(file) {
  if (!fs.existsSync(file)) return;
  fs.copyFileSync(file, path.join(backupDir, path.basename(file)));
}
function fail(message) {
  throw new Error('SAFE STOP - ' + message);
}
function addImport(text, importLine) {
  if (text.includes(importLine)) return text;

  const imports = [...text.matchAll(/^import .*;$/gm)];
  if (!imports.length) fail('import block missing');

  const last = imports[imports.length - 1];
  const insertAt = last.index + last[0].length;

  return (
    text.slice(0, insertAt) +
    '\n' +
    importLine +
    text.slice(insertAt)
  );
}
function insertStyleBefore(text, anchor, source) {
  const markerName = source.trim().split(':')[0];
  if (text.includes('  ' + markerName + ':')) return text;

  const marker = '  ' + anchor + ':';
  const index = text.indexOf(marker);
  if (index < 0) fail('style anchor missing: ' + anchor);

  return text.slice(0, index) + source + text.slice(index);
}

for (const file of Object.values(files)) backup(file);

// ============================================================================
// Shared semantics — reusable later by Portable V2 preview/export.
// ============================================================================

write(
  files.direction,
  `import {
  relationTypeLabels,
  type EntityLink,
  type EntityReferenceType,
  type RelationType,
} from '../types/collection';

export type ConnectionDirection =
  | 'OUT'
  | 'IN'
  | 'BOTH';

export type ConnectionDirectionCopy = {
  direction: ConnectionDirection;
  marker: 'TO' | 'FROM' | '↔';
  label: string;
};

const symmetric = new Set<RelationType>([
  'RELATED',
  'REMEMBERED_WITH',
]);

const directionalLabels: Partial<
  Record<
    RelationType,
    {
      out: string;
      in: string;
    }
  >
> = {
  INSPIRED_BY: {
    out: 'Inspirirano ovime',
    in: 'Inspiriralo ovo',
  },
  ABOUT: {
    out: 'Govori o ovome',
    in: 'O ovome govori',
  },
  REFERENCES: {
    out: 'Referencira ovo',
    in: 'Ovo referencira ovu stavku',
  },
  ADAPTATION_OF: {
    out: 'Adaptirano prema ovome',
    in: 'Adaptacija ovoga',
  },
};

export function connectionDirectionCopy(
  link: EntityLink,
  currentType: EntityReferenceType,
  currentId: string,
): ConnectionDirectionCopy {
  if (symmetric.has(link.relationType)) {
    return {
      direction: 'BOTH',
      marker: '↔',
      label:
        link.relationType ===
        'REMEMBERED_WITH'
          ? 'Pamtim uz ovo'
          : relationTypeLabels[
              link.relationType
            ],
    };
  }

  const outgoing =
    link.sourceType === currentType &&
    link.sourceId === currentId;

  const labels =
    directionalLabels[link.relationType];

  return {
    direction: outgoing ? 'OUT' : 'IN',
    marker: outgoing ? 'TO' : 'FROM',
    label:
      (outgoing
        ? labels?.out
        : labels?.in) ??
      relationTypeLabels[
        link.relationType
      ],
  };
}
`,
);

// ============================================================================
// Generic EntityRelationsPanel
// ============================================================================

{
  let text = read(files.relations);

  text = addImport(
    text,
    "import { connectionDirectionCopy } from '../utils/connectionDirection';",
  );

  // We keep otherSide() for navigation; add one direction object per row.
  if (!text.includes('const direction = connectionDirectionCopy(')) {
    const otherLine = 'const other = otherSide(link);';
    const index = text.indexOf(otherLine);

    if (index < 0) {
      fail('EntityRelationsPanel other row variable changed');
    }

    text = text.replace(
      otherLine,
      `const other = otherSide(link);
          const direction =
            connectionDirectionCopy(
              link,
              entityType,
              entityId,
            );`,
    );
  }

  // Replace old relation + inline note with direction row + separate note.
  if (!text.includes('styles.connectionMeaningRow')) {
    const relationRe =
      /<Text style=\{styles\.linkRelation\}>\s*\{relationTypeLabels\[link\.relationType\]\}\s*\{link\.note\s*\?\s*`[^`]*\$\{link\.note\}[^`]*`\s*:\s*''\}\s*<\/Text>/m;

    const match = relationRe.exec(text);

    if (!match) {
      fail('EntityRelationsPanel old relation line changed');
    }

    const replacement = `<View style={styles.connectionMeaningRow}>
                    <Text style={styles.directionMarker}>
                      {direction.marker}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={styles.linkRelation}
                    >
                      {direction.label}
                    </Text>
                  </View>

                  {link.note ? (
                    <Text
                      numberOfLines={2}
                      style={styles.connectionNote}
                    >
                      {link.note}
                    </Text>
                  ) : null}`;

    text = text.replace(relationRe, replacement);
  }

  if (!text.includes('  connectionMeaningRow:')) {
    text = insertStyleBefore(
      text,
      'linkRelation',
      `  connectionMeaningRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  directionMarker: {
    minWidth: 29,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.fill,
    color: colors.textMuted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.55,
    textAlign: 'center',
  },
  connectionNote: {
    marginTop: 4,
    paddingRight: 4,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
  },
`,
    );
  }

  if (!text.includes('// graphDirectionV4')) {
    const marker = '// navigableGraphV2';
    if (text.includes(marker)) {
      text = text.replace(
        marker,
        marker + '\n// graphDirectionV4 — direction-aware backlinks + separate notes',
      );
    } else {
      const exportMarker = 'export function EntityRelationsPanel';
      if (!text.includes(exportMarker)) fail('EntityRelationsPanel export missing');
      text = text.replace(
        exportMarker,
        '// graphDirectionV4 — direction-aware backlinks + separate notes\n' +
          exportMarker,
      );
    }
  }

  write(files.relations, text);
}

// ============================================================================
// FrequencyLinksPanel — identical semantics.
// ============================================================================

{
  let text = read(files.frequency);

  text = addImport(
    text,
    "import { connectionDirectionCopy } from '../utils/connectionDirection';",
  );

  if (!text.includes('styles.frequencyMeaningRow')) {
    const metaRe =
      /<Text\s+numberOfLines=\{1\}\s+style=\{styles\.linkMeta\}\s*>\s*\{relationTypeLabels\[link\.relationType\]\}\s*\{link\.note\s*\?\s*' · '\s*\+\s*link\.note\s*:\s*''\}\s*<\/Text>/m;

    let match = metaRe.exec(text);

    // Current file may not have numberOfLines on linkMeta.
    if (!match) {
      const fallbackRe =
        /<Text style=\{styles\.linkMeta\}>\s*\{relationTypeLabels\[link\.relationType\]\}\s*\{link\.note\s*\?\s*' · '\s*\+\s*link\.note\s*:\s*''\}\s*<\/Text>/m;
      match = fallbackRe.exec(text);
    }

    if (!match) {
      fail('FrequencyLinksPanel old relation line changed');
    }

    const replacement = `<View style={styles.frequencyMeaningRow}>
                    <Text style={styles.frequencyDirectionMarker}>
                      {
                        connectionDirectionCopy(
                          link,
                          'FREQUENCY',
                          frequency.trackId,
                        ).marker
                      }
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={styles.linkMeta}
                    >
                      {
                        connectionDirectionCopy(
                          link,
                          'FREQUENCY',
                          frequency.trackId,
                        ).label
                      }
                    </Text>
                  </View>

                  {link.note ? (
                    <Text
                      numberOfLines={2}
                      style={styles.frequencyConnectionNote}
                    >
                      {link.note}
                    </Text>
                  ) : null}`;

    text = text.replace(match[0], replacement);
  }

  if (!text.includes('  frequencyMeaningRow:')) {
    text = insertStyleBefore(
      text,
      'linkMeta',
      `  frequencyMeaningRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  frequencyDirectionMarker: {
    minWidth: 29,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.fill,
    color: colors.textMuted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.55,
    textAlign: 'center',
  },
  frequencyConnectionNote: {
    marginTop: 4,
    paddingRight: 4,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
  },
`,
    );
  }

  if (!text.includes('// graphDirectionV4')) {
    const marker = '// navigableGraphV2';
    if (text.includes(marker)) {
      text = text.replace(
        marker,
        marker + '\n// graphDirectionV4 — direction-aware backlinks + separate notes',
      );
    } else {
      const exportMarker = 'export function FrequencyLinksPanel';
      if (!text.includes(exportMarker)) fail('FrequencyLinksPanel export missing');
      text = text.replace(
        exportMarker,
        '// graphDirectionV4 — direction-aware backlinks + separate notes\n' +
          exportMarker,
      );
    }
  }

  write(files.frequency, text);
}

console.log('');
console.log('GRAPH DIRECTION V4 INSTALLED');
console.log('✓ outgoing semantic edges show a subtle TO marker');
console.log('✓ incoming backlinks show a subtle FROM marker');
console.log('✓ symmetric relations use ↔');
console.log('✓ Inspired by: Inspirirano ovime / Inspiriralo ovo');
console.log('✓ About / References / Adaptation get direction-aware copy');
console.log('✓ relationship note is now its own quieter line');
console.log('✓ same semantics in catalogue/Zapis/Topic/Game/Media and Frequency');
console.log('✓ shared direction helper is ready to reuse in Portable V2 previews');
console.log('✓ navigation / edit / unlink behavior unchanged');
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
