import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';

import {
  activateBridge,
  dismissBridgeMessage,
  getBridgeIdentity,
  getBridgePeerCode,
  listBridgeInbox,
  setBridgePeerCode,
  type BridgeIdentity,
  type BridgeMessage,
} from '../services/bridgeApi';
import {
  addPortableImportsToJingles,
  importPortablePackage,
  type PortableImportResult,
  type PortableJingleCandidate,
} from '../services/portableImport';
import { colors } from '../theme/colors';

function dateLabel(value: string) {
  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '';
  }

  return date.toLocaleString();
}

export function BridgePanel() {
  const navigation = useNavigation<any>();
  const [
    identity,
    setIdentity,
  ] =
    useState<BridgeIdentity | null>(
      null,
    );

  const [
    peerCode,
    setPeerCode,
  ] = useState('');

  const [
    inbox,
    setInbox,
  ] =
    useState<BridgeMessage[]>([]);

  const [
    jingleCandidates,
    setJingleCandidates,
  ] =
    useState<
      PortableJingleCandidate[]
    >([]);

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(null);

  const [
    lastImport,
    setLastImport,
  ] =
    useState<PortableImportResult | null>(
      null,
    );

  const loadLocal =
    async () => {
      const [nextIdentity, peer] =
        await Promise.all([
          getBridgeIdentity(),
          getBridgePeerCode(),
        ]);

      setIdentity(nextIdentity);
      setPeerCode(peer);
    };

  useEffect(() => {
    void loadLocal();
  }, []);

  const shareBridgeCode = async () => {
    if (!identity) return;

    const message =
      'My LJingle Bridge code: ' +
      identity.bridgeId;

    try {
      if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.clipboard
      ) {
        await navigator.clipboard.writeText(
          message,
        );

        setMessage(
          'Bridge code copied.',
        );

        return;
      }

      await Share.share({
        message,
      });
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : 'Bridge code nije podijeljen.',
      );
    }
  };

  const activate =
    async () => {
      if (busy) return;

      setBusy(true);
      setMessage(null);

      try {
        const next =
          await activateBridge();

        setIdentity(next);
        setMessage(
          'Bridge je aktivan.',
        );
      } catch (caught) {
        setMessage(
          caught instanceof Error
            ? caught.message
            : 'Bridge activation failed.',
        );
      } finally {
        setBusy(false);
      }
    };

  const savePeer =
    async () => {
      if (busy) return;

      setBusy(true);
      setMessage(null);

      try {
        const saved =
          await setBridgePeerCode(
            peerCode,
          );

        setPeerCode(saved);

        setMessage(
          'Recipient spremljen.',
        );
      } catch (caught) {
        setMessage(
          caught instanceof Error
            ? caught.message
            : 'Recipient nije spremljen.',
        );
      } finally {
        setBusy(false);
      }
    };

  const refresh =
    async () => {
      if (busy) return;

      setBusy(true);
      setMessage(null);

      try {
        const next =
          await listBridgeInbox();

        setInbox(next);
        setIdentity(
          await getBridgeIdentity(),
        );
      } catch (caught) {
        setMessage(
          caught instanceof Error
            ? caught.message
            : 'Inbox nije dostupan.',
        );
      } finally {
        setBusy(false);
      }
    };

  // bridgeFocusRefreshV1
  useFocusEffect(
    useCallback(() => {
      if (!identity) {
        return;
      }

      let cancelled = false;

      void listBridgeInbox()
        .then((next) => {
          if (!cancelled) {
            setInbox(next);
          }
        })
        .catch((caught) => {
          if (!cancelled) {
            setMessage(
              caught instanceof Error
                ? caught.message
                : 'Inbox nije dostupan.',
            );
          }
        });

      return () => {
        cancelled = true;
      };
    }, [identity?.bridgeId]),
  );

  const openImportedItem = () => {
    if (
      !lastImport?.rootEntityType ||
      !lastImport.rootEntityId
    ) {
      return;
    }

    const type = lastImport.rootEntityType;
    const id = lastImport.rootEntityId;

    if (type === 'BOOK') {
      navigation.navigate('BookDetails', {
        bookId: id,
      });
      return;
    }

    if (type === 'MEDIA') {
      navigation.navigate('Media', {
        screen: 'MediaDetails',
        params: { mediaId: id },
      });
      return;
    }

    if (type === 'GAME') {
      navigation.navigate('Games', {
        screen: 'GameDetails',
        params: { gameId: id },
      });
      return;
    }

    if (type === 'TOPIC') {
      navigation.navigate('TopicDetails', {
        topicId: id,
      });
      return;
    }

    if (type === 'ENTRY') {
      navigation.navigate('EntryForm', {
        entryId: id,
      });
      return;
    }

    if (type === 'COLLECTION') {
      navigation.navigate(
        'CollectionDetails',
        {
          collectionId: id,
        },
      );
      return;
    }

    if (type === 'FREQUENCY') {
      navigation.navigate('MemoryRadio');
    }
  };

  const importMessage =
    async (
      item: BridgeMessage,
    ) => {
      if (busy) return;

      setBusy(true);
      setMessage(null);

      try {
        const result =
          await importPortablePackage(
            item.package,
          );

        setLastImport(result);

        await dismissBridgeMessage(
          item.messageId,
        );

        setInbox(
          (current) =>
            current.filter(
              (candidate) =>
                candidate.messageId !==
                item.messageId,
            ),
        );

        if (
          result.jingleCandidates
            .length
        ) {
          setJingleCandidates(
            result.jingleCandidates,
          );
        }

        setMessage(
          'Imported ' +
            result.imported +
            ' · reused ' +
            result.reused +
            ' · relations ' +
            result.relationships,
        );
      } catch (caught) {
        setMessage(
          caught instanceof Error
            ? caught.message
            : 'Bridge import failed.',
        );
      } finally {
        setBusy(false);
      }
    };

  const dismiss =
    async (
      item: BridgeMessage,
    ) => {
      if (busy) return;

      setBusy(true);

      try {
        await dismissBridgeMessage(
          item.messageId,
        );

        setInbox(
          (current) =>
            current.filter(
              (candidate) =>
                candidate.messageId !==
                item.messageId,
            ),
        );
      } catch (caught) {
        setMessage(
          caught instanceof Error
            ? caught.message
            : 'Message nije maknut.',
        );
      } finally {
        setBusy(false);
      }
    };

  const addJingles =
    async () => {
      if (
        busy ||
        !jingleCandidates.length
      ) {
        return;
      }

      setBusy(true);

      try {
        await addPortableImportsToJingles(
          jingleCandidates,
        );

        setMessage(
          'Dodano u tvoje Jingles.',
        );

        setJingleCandidates([]);
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
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>
            BRIDGE
          </Text>

          <Text style={styles.title}>
            Private handoff
          </Text>

          <Text style={styles.copy}>
            Send a real .ljingle object
            directly to another LJingle.
            Nothing imports automatically.
          </Text>
        </View>

        {busy ? (
          <ActivityIndicator
            color={colors.text}
            size="small"
          />
        ) : null}
      </View>

      {!identity ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() =>
            void activate()
          }
          style={({ pressed }) => [
            styles.primary,
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
        >
          <Text
            style={styles.primaryText}
          >
            ACTIVATE BRIDGE
          </Text>
        </Pressable>
      ) : (
        <>
          <View style={styles.identity}>
            <View style={styles.identityCopy}>
              <Text style={styles.label}>
                YOUR BRIDGE CODE
              </Text>

              <Text style={styles.code}>
                {identity.bridgeId}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                void shareBridgeCode()
              }
              style={({ pressed }) => [
                styles.smallButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.smallButtonText
                }
              >
                SHARE CODE
              </Text>
            </Pressable>
          </View>

          <View style={styles.peer}>
            <Text style={styles.label}>
              RECIPIENT CODE
            </Text>

            <View style={styles.peerRow}>
              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={9}
                onChangeText={
                  setPeerCode
                }
                placeholder="ABCD-EFGH"
                placeholderTextColor={
                  colors.textMuted
                }
                style={styles.input}
                value={peerCode}
              />

              <Pressable
                disabled={busy}
                onPress={() =>
                  void savePeer()
                }
                style={({ pressed }) => [
                  styles.smallButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.smallButtonText
                  }
                >
                  SAVE
                </Text>
              </Pressable>
            </View>

            <Text style={styles.hint}>
              Share glyph → Send via
              Bridge uses this recipient.
            </Text>
          </View>

          <View style={styles.inboxHeader}>
            <View>
              <Text style={styles.label}>
                INBOX
              </Text>

              <Text style={styles.inboxMeta}>
                {inbox.length}{' '}
                waiting
              </Text>
            </View>

            <Pressable
              disabled={busy}
              onPress={() =>
                void refresh()
              }
              style={({ pressed }) => [
                styles.smallButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.smallButtonText
                }
              >
                REFRESH
              </Text>
            </Pressable>
          </View>

          {inbox.map((item) => (
            <View
              key={item.messageId}
              style={styles.messageCard}
            >
              <View style={styles.messageTop}>
                <View
                  style={styles.messageCopy}
                >
                  <Text
                    style={styles.messageKind}
                  >
                    {item.kind}
                  </Text>

                  <Text
                    numberOfLines={2}
                    style={
                      styles.messageTitle
                    }
                  >
                    {item.title}
                  </Text>
                </View>

                <Text
                  style={styles.from}
                >
                  FROM{' '}
                  {item.fromBridgeId}
                </Text>
              </View>

              <Text style={styles.date}>
                {dateLabel(
                  item.createdAt,
                )}
              </Text>

              <View
                style={styles.messageActions}
              >
                <Pressable
                  disabled={busy}
                  onPress={() =>
                    void dismiss(item)
                  }
                  style={({ pressed }) => [
                    styles.secondary,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Text
                    style={
                      styles.secondaryText
                    }
                  >
                    DISMISS
                  </Text>
                </Pressable>

                <Pressable
                  disabled={busy}
                  onPress={() =>
                    void importMessage(
                      item,
                    )
                  }
                  style={({ pressed }) => [
                    styles.importButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Text
                    style={
                      styles.importText
                    }
                  >
                    IMPORT
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}

          {lastImport ? (
            <View style={styles.importResult}>
              <Text style={styles.importResultKicker}>
                {lastImport.imported === 0 &&
                lastImport.reused > 0
                  ? 'ALREADY IN ARCHIVE'
                  : 'BRIDGE IMPORT COMPLETE'}
              </Text>

              <Text style={styles.importResultCounts}>
                Imported {lastImport.imported}
                {'  ✧  '}
                Reused {lastImport.reused}
                {'  ✧  '}
                Relations {lastImport.relationships}
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

          {jingleCandidates.length >
          0 ? (
            <View
              style={
                styles.jinglePrompt
              }
            >
              <View
                style={
                  styles.jingleCopy
                }
              >
                <Text
                  style={
                    styles.jingleTitle
                  }
                >
                  Sender marked{' '}
                  {
                    jingleCandidates.length
                  }{' '}
                  as Jingle
                </Text>

                <Text
                  style={styles.hint}
                >
                  They were not added
                  automatically.
                </Text>
              </View>

              <Pressable
                disabled={busy}
                onPress={() =>
                  void addJingles()
                }
                style={({ pressed }) => [
                  styles.smallButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.smallButtonText
                  }
                >
                  ADD TO MINE
                </Text>
              </Pressable>
            </View>
          ) : null}
        </>
      )}

      {message ? (
        <Text style={styles.status}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 24,
    marginBottom: 18,
    paddingTop: 18,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor:
      colors.separator,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  title: {
    marginTop: 4,
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.25,
  },
  copy: {
    marginTop: 5,
    maxWidth: 560,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
  },
  primary: {
    marginTop: 13,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.black,
  },
  primaryText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  identity: {
    marginTop: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: colors.textMuted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  code: {
    marginTop: 4,
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  smallButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.fill,
  },
  smallButtonText: {
    color: colors.text,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  peer: {
    paddingVertical: 12,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor:
      colors.separator,
  },
  peerRow: {
    marginTop: 7,
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 39,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor:
      colors.separator,
    color: colors.text,
    backgroundColor:
      colors.surface,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  hint: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 13,
  },
  importResult: {
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    backgroundColor: colors.fill,
  },
  importResultKicker: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
  importResultCounts: {
    marginTop: 6,
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
  },
  openImportedButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
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
  inboxHeader: {
    marginTop: 4,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    gap: 12,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor:
      colors.separator,
  },
  inboxMeta: {
    marginTop: 3,
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  messageCard: {
    paddingVertical: 12,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor:
      colors.separator,
  },
  messageTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  messageCopy: {
    flex: 1,
    minWidth: 0,
  },
  messageKind: {
    color: colors.textMuted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  messageTitle: {
    marginTop: 3,
    color: colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  from: {
    color: colors.textMuted,
    fontSize: 7,
    fontWeight: '800',
  },
  date: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 8,
  },
  messageActions: {
    marginTop: 9,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 7,
  },
  secondary: {
    minHeight: 34,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
  },
  importButton: {
    minHeight: 34,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: colors.black,
  },
  importText: {
    color: colors.white,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  jinglePrompt: {
    marginTop: 9,
    paddingTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor:
      colors.separator,
  },
  jingleCopy: {
    flex: 1,
    minWidth: 0,
  },
  jingleTitle: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
  },
  status: {
    marginTop: 9,
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 14,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.68,
  },
});
