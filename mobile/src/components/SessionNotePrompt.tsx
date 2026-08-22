import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  saveSessionNote,
  subscribeSessionStopped,
  type SessionStoppedEvent,
} from '../services/sessionNotes';
import { colors } from '../theme/colors';

export function SessionNotePrompt() {
  const [pending, setPending] = useState<SessionStoppedEvent | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return subscribeSessionStopped((event) => {
      setNote('');
      setPending(event);
    });
  }, []);

  const close = () => {
    if (saving) return;
    setPending(null);
    setNote('');
  };

  const save = async () => {
    if (!pending || saving) return;

    const trimmed = note.trim();

    if (!trimmed) {
      close();
      return;
    }

    setSaving(true);

    try {
      await saveSessionNote(pending.sessionId, trimmed);
      setPending(null);
      setNote('');
    } catch {
      Alert.alert(
        'Napomena nije spremljena',
        'Timer je spremljen, ali napomena nije. Poku?aj ponovno.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={close}
      transparent
      visible={pending !== null}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable
          onPress={close}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.card}>
          <Text style={styles.eyebrow}>SESSION ZAVR?EN</Text>

          <Text style={styles.title}>Šta si radio?</Text>

          <Text style={styles.copy}>
            Neobavezno ? kratka bilje?ka koja ?e ostati u Povijesti.
          </Text>

          <TextInput
            autoFocus
            editable={!saving}
            maxLength={240}
            onChangeText={setNote}
            onSubmitEditing={() => void save()}
            placeholder="chapters 4?6, boss fight, research..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            style={styles.input}
            value={note}
          />

          <View style={styles.actions}>
            <Pressable
              disabled={saving}
              onPress={close}
              style={({ pressed }) => [
                styles.skipButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.skipText}>Presko?i</Text>
            </Pressable>

            <Pressable
              disabled={saving}
              onPress={() => void save()}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.pressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.saveText}>Spremi</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  card: {
    width: '100%',
    maxWidth: 430,
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 7,
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  copy: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    marginTop: 18,
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.fill,
    color: colors.text,
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  skipButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  skipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.black,
  },
  saveText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
});
