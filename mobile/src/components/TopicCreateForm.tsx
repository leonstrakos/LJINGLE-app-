import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../theme/colors';

type Props = {
  name: string;
  description: string;
  saving: boolean;
  errorMessage?: string | null;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function TopicCreateForm({
  name,
  description,
  saving,
  errorMessage,
  onNameChange,
  onDescriptionChange,
  onCancel,
  onSubmit,
}: Props) {
  const disabled = saving || name.trim().length === 0;

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.eyebrow}>Nova tema</Text>
          <Text style={styles.heading}>Daj interesu svoje mjesto</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zatvori obrazac"
          disabled={saving}
          onPress={onCancel}
          hitSlop={10}
        >
          <Text style={styles.close}>×</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Naziv</Text>
      <TextInput
        autoCapitalize="sentences"
        autoCorrect
        editable={!saving}
        maxLength={120}
        onChangeText={onNameChange}
        placeholder="npr. Šah, francuski, Heralds"
        placeholderTextColor={colors.textMuted}
        returnKeyType="next"
        style={styles.input}
        value={name}
      />

      <Text style={styles.label}>Opis · neobavezno</Text>
      <TextInput
        editable={!saving}
        maxLength={1000}
        multiline
        onChangeText={onDescriptionChange}
        placeholder="Što ovdje pratiš?"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, styles.textArea]}
        textAlignVertical="top"
        value={description}
      />

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
          <Text style={styles.submitLabel}>Stvori temu</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
    padding: 18,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
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
    fontSize: 18,
    fontWeight: '800',
  },
  close: {
    color: colors.textMuted,
    fontSize: 28,
    lineHeight: 28,
  },
  label: {
    marginTop: 17,
    marginBottom: 7,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
  },
  textArea: {
    minHeight: 84,
    paddingTop: 13,
  },
  error: {
    marginTop: 12,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  submit: {
    minHeight: 50,
    marginTop: 17,
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
  submitLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
