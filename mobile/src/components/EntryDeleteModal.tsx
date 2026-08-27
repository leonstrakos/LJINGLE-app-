import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import type { Entry } from '../types/entry';

import { celestial, celestialAlpha } from '../theme/celestial';
// forkMCelestialSharedComponentsV1
const celestialMode = activeVisualSkinId === 'classic';

type Props = {
  entry: Entry | null;
  loading: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function EntryDeleteModal({
  entry,
  loading,
  errorMessage,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={loading ? undefined : onCancel}
      transparent
      visible={entry !== null}
    >
      <View style={[styles.backdrop, celestialMode && styles.celestialBackdrop]}>
        <View accessibilityRole="alert" style={[styles.dialog, celestialMode && styles.celestialDialog]}>
          {celestialMode ? <Text style={styles.celestialOrnament}>✦ · ✧ · ✦</Text> : null}
          <View style={[styles.iconCircle, celestialMode && styles.celestialIconCircle]}>
            <Text style={[styles.icon, celestialMode && styles.celestialIcon]}>!</Text>
          </View>
          <Text style={[styles.title, celestialMode && styles.celestialTitle]}>Obrisati zapis?</Text>
          <Text style={[styles.message, celestialMode && styles.celestialMessage]}>
            {entry?.title
              ? `„${entry.title}” bit će trajno uklonjen.`
              : 'Ovaj zapis bit će trajno uklonjen.'}
          </Text>

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                celestialMode && styles.celestialCancelButton,
                pressed && !loading && styles.pressed,
                loading && styles.disabled,
              ]}
            >
              <Text style={[styles.cancelLabel, celestialMode && styles.celestialCancelLabel]}>Odustani</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                styles.confirmButton,
                celestialMode && styles.celestialConfirmButton,
                pressed && !loading && styles.pressed,
                loading && styles.disabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.confirmLabel}>Obriši</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 430,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 22,
    backgroundColor: colors.surface,
    padding: 24,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 12,
  },
  iconCircle: {
    width: 46,
    height: 46,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: colors.dangerSoft,
  },
  icon: {
    color: colors.danger,
    fontSize: 24,
    fontWeight: '700',
  },
  title: {
    marginTop: 16,
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  error: {
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: colors.dangerSoft,
    padding: 10,
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  actions: {
    marginTop: 22,
    flexDirection: 'row',
  },
  button: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    paddingHorizontal: 14,
  },
  cancelButton: {
    marginRight: 10,
    backgroundColor: colors.fillStrong,
  },
  confirmButton: {
    backgroundColor: colors.danger,
  },
  cancelLabel: {
    color: colors.black,
    fontSize: 15,
    fontWeight: '600',
  },
  confirmLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.6,
  },
  celestialBackdrop: { backgroundColor: celestialAlpha(celestial.night, 0.72) },
  celestialDialog: {
    backgroundColor: celestial.night,
    borderColor: celestialAlpha(celestial.gold, 0.64),
    shadowColor: celestial.gold,
    shadowOpacity: 0.15,
  },
  celestialOrnament: {
    alignSelf: 'center',
    marginBottom: 10,
    color: celestial.gold,
    fontSize: 11,
    letterSpacing: 2.2,
  },
  celestialIconCircle: {
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.45),
    backgroundColor: 'rgba(215,0,21,0.12)',
  },
  celestialIcon: { color: '#FF747D' },
  celestialTitle: { color: celestial.ivory },
  celestialMessage: { color: celestialAlpha(celestial.ivory, 0.70) },
  celestialCancelButton: {
    backgroundColor: celestialAlpha(celestial.ivory, 0.06),
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.34),
  },
  celestialConfirmButton: { borderWidth: 1, borderColor: 'rgba(255,116,125,0.46)' },
  celestialCancelLabel: { color: celestial.gold },
});
