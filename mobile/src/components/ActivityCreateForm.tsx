import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../theme/colors';
import {
  activityTypeLabels,
  activityTypeMarks,
  activityTypes,
  type ActivityType,
} from '../types/topic';

type Props = {
  label: string;
  activityType: ActivityType;
  saving: boolean;
  errorMessage?: string | null;
  onLabelChange: (value: string) => void;
  onTypeChange: (value: ActivityType) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function ActivityCreateForm({
  label,
  activityType,
  saving,
  errorMessage,
  onLabelChange,
  onTypeChange,
  onCancel,
  onSubmit,
}: Props) {
  const disabled = saving || label.trim().length === 0;

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>Nova aktivnost</Text>
          <Text style={styles.heading}>Što želiš pratiti?</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zatvori obrazac"
          disabled={saving}
          hitSlop={10}
          onPress={onCancel}
        >
          <Text style={styles.close}>×</Text>
        </Pressable>
      </View>

      <Text style={styles.fieldLabel}>Naziv aktivnosti</Text>
      <TextInput
        autoCapitalize="sentences"
        autoCorrect
        editable={!saving}
        maxLength={255}
        onChangeText={onLabelChange}
        placeholder="npr. Učiti francuski"
        placeholderTextColor={colors.textMuted}
        returnKeyType="done"
        style={styles.input}
        value={label}
      />

      <Text style={styles.fieldLabel}>Kategorija</Text>
      <View style={styles.typeGrid}>
        {activityTypes.map((type) => {
          const selected = type === activityType;
          return (
            <Pressable
              key={type}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              disabled={saving}
              onPress={() => onTypeChange(type)}
              style={({ pressed }) => [
                styles.typeChip,
                selected && styles.typeChipSelected,
                pressed && styles.typeChipPressed,
              ]}
            >
              <Text style={[styles.typeMark, selected && styles.typeTextSelected]}>
                {activityTypeMarks[type]}
              </Text>
              <Text style={[styles.typeText, selected && styles.typeTextSelected]}>
                {activityTypeLabels[type]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onSubmit}
        style={({ pressed }) => [
          styles.submit,
          pressed && !disabled && styles.submitPressed,
          disabled && styles.submitDisabled,
        ]}
      >
        {saving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.submitText}>Dodaj aktivnost</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 19,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headingCopy: {
    flex: 1,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heading: {
    marginTop: 3,
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  close: {
    color: colors.textMuted,
    fontSize: 28,
    lineHeight: 28,
  },
  fieldLabel: {
    marginTop: 18,
    marginBottom: 7,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    minHeight: 49,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    minHeight: 39,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.background,
  },
  typeChipSelected: {
    borderColor: colors.black,
    backgroundColor: colors.black,
  },
  typeChipPressed: {
    opacity: 0.7,
  },
  typeMark: {
    marginRight: 6,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  typeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  typeTextSelected: {
    color: colors.white,
  },
  error: {
    marginTop: 13,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  submit: {
    minHeight: 50,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.black,
  },
  submitPressed: {
    opacity: 0.8,
  },
  submitDisabled: {
    opacity: 0.45,
  },
  submitText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
