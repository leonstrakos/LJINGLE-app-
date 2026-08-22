import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

type Props = {
  visible: boolean;
  bookTitle?: string;
  itemTitle?: string;
  title?: string;
  message?: string;
  accessibilityLabel?: string;
  loading: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteConfirmationModal({
  visible, bookTitle, itemTitle, title, message, accessibilityLabel,
  loading, errorMessage, onCancel, onConfirm,
}: Props) {
  const resolvedTitle = itemTitle ?? bookTitle ?? '';
  const dialogTitle = title ?? 'Obrisati knjigu?';
  const dialogMessage = message ?? `Knjiga „${resolvedTitle}” bit će trajno uklonjena.`;

  return (
    <Modal animationType="fade" onRequestClose={loading ? undefined : onCancel} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View accessibilityLabel={accessibilityLabel ?? dialogTitle} accessibilityRole="alert" style={styles.dialog}>
          <View style={styles.iconCircle}><Text style={styles.icon}>!</Text></View>
          <Text style={styles.title}>{dialogTitle}</Text>
          <Text style={styles.message}>{dialogMessage}</Text>
          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" disabled={loading} onPress={onCancel}
              style={({ pressed }) => [styles.button, styles.cancelButton, pressed && !loading && styles.pressed, loading && styles.disabled]}>
              <Text style={styles.cancelLabel}>Odustani</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={loading} onPress={onConfirm}
              style={({ pressed }) => [styles.button, styles.deleteButton, pressed && !loading && styles.pressed, loading && styles.disabled]}>
              {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.deleteLabel}>Obriši</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.42)', padding: 24 },
  dialog: { width: '100%', maxWidth: 430, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator, padding: 24, shadowColor: colors.black, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 18, elevation: 12 },
  iconCircle: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', borderRadius: 23, backgroundColor: colors.dangerSoft },
  icon: { color: colors.danger, fontSize: 24, fontWeight: '700' },
  title: { marginTop: 16, color: colors.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  message: { marginTop: 10, color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  error: { marginTop: 14, borderRadius: 12, backgroundColor: colors.dangerSoft, padding: 10, color: colors.danger, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  actions: { flexDirection: 'row', marginTop: 22 },
  button: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 13, paddingHorizontal: 14 },
  cancelButton: { marginRight: 10, backgroundColor: colors.fillStrong },
  deleteButton: { backgroundColor: colors.danger },
  cancelLabel: { color: colors.black, fontSize: 15, fontWeight: '600' },
  deleteLabel: { color: colors.white, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.6 },
});
