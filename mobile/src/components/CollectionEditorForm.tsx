// forkFCollectionEditorFormV1
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';

import { colors } from '../theme/colors';
import { CollectionSymbolPicker } from './CollectionSymbolPicker';

type Props = {
  name: string;
  description: string;
  symbol: string;
  saving: boolean;
  submitLabel: string;
  errorMessage?: string | null;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSymbolChange: (value: string) => void;
  onSubmit: () => void;
};

export function CollectionEditorForm({
  name,
  description,
  symbol,
  saving,
  submitLabel,
  errorMessage,
  onNameChange,
  onDescriptionChange,
  onSymbolChange,
  onSubmit,
}: Props) {
  const disabled = !name.trim() || saving;

  return (
    <ScrollView
      contentContainerStyle={styles.form}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <CollectionSymbolPicker
        value={symbol}
        onChange={onSymbolChange}
      />

      <Text style={styles.label}>Naziv</Text>
      <TextInput
        autoCapitalize="sentences"
        value={name}
        onChangeText={onNameChange}
        placeholder="npr. Rainy Night Movies"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />

      <Text style={styles.label}>Opis</Text>
      <TextInput
        value={description}
        onChangeText={onDescriptionChange}
        multiline
        placeholder="Neobavezno"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, styles.textarea]}
      />

      {errorMessage ? (
        <Text style={styles.error}>{errorMessage}</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onSubmit}
        style={({ pressed }) => [
          styles.saveButton,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        {saving ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={styles.saveText}>{submitLabel}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  form: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 42,
  },
  label: {
    marginTop: 18,
    marginBottom: 7,
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 14,
  },
  textarea: {
    minHeight: 108,
    paddingTop: 13,
    textAlignVertical: 'top',
  },
  error: {
    marginTop: 16,
    padding: 11,
    borderRadius: 12,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  saveButton: {
    minHeight: 52,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.black,
  },
  saveText: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '900',
  },
  disabled: { opacity: 0.58 },
  pressed: { opacity: 0.72 },
});
