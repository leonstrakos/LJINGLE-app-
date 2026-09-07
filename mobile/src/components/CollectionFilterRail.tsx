import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import type { CollectionFilterChip } from '../types/collection';

type Props = {
  chips: CollectionFilterChip[];
  activeCollectionId: string | null;
  onSelect: (collectionId: string | null) => void;
  leftInset?: number;
  topGap?: number;
  bottomGap?: number;
};

// ljingleCollectionChipsR1: shared Memory Box filter rail for every catalogue.
export function CollectionFilterRail({
  chips,
  activeCollectionId,
  onSelect,
  leftInset = 0,
  topGap = 12,
  bottomGap = 10,
}: Props) {
  if (chips.length === 0) return null;

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingLeft: leftInset,
          marginTop: topGap,
          marginBottom: bottomGap,
        },
      ]}
    >
      <View style={styles.headingRow}>
        <Text style={styles.heading}>Kolekcije</Text>
        <Text style={styles.hint}>Memory Box</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.rail}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <Chip
          active={activeCollectionId === null}
          label="Sve"
          symbol="◇"
          onPress={() => onSelect(null)}
        />
        {chips.map((chip) => (
          <Chip
            active={activeCollectionId === chip.collectionId}
            key={chip.collectionId}
            label={chip.name}
            symbol={chip.symbol || '◇'}
            onPress={() => onSelect(chip.collectionId)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function Chip({
  active,
  label,
  symbol,
  onPress,
}: {
  active: boolean;
  label: string;
  symbol: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.pressed,
      ]}
    >
      <Text allowFontScaling={false} style={[styles.symbol, active && styles.textActive]}>
        {symbol}
      </Text>
      <Text numberOfLines={1} style={[styles.label, active && styles.textActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // ljingleMemoryBoxCataloguePillsR1: same visual grammar as catalogue FilterChip.
  // ljingleCompletionSealRemovalFilterSpacingR2:FilterRail
  wrap: { marginTop: 12, marginBottom: 10 },
  headingRow: { marginBottom: 5, flexDirection: 'row', alignItems: 'baseline' },
  heading: { color: colors.text, fontSize: 13, fontWeight: '800' },
  hint: { marginLeft: 8, color: colors.textMuted, fontSize: 10 },
  rail: { gap: 6, paddingRight: 20, paddingBottom: 0},
  chip: {
    minHeight: 28,
    maxWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  chipActive: { borderColor: colors.black, backgroundColor: colors.black },
  symbol: { marginRight: 4, color: colors.black, fontSize: 10, fontWeight: '800' },
  label: { flexShrink: 1, color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  textActive: { color: colors.onAccent },
  pressed: { opacity: 0.7 },
});
