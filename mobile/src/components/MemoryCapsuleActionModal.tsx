// ljingleMemoryCapsuleActionContrastR9:modal
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  activeAccentColor,
  colors,
} from '../theme/colors';

type Props = {
  visible: boolean;
  tone: 'accent' | 'danger';
  title: string;
  message: string;
  confirmLabel: string;
  loading: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function MemoryCapsuleActionModal({
  visible,
  tone,
  title,
  message,
  confirmLabel,
  loading,
  errorMessage = null,
  onCancel,
  onConfirm,
}: Props) {
  const danger = tone === 'danger';

  return (
    <Modal
      animationType="fade"
      onRequestClose={loading ? undefined : onCancel}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <View
          pointerEvents="none"
          style={styles.backdrop}
        />

        <View
          accessibilityRole="alert"
          style={styles.dialog}
        >
          <View
            style={[
              styles.mark,
              danger ? styles.markDanger : styles.markAccent,
            ]}
          >
            <Text
              style={[
                styles.markText,
                danger
                  ? styles.markTextDanger
                  : styles.markTextAccent,
              ]}
            >
              {danger ? '!' : '✦'}
            </Text>
          </View>

          <Text style={styles.title}>
            {title}
          </Text>

          <Text style={styles.message}>
            {message}
          </Text>

          {errorMessage ? (
            <Text style={styles.error}>
              {errorMessage}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                pressed && !loading && styles.pressed,
                loading && styles.disabled,
              ]}
            >
              <Text style={styles.cancelText}>
                Odustani
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                danger
                  ? styles.dangerButton
                  : styles.accentButton,
                pressed && !loading && styles.pressed,
                loading && styles.disabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator
                  color={colors.background}
                />
              ) : (
                <Text style={styles.confirmText}>
                  {confirmLabel}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    opacity: 0.86,
  },
  dialog: {
    width: '100%',
    maxWidth: 430,
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
    shadowColor: colors.background,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 12,
  },
  mark: {
    width: 46,
    height: 46,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    borderWidth: 1,
  },
  markAccent: {
    borderColor: activeAccentColor,
    backgroundColor: colors.background,
  },
  markDanger: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  markText: {
    fontSize: 22,
    fontWeight: '900',
  },
  markTextAccent: {
    color: activeAccentColor,
  },
  markTextDanger: {
    color: colors.danger,
  },
  title: {
    marginTop: 14,
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  error: {
    marginTop: 14,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  actions: {
    marginTop: 22,
    flexDirection: 'row',
  },
  button: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  cancelButton: {
    marginRight: 10,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.fillStrong,
  },
  accentButton: {
    backgroundColor: activeAccentColor,
  },
  dangerButton: {
    backgroundColor: colors.danger,
  },
  cancelText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  confirmText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.58,
  },
});
