import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import type { EntryLinkOption } from '../types/entry';

type Props = {
  label: string;
  value: string | null;
  options: EntryLinkOption[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string | null, option?: EntryLinkOption) => void;
};

export function EntryLinkPicker({
  label,
  value,
  options,
  placeholder,
  disabled = false,
  onChange,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.id === value);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('hr');
    if (!normalized) return options;
    return options.filter((option) =>
      `${option.label} ${option.detail ?? ''}`
        .toLocaleLowerCase('hr')
        .includes(normalized),
    );
  }, [options, query]);

  const close = () => {
    setVisible(false);
    setQuery('');
  };

  const choose = (nextValue: string | null, option?: EntryLinkOption) => {
    onChange(nextValue, option);
    close();
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [
          styles.trigger,
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <View style={styles.triggerCopy}>
          <Text numberOfLines={1} style={[styles.triggerLabel, !value && styles.placeholder]}>
            {selected?.label ?? (value ? 'Povezana stavka' : placeholder)}
          </Text>
          {selected?.detail ? (
            <Text numberOfLines={1} style={styles.triggerDetail}>
              {selected.detail}
            </Text>
          ) : null}
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Modal animationType="slide" onRequestClose={close} statusBarTranslucent={false} visible={visible}>
        <SafeAreaView style={styles.modalSafeArea} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalEyebrow}>Neobavezna poveznica</Text>
              <Text style={styles.modalTitle}>{label}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={close}
              style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
            >
              <Text style={styles.doneText}>Gotovo</Text>
            </Pressable>
          </View>

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Pretraži…"
            placeholderTextColor="#98989D"
            style={styles.searchInput}
            value={query}
          />

          <FlatList
            contentContainerStyle={styles.optionList}
            data={filtered}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <Pressable
                accessibilityRole="button"
                onPress={() => choose(null)}
                style={({ pressed }) => [
                  styles.option,
                  value === null && styles.optionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.optionCopy}>
                  <Text style={styles.optionLabel}>Bez poveznice</Text>
                  <Text style={styles.optionDetail}>Ostavi zapis samostalan</Text>
                </View>
                {value === null ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Nema rezultata</Text>
                <Text style={styles.emptyCopy}>Pokušaj s drugim pojmom.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => choose(item.id, item)}
                style={({ pressed }) => [
                  styles.option,
                  item.id === value && styles.optionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.optionCopy}>
                  <Text style={styles.optionLabel}>{item.label}</Text>
                  {item.detail ? <Text style={styles.optionDetail}>{item.detail}</Text> : null}
                </View>
                {item.id === value ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 7,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  trigger: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  triggerCopy: {
    flex: 1,
    minWidth: 0,
  },
  triggerLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  placeholder: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  triggerDetail: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12,
  },
  chevron: {
    marginLeft: 12,
    color: colors.textMuted,
    fontSize: 25,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalEyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  modalTitle: {
    marginTop: 3,
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  doneButton: {
    borderRadius: 12,
    backgroundColor: colors.black,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  doneText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  searchInput: {
    marginHorizontal: 18,
    marginTop: 16,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 15,
  },
  optionList: {
    flexGrow: 1,
    padding: 18,
  },
  option: {
    minHeight: 58,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionSelected: {
    borderColor: colors.black,
    backgroundColor: colors.fill,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
  },
  optionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  optionDetail: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 12,
  },
  check: {
    marginLeft: 12,
    color: colors.black,
    fontSize: 18,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 42,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  emptyCopy: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.5,
  },
});
