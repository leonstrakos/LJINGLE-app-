// collectionBigBoxesV1
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { activeAccentColor, colors } from '../theme/colors';
import type { CollectionBigBox } from '../services/collectionBigBoxes';

type Props = {
  box: CollectionBigBox;
  childNames: string[];
  onOpen: () => void;
  onEdit: () => void;
};

export function CollectionBigBoxCard({
  box,
  childNames,
  onOpen,
  onEdit,
}: Props) {
  const count = box.collectionIds.length;
  const preview =
    childNames.length > 0
      ? childNames.slice(0, 3).join(' · ')
      : 'Prazan Big Box — dodaj kolekcije';

  return (
    <View style={styles.shell}>
      <View style={styles.backBack} />
      <View style={styles.back} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={'Otvori Big Box ' + box.name}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.card,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.symbolFrame}>
          <Text allowFontScaling={false} style={styles.symbol}>
            {box.symbol || '▣'}
          </Text>
        </View>

        <View style={styles.copy}>
          <Text style={styles.meta}>
            BIG BOX · {count} {count === 1 ? 'KOLEKCIJA' : 'KOLEKCIJE'}
          </Text>
          <Text numberOfLines={1} style={styles.title}>
            {box.name}
          </Text>
          <Text numberOfLines={2} style={styles.preview}>
            {preview}
          </Text>
          <Text style={styles.open}>Otvori Big Box</Text>
        </View>

        <Text style={styles.arrow}>›</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={'Uredi Big Box ' + box.name}
        hitSlop={8}
        onPress={onEdit}
        style={({ pressed }) => [
          styles.edit,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.editText}>•••</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'relative',
    marginBottom: 18,
    paddingTop: 8,
  },
  backBack: {
    position: 'absolute',
    left: 22,
    right: 22,
    top: 0,
    height: 30,
    borderRadius: 22,
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: colors.separator,
    opacity: 0.48,
  },
  back: {
    position: 'absolute',
    left: 11,
    right: 11,
    top: 4,
    height: 34,
    borderRadius: 22,
    backgroundColor: colors.fillStrong,
    borderWidth: 1,
    borderColor: colors.separator,
    opacity: 0.76,
  },
  card: {
    minHeight: 126,
    padding: 18,
    paddingRight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  symbolFrame: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.fillStrong,
  },
  symbol: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 16,
  },
  meta: {
    color: activeAccentColor,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  title: {
    marginTop: 5,
    color: colors.text,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
  },
  preview: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 11.5,
    lineHeight: 16,
  },
  open: {
    marginTop: 9,
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
  },
  arrow: {
    position: 'absolute',
    right: 22,
    bottom: 20,
    color: colors.textMuted,
    fontSize: 30,
    fontWeight: '300',
  },
  edit: {
    position: 'absolute',
    right: 13,
    top: 16,
    minWidth: 38,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.fillStrong,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  editText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  pressed: { opacity: 0.66 },
});
