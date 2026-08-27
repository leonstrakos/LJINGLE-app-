// forkFCollectionSymbolPickerV1
// forkLCollectionsMemoryBoxV2
import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors } from '../theme/colors';
import {
  COLLECTION_SYMBOL_GROUPS,
  clampCollectionSymbolInput,
  isCollectionPresetSymbol,
  normalizeCollectionSymbol,
} from '../utils/collectionSymbols';

type Props = {
  value: string;
  onChange: (symbol: string) => void;
};

export function CollectionSymbolPicker({ value, onChange }: Props) {
  const selected = normalizeCollectionSymbol(value);
  const selectedIsPreset = isCollectionPresetSymbol(selected);
  const [customDraft, setCustomDraft] = useState(
    selectedIsPreset ? '' : selected,
  );

  useEffect(() => {
    if (!isCollectionPresetSymbol(selected)) {
      setCustomDraft(selected);
    }
  }, [selected]);

  const updateCustom = (nextValue: string) => {
    const next = clampCollectionSymbolInput(nextValue);
    setCustomDraft(next);

    if (next) {
      onChange(next);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.previewRow}>
        <View style={styles.preview}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={styles.previewText}
          >
            {selected}
          </Text>
        </View>

        <View style={styles.previewCopy}>
          <Text style={styles.previewLabel}>Znak Memory Boxa</Text>
          <Text style={styles.previewHint}>
            Odaberi jedan od 100 glyphova ili upiši do dva znaka / emoji simbola.
          </Text>
        </View>
      </View>

      <View style={styles.customBlock}>
        <View style={styles.customHeader}>
          <Text style={styles.groupLabel}>Vlastiti</Text>
          <Text style={styles.customLimit}>MAX 2</Text>
        </View>

        <TextInput
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={updateCustom}
          onFocus={() => {
            if (selectedIsPreset) setCustomDraft('');
          }}
          placeholder="🦁✨  /  LS  /  07"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.customInput,
            !selectedIsPreset && styles.customInputActive,
          ]}
          value={customDraft}
        />

        <Text style={styles.customHint}>
          Emoji, slova, brojevi i kombinacije rade kao jedan osobni label.
        </Text>
      </View>

      {COLLECTION_SYMBOL_GROUPS.map((group) => (
        <View key={group.label} style={styles.group}>
          <Text style={styles.groupLabel}>{group.label}</Text>

          <View style={styles.grid}>
            {group.symbols.map((symbol) => {
              const active = symbol === selected;

              return (
                <Pressable
                  key={symbol}
                  accessibilityRole="button"
                  accessibilityLabel={`Odaberi simbol ${symbol}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setCustomDraft('');
                    onChange(symbol);
                  }}
                  style={({ pressed }) => [
                    styles.cell,
                    active && styles.cellActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.symbol,
                      active && styles.symbolActive,
                    ]}
                  >
                    {symbol}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  preview: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.fillStrong,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  previewText: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
  },
  previewCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 13,
  },
  previewLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  previewHint: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 10.5,
    lineHeight: 15,
  },
  customBlock: {
    marginTop: 3,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customLimit: {
    color: colors.textMuted,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  customInput: {
    minHeight: 50,
    marginTop: 8,
    paddingHorizontal: 13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 21,
    fontWeight: '700',
  },
  customInputActive: {
    borderColor: colors.text,
  },
  customHint: {
    marginTop: 7,
    color: colors.textMuted,
    fontSize: 9.5,
    lineHeight: 13,
  },
  group: { marginTop: 14 },
  groupLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  grid: {
    marginTop: 7,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  cell: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  cellActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  symbol: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 25,
  },
  symbolActive: { color: colors.white },
  pressed: { opacity: 0.62 },
});
