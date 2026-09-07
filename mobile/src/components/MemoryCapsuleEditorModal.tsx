// memoryCapsuleBoxedV1
// boxedThemeSafeR4
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


import {
  createMemoryCapsule,
  updateMemoryCapsule,
} from '../services/memoryCapsules';
import {
  activeAccentColor,
  colors,
} from '../theme/colors';
import { themeInkOn } from '../theme/themeColorUtils';
import type { MemoryCapsule } from '../types/memoryCapsule';

type Props = {
  visible: boolean;
  capsule?: MemoryCapsule | null;
  onClose: () => void;
  onSaved: (capsule: MemoryCapsule) => void;
};

function editableDate(value: string | null | undefined) {
  if (!value) return '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${Number(match[3])}.${Number(match[2])}.${match[1]}.`;
}

// ljingleMemoryCapsulePreviewR3
// ljingleMemoryCapsuleTrueSealR8:editor
// ljingleMemoryCapsuleActionContrastR9:editor
export function MemoryCapsuleEditorModal({
  visible,
  capsule = null,
  onClose,
  onSaved,
}: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [openOn, setOpenOn] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle(capsule?.title || '');
    setDescription(capsule?.description || '');
    setOpenOn(editableDate(capsule?.openOn));
    setSaving(false);
    setError(null);
  }, [capsule, visible]);

  const save = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        openOn: openOn.trim() || null,
      };
      const saved = capsule
        ? await updateMemoryCapsule(capsule.capsuleId, payload)
        : await createMemoryCapsule(payload);
      onSaved(saved);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Memory Capsule nije spremljena.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      visible={visible}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.back,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>LJINGLE BOXED</Text>
            <Text style={styles.heading}>
              {capsule ? 'Uredi Memory Capsule' : 'Nova Memory Capsule'}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Naslov</Text>
          <TextInput
            autoFocus={!capsule}
            maxLength={120}
            onChangeText={setTitle}
            placeholder="npr. Za našu godišnjicu"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={title}
          />

          <Text style={styles.label}>Opis</Text>
          <TextInput
            maxLength={1200}
            multiline
            onChangeText={setDescription}
            placeholder="Što je ova kapsula?"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.textarea]}
            textAlignVertical="top"
            value={description}
          />

          <Text style={styles.label}>Otvori na datum · opcionalno</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            onChangeText={setOpenOn}
            placeholder="14.10.2026"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={openOn}
          />
          <Text style={styles.hint}>
            Bez datuma kapsula je spremna za otvaranje odmah. S datumom ostaje zapečaćena do tog dana.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={!title.trim() || saving}
            onPress={() => void save()}
            style={({ pressed }) => [
              styles.save,
              (!title.trim() || saving) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.saveText}>
                {capsule ? 'Spremi' : 'Napravi kapsulu'}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 80,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  back: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  backText: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 38,
  },
  headerCopy: { flex: 1, marginLeft: 4 },
  eyebrow: {
    color: activeAccentColor,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.7,
  },
  heading: {
    marginTop: 3,
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 50,
  },
  sealPreview: {
    minHeight: 136,
    paddingHorizontal: 22,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: activeAccentColor,
    backgroundColor: colors.surface,
  },
  sealStar: {
    color: themeInkOn(activeAccentColor),
    fontSize: 30,
  },
  sealGlyphWrap: {
    width: 82,
    height: 74,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.background,
  },
  sealLabel: {
    marginTop: 2,
    color: activeAccentColor,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  sealCopy: {
    maxWidth: 330,
    marginTop: 7,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  label: {
    marginTop: 20,
    marginBottom: 7,
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  input: {
    minHeight: 52,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  textarea: {
    minHeight: 118,
    paddingTop: 13,
  },
  hint: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 10.5,
    lineHeight: 16,
  },
  error: {
    marginTop: 14,
    padding: 11,
    color: colors.danger,
    borderRadius: 12,
    backgroundColor: colors.dangerSoft,
  },
  save: {
    minHeight: 54,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: activeAccentColor,
  },
  saveText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '900',
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
});
