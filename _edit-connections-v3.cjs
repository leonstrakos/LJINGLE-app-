const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const files = {
  relations: path.join(SRC, 'components', 'EntityRelationsPanel.tsx'),
  frequency: path.join(SRC, 'components', 'FrequencyLinksPanel.tsx'),
  collectionApi: path.join(SRC, 'services', 'collectionApi.ts'),
  entityLinksApi: path.join(SRC, 'services', 'entityLinksApi.ts'),
  localApi: path.join(SRC, 'storage', 'localApi.ts'),
};

for (const [name, file] of Object.entries(files)) {
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
  'edit-connections-v3-' + stamp,
);
fs.mkdirSync(backupDir, { recursive: true });

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}
function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}
function backup(file) {
  fs.copyFileSync(file, path.join(backupDir, path.basename(file)));
}
function fail(message) {
  throw new Error('SAFE STOP - ' + message);
}
function insertBefore(text, needle, addition, label) {
  const index = text.indexOf(needle);
  if (index < 0) fail(label + ' anchor missing');
  return text.slice(0, index) + addition + text.slice(index);
}
function insertStyleBefore(text, anchor, source) {
  if (text.includes(source.trim().split(':')[0] + ':')) return text;
  const marker = '  ' + anchor + ':';
  const index = text.indexOf(marker);
  if (index < 0) fail('style anchor missing: ' + anchor);
  return text.slice(0, index) + source + text.slice(index);
}

for (const file of Object.values(files)) backup(file);

// ============================================================================
// 1) LOCAL API — true in-place PUT for entity_links.
//    No delete/recreate and no schema change.
// ============================================================================

{
  let text = read(files.localApi);

  if (!text.includes('// editEntityLinkV3')) {
    const anchor =
      "  if (match && method === 'DELETE') {\n" +
      "    await database.runAsync('DELETE FROM entity_links WHERE link_id=?', decodeURIComponent(match[1]!));\n" +
      "    return undefined;\n" +
      "  }\n";

    if (!text.includes(anchor)) {
      fail('localApi entity-links DELETE block changed');
    }

    const putBlock = `  // editEntityLinkV3
  if (match && method === 'PUT') {
    const linkId = decodeURIComponent(match[1]!);
    const existing = await database.getFirstAsync<SqlRow>(
      'SELECT * FROM entity_links WHERE link_id=?',
      linkId,
    );

    if (!existing) {
      throw new LocalApiFailure('Poveznica ne postoji.', 404);
    }

    const payload = parsePayload<{
      relationType: RelationType;
      note?: string | null;
    }>(options);

    const relationType =
      payload.relationType ?? String(existing.relation_type) as RelationType;
    const note = payload.note?.trim() || null;
    const modifiedAt = nowIso();

    try {
      await database.runAsync(
        \`UPDATE entity_links
         SET relation_type=?, note=?, modified_at=?
         WHERE link_id=?\`,
        relationType,
        note,
        modifiedAt,
        linkId,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes('unique')
      ) {
        throw new LocalApiFailure(
          'Takva poveznica već postoji.',
          409,
        );
      }
      throw error;
    }

    const updated = await database.getFirstAsync<SqlRow>(
      'SELECT * FROM entity_links WHERE link_id=?',
      linkId,
    );

    return localLinkResponse(database, updated!);
  }

`;

    text = text.replace(anchor, putBlock + anchor);
    write(files.localApi, text);
  }
}

// ============================================================================
// 2) API SERVICES
// ============================================================================

{
  let text = read(files.collectionApi);

  if (!text.includes('updateLink:')) {
    const anchor = '  removeLink: (linkId: string) =>';

    const addition = `  updateLink: (
    linkId: string,
    payload: {
      relationType: RelationType;
      note?: string | null;
    },
  ) =>
    apiRequest<EntityLink>(
      \`/entity-links/\${query(linkId)}\`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    ),

`;

    text = insertBefore(
      text,
      anchor,
      addition,
      'collectionApi removeLink',
    );

    write(files.collectionApi, text);
  }
}

{
  let text = read(files.entityLinksApi);

  if (!text.includes('  update(')) {
    const anchor = '  remove(linkId: string) {';

    const addition = `  update(
    linkId: string,
    request: {
      relationType: RelationType;
      note?: string | null;
    },
  ) {
    return apiRequest<EntityLink>(
      '/entity-links/' +
        encodeURIComponent(linkId),
      {
        method: 'PUT',
        body: JSON.stringify(request),
      },
    );
  },

`;

    text = insertBefore(
      text,
      anchor,
      addition,
      'entityLinksApi remove',
    );

    write(files.entityLinksApi, text);
  }
}

// ============================================================================
// 3) GENERIC ENTITY RELATIONS PANEL
// ============================================================================

{
  let text = read(files.relations);

  if (!text.includes('const [editingLink, setEditingLink]')) {
    const stateAnchor =
      "  const [deletingLink, setDeletingLink] = useState<string | null>(null);";

    if (!text.includes(stateAnchor)) {
      fail('EntityRelationsPanel deletingLink state changed');
    }

    text = text.replace(
      stateAnchor,
      stateAnchor +
        "\n  const [editingLink, setEditingLink] = useState<EntityLink | null>(null);",
    );
  }

  if (!text.includes('const beginEditLink =')) {
    const anchor = '  const removeLink = async';

    const handler = `  const beginEditLink = (link: EntityLink) => {
    const target = otherSide(link);
    setEditingLink(link);
    setSelected(target);
    setRelationType(link.relationType);
    setNote(link.note ?? '');
    setSearch('');
    setReferences([]);
    setError(null);
    setLinkModal(true);
  };

`;

    // otherSide is declared later in the old source, so referring to it here
    // would hit temporal ordering at runtime only when invoked after render,
    // which is safe, but TypeScript may flag block scope use-before-declare.
    // Instead insert after otherSide declaration.
    const otherSideAnchor =
      '  const otherSide = (link: EntityLink) =>';

    const otherIndex = text.indexOf(otherSideAnchor);
    if (otherIndex < 0) fail('EntityRelationsPanel otherSide changed');

    const semicolonIndex = text.indexOf(';', otherIndex);
    if (semicolonIndex < 0) fail('EntityRelationsPanel otherSide terminator missing');

    const insertAt = semicolonIndex + 1;
    text =
      text.slice(0, insertAt) +
      '\n\n' +
      handler +
      text.slice(insertAt);
  }

  // Reset edit state whenever new-link flow opens.
  text = text.replace(
    /const openLinks = async \(\) => \{\n/,
    `const openLinks = async () => {
    setEditingLink(null);
`,
  );

  // Reset edit state when modal closes through the visible back button and onRequestClose.
  text = text.replace(
    /setLinkModal\(false\); setSelected\(null\); setSearch\(''\);/g,
    "setLinkModal(false); setEditingLink(null); setSelected(null); setSearch('');",
  );

  // Upgrade saveLink to PUT when editing.
  if (!text.includes('editingLink\n        ? await collectionApi.updateLink')) {
    const createCallRe =
      /const created = await collectionApi\.createLink\(\{[\s\S]*?\n\s*\}\);\n\s*setLinks\(\(current\) => \[created, \.\.\.current\]\);/;

    const match = createCallRe.exec(text);

    if (!match) {
      fail('EntityRelationsPanel createLink block changed');
    }

    const replacement = `const created = editingLink
        ? await collectionApi.updateLink(
            editingLink.linkId,
            {
              relationType,
              note: note.trim() || null,
            },
          )
        : await collectionApi.createLink({
            sourceType: entityType,
            sourceId: entityId,
            targetType: selected.entityType,
            targetId: selected.entityId,
            relationType,
            note: note.trim() || null,
          });

      setLinks((current) =>
        editingLink
          ? current.map((link) =>
              link.linkId === created.linkId
                ? created
                : link,
            )
          : [created, ...current],
      );`;

    text = text.replace(createCallRe, replacement);
  }

  // Ensure state reset after successful save.
  text = text.replace(
    /setLinkModal\(false\);\n(\s*)setSelected\(null\);/,
    "setLinkModal(false);\n$1setEditingLink(null);\n$1setSelected(null);",
  );

  // Add edit button just before unlink button.
  if (!text.includes('void beginEditLink(link)')) {
    const unlinkNeedle =
      '<Pressable disabled={deletingLink === link.linkId}';

    const index = text.indexOf(unlinkNeedle);

    if (index < 0) {
      fail('EntityRelationsPanel unlink Pressable changed');
    }

    const editButton = `<Pressable
                accessibilityLabel="Uredi poveznicu"
                accessibilityRole="button"
                onPress={() => void beginEditLink(link)}
                style={({ pressed }) => [
                  styles.editLinkButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.editLinkText}>•••</Text>
              </Pressable>
              `;

    text =
      text.slice(0, index) +
      editButton +
      text.slice(index);
  }

  // Header label.
  text = text.replace(
    '<Text style={styles.modalKicker}>Nova poveznica</Text>',
    `<Text style={styles.modalKicker}>
                {editingLink ? 'Uredi poveznicu' : 'Nova poveznica'}
              </Text>`,
  );

  // When editing, target is locked. Replace selected reference UI's change behavior.
  text = text.replace(
    /<Pressable onPress=\{\(\) => setSelected\(null\)\} style=\{styles\.selectedReference\}>/,
    `<Pressable
                  disabled={Boolean(editingLink)}
                  onPress={() => {
                    if (!editingLink) setSelected(null);
                  }}
                  style={[
                    styles.selectedReference,
                    editingLink && styles.selectedReferenceLocked,
                  ]}
                >`,
  );

  // Save button label.
  text = text.replace(
    /<Text style=\{styles\.saveLinkText\}>Spremi poveznicu<\/Text>/,
    `<Text style={styles.saveLinkText}>
                  {editingLink ? 'Spremi promjene' : 'Spremi poveznicu'}
                </Text>`,
  );

  if (!text.includes('  editLinkButton:')) {
    text = insertStyleBefore(
      text,
      'unlinkButton',
      `  editLinkButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.fill,
  },
  editLinkText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
`,
    );
  }

  if (!text.includes('  selectedReferenceLocked:')) {
    text = insertStyleBefore(
      text,
      'selectedCopy',
      `  selectedReferenceLocked: {
    opacity: 1,
  },
`,
    );
  }

  if (!text.includes('// editExistingConnectionV3')) {
    const marker = 'export function EntityRelationsPanel';
    text = text.replace(
      marker,
      '// editExistingConnectionV3\n' + marker,
    );
  }

  write(files.relations, text);
}

// ============================================================================
// 4) FREQUENCY LINKS PANEL
// ============================================================================

{
  let text = read(files.frequency);

  if (!text.includes('const [editingLink, setEditingLink]')) {
    const stateAnchor =
      "  const [error, setError] = useState<string | null>(null);";

    if (!text.includes(stateAnchor)) {
      fail('FrequencyLinksPanel error state changed');
    }

    text = text.replace(
      stateAnchor,
      stateAnchor +
        "\n  const [editingLink, setEditingLink] = useState<EntityLink | null>(null);",
    );
  }

  if (!text.includes('const edit = (link: EntityLink) =>')) {
    const openAnchor = '  const open = () => {';

    const editHandler = `  const edit = (link: EntityLink) => {
    const target = otherSide(link);
    setEditingLink(link);
    setSelected(target);
    setRelation(link.relationType);
    setNote(link.note ?? '');
    setQuery('');
    setResults([]);
    setError(null);
    setVisible(true);
  };

`;

    text = insertBefore(
      text,
      openAnchor,
      editHandler,
      'FrequencyLinksPanel open handler',
    );
  }

  // New-link open clears editing state.
  text = text.replace(
    /  const open = \(\) => \{\n/,
    `  const open = () => {
    setEditingLink(null);
`,
  );

  // Close clears editing.
  text = text.replace(
    /setVisible\(false\);\n(\s*)setQuery\(''\);/,
    "setVisible(false);\n$1setEditingLink(null);\n$1setQuery('');",
  );

  // connect -> update if editing.
  if (!text.includes('editingLink\n        ? await entityLinksApi.update')) {
    const createCallRe =
      /await entityLinksApi\.create\(\{[\s\S]*?\n\s*\}\);/;

    const match = createCallRe.exec(text);

    if (!match) {
      fail('FrequencyLinksPanel create call changed');
    }

    const replacement = `const saved = editingLink
        ? await entityLinksApi.update(
            editingLink.linkId,
            {
              relationType: relation,
              note: note.trim() || null,
            },
          )
        : await entityLinksApi.create({
            sourceType: 'FREQUENCY',
            sourceId: frequency.trackId,
            targetType: selected.entityType,
            targetId: selected.entityId,
            relationType: relation,
            note: note.trim() || null,
          });

      if (editingLink) {
        setLinks((current) =>
          current.map((link) =>
            link.linkId === saved.linkId
              ? saved
              : link,
          ),
        );
      }`;

    text = text.replace(createCallRe, replacement);
  }

  // Add edit action before unlink.
  if (!text.includes('onPress={() => edit(link)}')) {
    const removeNeedle =
      'onPress={() => void remove(link.linkId)}';

    const pressIndex = text.lastIndexOf('<Pressable', text.indexOf(removeNeedle));
    if (pressIndex < 0) fail('FrequencyLinksPanel unlink Pressable changed');

    const editButton = `<Pressable
                accessibilityLabel="Uredi poveznicu"
                accessibilityRole="button"
                disabled={busy}
                onPress={() => edit(link)}
                style={({ pressed }) => [
                  styles.editLink,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.editLinkText}>•••</Text>
              </Pressable>

              `;

    text =
      text.slice(0, pressIndex) +
      editButton +
      text.slice(pressIndex);
  }

  // Header label.
  text = text.replace(
    '<Text style={styles.sheetEyebrow}>\n                    CREATE CONNECTION\n                  </Text>',
    `<Text style={styles.sheetEyebrow}>
                    {editingLink
                      ? 'EDIT CONNECTION'
                      : 'CREATE CONNECTION'}
                  </Text>`,
  );

  // Selected target cannot be changed while editing.
  text = text.replace(
    /<Pressable\n\s*disabled=\{busy\}\n\s*onPress=\{\(\) => \{\n\s*setSelected\(null\);[\s\S]*?\n\s*\}\}\n\s*style=\{styles\.change\}\n\s*>[\s\S]*?<Text style=\{styles\.changeText\}>Promijeni<\/Text>[\s\S]*?<\/Pressable>/,
    `{editingLink ? (
                      <Text style={styles.lockedTarget}>
                        TARGET LOCKED
                      </Text>
                    ) : (
                      <Pressable
                        disabled={busy}
                        onPress={() => {
                          setSelected(null);
                          setQuery('');
                          setResults([]);
                        }}
                        style={styles.change}
                      >
                        <Text style={styles.changeText}>Promijeni</Text>
                      </Pressable>
                    )}`,
  );

  text = text.replace(
    '<Text style={styles.saveText}>\n                      CREATE CONNECTION\n                    </Text>',
    `<Text style={styles.saveText}>
                      {editingLink
                        ? 'SAVE CHANGES'
                        : 'CREATE CONNECTION'}
                    </Text>`,
  );

  if (!text.includes('  editLink:')) {
    text = insertStyleBefore(
      text,
      'unlink',
      `  editLink: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.fill,
  },
  editLinkText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
`,
    );
  }

  if (!text.includes('  lockedTarget:')) {
    text = insertStyleBefore(
      text,
      'change',
      `  lockedTarget: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
`,
    );
  }

  if (!text.includes('// editExistingConnectionV3')) {
    const marker = 'export function FrequencyLinksPanel';
    text = text.replace(
      marker,
      '// editExistingConnectionV3\n' + marker,
    );
  }

  write(files.frequency, text);
}

console.log('');
console.log('EDIT CONNECTIONS V3 INSTALLED');
console.log('✓ entity_links now support real in-place PUT updates');
console.log('✓ no unlink/relink needed to change relation or note');
console.log('✓ generic Connected rows get a small ••• edit action');
console.log('✓ tap row still navigates to the linked item');
console.log('✓ × still only removes the relationship');
console.log('✓ edit modal locks the target and edits meaning only');
console.log('✓ Frequency Connected rows get the same edit behavior');
console.log('✓ no database migration / schema change');
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
