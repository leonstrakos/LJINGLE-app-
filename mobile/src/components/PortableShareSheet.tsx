// sharingSimpleGraphCardV1_1

import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useEffect,
  useState,
} from 'react';

import {
  resolvePortableShareChoice,
  subscribePortableShareSheet,
  type PortableShareChoice,
  type PortableShareRequest,
} from '../services/portableShareUi';

const paper =
  '#F7F2E8';

const navy =
  '#10264A';

const gold =
  '#B88934';

function FileGlyph() {
  return (
    <View style={styles.iconFrame}>
      <View style={styles.fileGlyph}>
        <View style={styles.fileFold} />
        <View style={styles.fileLineOne} />
        <View style={styles.fileLineTwo} />
      </View>
    </View>
  );
}

function BridgeGlyph() {
  return (
    <View style={styles.iconFrame}>
      <View style={styles.bridgeLine} />
      <View
        style={[
          styles.bridgeNode,
          styles.bridgeNodeLeft,
        ]}
      />
      <View
        style={[
          styles.bridgeNode,
          styles.bridgeNodeRight,
        ]}
      />
      <View style={styles.bridgeDrop} />
      <View style={styles.bridgeDot} />
    </View>
  );
}

function GraphGlyph() {
  return (
    <View style={styles.iconFrame}>
      <View style={styles.graphLineHorizontal} />
      <View style={styles.graphLineDiagonal} />
      <View
        style={[
          styles.graphNode,
          styles.graphNodeLeft,
        ]}
      />
      <View
        style={[
          styles.graphNode,
          styles.graphNodeTop,
        ]}
      />
      <View
        style={[
          styles.graphNode,
          styles.graphNodeRight,
        ]}
      />
    </View>
  );
}

function OptionRow({
  title,
  subtitle,
  choice,
}: {
  title: string;
  subtitle: string;
  choice: PortableShareChoice;
}) {
  const icon =
    choice === 'portable'
      ? <FileGlyph />
      : choice === 'bridge'
        ? <BridgeGlyph />
        : <GraphGlyph />;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        resolvePortableShareChoice(
          choice,
        )
      }
      style={({ pressed }) => [
        styles.option,
        pressed &&
          styles.optionPressed,
      ]}
    >
      {icon}

      <View style={styles.optionCopy}>
        <Text style={styles.optionTitle}>
          {title}
        </Text>

        <Text style={styles.optionSubtitle}>
          {subtitle}
        </Text>
      </View>

      <Text style={styles.chevron}>
        ›
      </Text>
    </Pressable>
  );
}

export function PortableShareSheet() {
  const [
    request,
    setRequest,
  ] =
    useState<
      PortableShareRequest |
      null
    >(null);

  useEffect(
    () =>
      subscribePortableShareSheet(
        setRequest,
      ),
    [],
  );

  return (
    <Modal
      transparent
      animationType="fade"
      visible={Boolean(request)}
      onRequestClose={() =>
        resolvePortableShareChoice(
          null,
        )
      }
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={() =>
          resolvePortableShareChoice(
            null,
          )
        }
      >
        <Pressable
          style={styles.card}
          onPress={() => undefined}
        >
          <View style={styles.topRule}>
            <View style={styles.ruleLine} />
            <Text style={styles.ruleMark}>
              +
            </Text>
            <View style={styles.ruleLine} />
          </View>

          <Text style={styles.kicker}>
            SHARE FROM LJINGLE
          </Text>

          <Text style={styles.title}>
            {request?.title ??
              ''}
          </Text>

          <Text style={styles.copy}>
            Odaberi format dijeljenja.
          </Text>

          <View style={styles.options}>
            <OptionRow
              title=".LJINGLE FILE"
              subtitle="Portable file · cijela struktura i veze"
              choice="portable"
            />

            <View style={styles.divider} />

            <OptionRow
              title="BRIDGE · .LJINGLE"
              subtitle="Pošalji isti paket kroz LJingle Bridge"
              choice="bridge"
            />

            <View style={styles.divider} />

            <OptionRow
              title="VISUAL GRAPH · PNG"
              subtitle="Čisti memory graph kao shareable slika"
              choice="visual"
            />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              resolvePortableShareChoice(
                null,
              )
            }
            style={styles.cancel}
          >
            <Text style={styles.cancelText}>
              CANCEL
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles =
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'center',
      padding: 24,
      backgroundColor:
        'rgba(0,0,0,0.72)',
    },

    card: {
      width: '100%',
      maxWidth: 520,
      alignSelf: 'center',
      borderRadius: 22,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor: gold,
      backgroundColor: paper,
      paddingHorizontal: 24,
      paddingTop: 22,
      paddingBottom: 18,
    },

    topRule: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 20,
    },

    ruleLine: {
      width: 42,
      height:
        StyleSheet.hairlineWidth,
      backgroundColor: gold,
    },

    ruleMark: {
      color: gold,
      fontSize: 16,
      lineHeight: 18,
    },

    kicker: {
      color: gold,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 3,
      textAlign: 'center',
    },

    title: {
      marginTop: 10,
      color: navy,
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '600',
      textAlign: 'center',
    },

    copy: {
      marginTop: 7,
      color:
        'rgba(16,38,74,0.58)',
      fontSize: 14,
      textAlign: 'center',
    },

    options: {
      marginTop: 26,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        'rgba(184,137,52,0.55)',
    },

    option: {
      minHeight: 92,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
      paddingVertical: 15,
    },

    optionPressed: {
      opacity: 0.58,
    },

    optionCopy: {
      flex: 1,
      minWidth: 0,
    },

    optionTitle: {
      color: navy,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '800',
      letterSpacing: 1.6,
    },

    optionSubtitle: {
      marginTop: 5,
      color:
        'rgba(16,38,74,0.60)',
      fontSize: 12,
      lineHeight: 17,
    },

    chevron: {
      color: gold,
      fontSize: 27,
      fontWeight: '300',
      lineHeight: 30,
    },

    divider: {
      height:
        StyleSheet.hairlineWidth,
      marginLeft: 70,
      backgroundColor:
        'rgba(184,137,52,0.34)',
    },

    cancel: {
      alignSelf: 'center',
      marginTop: 18,
      paddingHorizontal: 18,
      paddingVertical: 9,
    },

    cancelText: {
      color:
        'rgba(16,38,74,0.58)',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 2,
    },

    iconFrame: {
      width: 52,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },

    fileGlyph: {
      width: 27,
      height: 34,
      borderWidth: 1,
      borderColor: navy,
    },

    fileFold: {
      position: 'absolute',
      top: -1,
      right: -1,
      width: 9,
      height: 9,
      borderLeftWidth: 1,
      borderBottomWidth: 1,
      borderColor: navy,
      backgroundColor: paper,
    },

    fileLineOne: {
      position: 'absolute',
      left: 6,
      right: 6,
      top: 18,
      height: 1,
      backgroundColor: navy,
    },

    fileLineTwo: {
      position: 'absolute',
      left: 6,
      right: 10,
      top: 24,
      height: 1,
      backgroundColor: gold,
    },

    bridgeLine: {
      position: 'absolute',
      width: 34,
      height: 17,
      top: 11,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: navy,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
    },

    bridgeNode: {
      position: 'absolute',
      top: 24,
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: navy,
      backgroundColor: paper,
    },

    bridgeNodeLeft: {
      left: 4,
    },

    bridgeNodeRight: {
      right: 4,
    },

    bridgeDrop: {
      position: 'absolute',
      top: 12,
      width: 1,
      height: 25,
      backgroundColor: navy,
    },

    bridgeDot: {
      position: 'absolute',
      top: 34,
      width: 7,
      height: 7,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: gold,
      backgroundColor: paper,
    },

    graphLineHorizontal: {
      position: 'absolute',
      width: 31,
      height: 1,
      backgroundColor: navy,
      transform: [
        {
          rotate: '15deg',
        },
      ],
    },

    graphLineDiagonal: {
      position: 'absolute',
      width: 27,
      height: 1,
      backgroundColor: navy,
      transform: [
        {
          rotate: '-48deg',
        },
      ],
    },

    graphNode: {
      position: 'absolute',
      width: 9,
      height: 9,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: navy,
      backgroundColor: paper,
    },

    graphNodeLeft: {
      left: 5,
      top: 28,
    },

    graphNodeTop: {
      left: 20,
      top: 7,
    },

    graphNodeRight: {
      right: 5,
      top: 23,
    },
  });
