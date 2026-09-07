import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

import {
  addPortableImportsToJingles,
  importPortablePackage,
  readPortablePackageFile,
  type PortableImportResult,
  type PortablePreview,
} from '../services/portableImport';
import { colors } from '../theme/colors';

function bytesLabel(value: number) {
  if (value < 1024) return value + ' B';

  if (value < 1024 * 1024) {
    return (value / 1024).toFixed(1) + ' KB';
  }

  return (
    (value / (1024 * 1024)).toFixed(1) +
    ' MB'
  );
}

export function PortableImportPanel() {
  const navigation = useNavigation<any>();
  const [preview, setPreview] =
    useState<PortablePreview | null>(null);

  const [lastImport, setLastImport] =
    useState<PortableImportResult | null>(
      null,
    );

  const [busy, setBusy] = useState(false);
  const [message, setMessage] =
    useState<string | null>(null);

  const pick = async () => {
    if (busy) return;

    setBusy(true);
    setMessage(null);
    setLastImport(null);

    try {
      const result =
        await DocumentPicker.getDocumentAsync({
          copyToCacheDirectory: true,
          multiple: false,
          type: [
            'application/json',
            'text/plain',
            'application/octet-stream',
            '*/*',
          ],
        });

      if (result.canceled) return;

      const asset = result.assets[0];

      if (!asset) {
        throw new Error(
          'Nije odabrana datoteka.',
        );
      }

      setPreview(
        await readPortablePackageFile(
          asset.uri,
        ),
      );
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : 'LJingle paket se nije mogao otvoriti.',
      );
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (!preview || busy) return;

    setBusy(true);
    setMessage(null);

    try {
      const result =
        await importPortablePackage(
          preview.pack,
        );

      setLastImport(result);

      setMessage(
        'Uvezeno ' +
          result.imported +
          ' · ponovno korišteno ' +
          result.reused +
          ' · veze ' +
          result.relationships,
      );

      setPreview(null);

      Alert.alert(
        'LJingle import gotov',
        'Paket je dodan u tvoju lokalnu arhivu.',
      );
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : 'Import nije uspio.',
      );
    } finally {
      setBusy(false);
    }
  };

  const openImportedItem = () => {
    if (
      !lastImport?.rootEntityType ||
      !lastImport.rootEntityId
    ) {
      return;
    }

    const entityType =
      lastImport.rootEntityType;
    const entityId =
      lastImport.rootEntityId;

    if (entityType === 'BOOK') {
      navigation.navigate('BookDetails', {
        bookId: entityId,
      });
      return;
    }

    if (entityType === 'MEDIA') {
      navigation.navigate('Media', {
        screen: 'MediaDetails',
        params: {
          mediaId: entityId,
        },
      });
      return;
    }

    if (entityType === 'GAME') {
      navigation.navigate('Games', {
        screen: 'GameDetails',
        params: {
          gameId: entityId,
        },
      });
      return;
    }

    if (entityType === 'TOPIC') {
      navigation.navigate('TopicDetails', {
        topicId: entityId,
      });
      return;
    }

    if (entityType === 'ENTRY') {
      navigation.navigate('EntryForm', {
        entryId: entityId,
      });
      return;
    }

    if (entityType === 'COLLECTION') {
      navigation.navigate(
        'CollectionDetails',
        {
          collectionId: entityId,
        },
      );
      return;
    }

    if (entityType === 'FREQUENCY') {
      navigation.navigate('MemoryRadio');
    }
  };

  const addJingles = async () => {
    if (
      !lastImport?.jingleCandidates.length ||
      busy
    ) {
      return;
    }

    setBusy(true);

    try {
      await addPortableImportsToJingles(
        lastImport.jingleCandidates,
      );

      const count =
        lastImport.jingleCandidates.length;

      setLastImport({
        ...lastImport,
        jingleCandidates: [],
      });

      setMessage(
        count +
          (count === 1
            ? ' stvar dodana je u tvoje Jingles.'
            : ' stvari dodane su u tvoje Jingles.'),
      );
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : 'Jingle status nije spremljen.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.copyColumn}>
          <Text style={styles.title}>
            Import .ljingle
          </Text>

          <Text style={styles.copy}>
            Portable graph object · additive
            import · local-first.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void pick()}
          style={({ pressed }) => [
            styles.pickButton,
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
        >
          {busy && !preview ? (
            <ActivityIndicator
              color={colors.text}
              size="small"
            />
          ) : (
            <Text
              style={styles.pickButtonText}
            >
              ODABERI
            </Text>
          )}
        </Pressable>
      </View>

      {preview ? (
        <View style={styles.preview}>
          <View style={styles.archiveRail}>
            <Text style={styles.railMark}>
              LJ
            </Text>
          </View>

          <View style={styles.previewBody}>
            <View style={styles.previewTop}>
              <View style={styles.previewCopy}>
                <Text
                  style={styles.previewKicker}
                >
                  {preview.pack.kind} · LJINGLE PORTABLE
                </Text>

                <Text
                  numberOfLines={2}
                  style={styles.previewTitle}
                >
                  {preview.pack.title}
                </Text>
              </View>

              <Text style={styles.previewSize}>
                {bytesLabel(
                  preview.embeddedBytes,
                )}
              </Text>
            </View>

            <Text style={styles.meta}>
              {preview.pack.objects.length}{' '}
              objects ·{' '}
              {
                preview.pack.relationships
                  .length
              }{' '}
              relations · {preview.imageCount}{' '}
              images · {preview.audioCount}{' '}
              audio
            </Text>

            {preview.pack.provenance ? (
              <View style={styles.provenanceRow}>
                <Text style={styles.provenanceDot}>
                  ◉
                </Text>

                <Text style={styles.provenance}>
                  Stable provenance · directed graph
                </Text>
              </View>
            ) : null}

            {preview.duplicateCount > 0 ? (
              <Text
                style={styles.duplicateNotice}
              >
                {
                  preview.duplicateCount
                }{' '}
                already recognized locally —
                these will be reused.
              </Text>
            ) : null}

            {preview.visualEdges.length >
            0 ? (
              <View style={styles.graph}>
                <Text style={styles.graphLabel}>
                  CONNECTIONS
                </Text>

                {preview.visualEdges.map(
                  (edge, index) => (
                    <View
                      key={
                        edge.marker +
                        ':' +
                        edge.otherKind +
                        ':' +
                        edge.otherTitle +
                        ':' +
                        index
                      }
                      style={styles.edge}
                    >
                      <Text
                        style={styles.edgeMarker}
                      >
                        {edge.marker}
                      </Text>

                      <View
                        style={styles.edgeCopy}
                      >
                        <Text
                          numberOfLines={1}
                          style={
                            styles.edgeTitle
                          }
                        >
                          {edge.otherTitle}
                        </Text>

                        <Text
                          numberOfLines={1}
                          style={
                            styles.edgeMeaning
                          }
                        >
                          {edge.label} ·{' '}
                          {edge.otherKind}
                        </Text>

                        {edge.note ? (
                          <Text
                            numberOfLines={2}
                            style={
                              styles.edgeNote
                            }
                          >
                            {edge.note}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ),
                )}
              </View>
            ) : null}

            {preview.senderJingleCount >
            0 ? (
              <Text style={styles.jingleNotice}>
                {
                  preview.senderJingleCount
                }{' '}
                sender Jingle
                {preview.senderJingleCount ===
                1
                  ? ''
                  : 's'}{' '}
                included. They will not be
                added to your Jingles
                automatically.
              </Text>
            ) : null}

            <View
              style={styles.previewActions}
            >
              <Pressable
                disabled={busy}
                onPress={() =>
                  setPreview(null)
                }
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={styles.secondaryText}
                >
                  Odustani
                </Text>
              </Pressable>

              <Pressable
                disabled={busy}
                onPress={() =>
                  void doImport()
                }
                style={({ pressed }) => [
                  styles.importButton,
                  pressed &&
                    styles.pressed,
                  busy && styles.disabled,
                ]}
              >
                {busy ? (
                  <ActivityIndicator
                    color={colors.white}
                    size="small"
                  />
                ) : (
                  <Text
                    style={styles.importText}
                  >
                    IMPORTIRAJ
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {lastImport ? (
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

          {lastImport.rootEntityId ? (
            <Pressable
              accessibilityRole="button"
              onPress={openImportedItem}
              style={({ pressed }) => [
                styles.openImportedButton,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.openImportedButtonText
                }
              >
                OPEN IMPORTED ITEM
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {lastImport?.jingleCandidates
        .length ? (
        <View style={styles.jingleAfterImport}>
          <View style={styles.jingleAfterCopy}>
            <Text
              style={styles.jingleAfterTitle}
            >
              Sender marked{' '}
              {
                lastImport
                  .jingleCandidates.length
              }{' '}
              as Jingle
            </Text>

            <Text
              style={styles.jingleAfterMeta}
            >
              Imported safely without changing
              your Jingles.
            </Text>
          </View>

          <Pressable
            disabled={busy}
            onPress={() =>
              void addJingles()
            }
            style={({ pressed }) => [
              styles.addJinglesButton,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
          >
            <Text
              style={styles.addJinglesText}
            >
              ADD TO MY JINGLES
            </Text>
          </Pressable>
        </View>
      ) : null}

      {message ? (
        <Text style={styles.message}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 2,
    marginBottom: 16,
  },
  headerRow: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  copyColumn: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  copy: {
    marginTop: 4,
    maxWidth: 520,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  pickButton: {
    minWidth: 92,
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.fill,
  },
  pickButtonText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  preview: {
    marginTop: 7,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  archiveRail: {
    width: 38,
    paddingTop: 15,
    alignItems: 'center',
    backgroundColor: colors.black,
  },
  railMark: {
    color: colors.onAccent,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  previewBody: {
    flex: 1,
    minWidth: 0,
    padding: 14,
  },
  previewTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  previewCopy: {
    flex: 1,
    minWidth: 0,
  },
  previewKicker: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  previewTitle: {
    marginTop: 4,
    color: colors.text,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.45,
  },
  previewSize: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
  },
  meta: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
  },
  provenanceRow: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  provenanceDot: {
    color: colors.text,
    fontSize: 8,
  },
  provenance: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.25,
  },
  legacy: {
    marginTop: 9,
    color: colors.textMuted,
    fontSize: 9,
  },
  duplicateNotice: {
    marginTop: 10,
    padding: 9,
    borderRadius: 10,
    backgroundColor: colors.fill,
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 14,
  },
  graph: {
    marginTop: 14,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  graphLabel: {
    marginTop: 10,
    marginBottom: 3,
    color: colors.textMuted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1,
  },
  edge: {
    minHeight: 46,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  edgeMarker: {
    minWidth: 31,
    marginTop: 1,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: colors.fill,
    color: colors.textMuted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.45,
    textAlign: 'center',
  },
  edgeCopy: {
    flex: 1,
    minWidth: 0,
  },
  edgeTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  edgeMeaning: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '700',
  },
  edgeNote: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 13,
  },
  jingleNotice: {
    marginTop: 11,
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 14,
  },
  previewActions: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  secondaryButton: {
    minHeight: 38,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  secondaryText: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
  },
  importButton: {
    minWidth: 108,
    minHeight: 38,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: colors.black,
  },
  importText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  importResult: {
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
  openImportedButton: {
    alignSelf: 'flex-start',
    marginTop: 11,
    minHeight: 34,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: colors.black,
  },
  openImportedButtonText: {
    color: colors.white,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  jingleAfterImport: {
    marginTop: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  jingleAfterCopy: {
    flex: 1,
    minWidth: 0,
  },
  jingleAfterTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  jingleAfterMeta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 9,
  },
  addJinglesButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.fill,
  },
  addJinglesText: {
    color: colors.text,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  message: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.7,
  },
});
