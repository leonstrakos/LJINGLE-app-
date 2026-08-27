// forkBFrequencyShareSheetV1
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import type { MemoryTrack } from '../types/memoryRadio';
import type { PortableFrequencyShareMode } from '../services/portableExport';

function stop(event: GestureResponderEvent) {
  event.stopPropagation();
}

type Props = {
  visible: boolean;
  frequency: MemoryTrack | null;
  coverUri: string | null;
  busy: boolean;
  status: string | null;
  error: string | null;
  onClose: () => void;
  onChoose: (mode: PortableFrequencyShareMode) => void;
};

const choices: Array<{
  mode: PortableFrequencyShareMode;
  mark: string;
  title: string;
  detail: string;
}> = [
  {
    mode: 'visual',
    mark: '✦',
    title: 'Visual card',
    detail: 'Lijepa kartica za chat, stories ili galeriju',
  },
  {
    mode: 'bridge',
    mark: '⌁',
    title: 'Bridge',
    detail: 'Pošalji cijeli objekt spremljenom Bridge kontaktu',
  },
  {
    mode: 'portable',
    mark: '◇',
    title: '.LJINGLE',
    detail: 'Prenosiva datoteka s vezama i audio objektom',
  },
];

export function FrequencyShareSheet({
  visible,
  frequency,
  coverUri,
  busy,
  status,
  error,
  onClose,
  onChoose,
}: Props) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityLabel="Zatvori share"
        onPress={busy ? undefined : onClose}
        style={styles.backdrop}
      >
        <Pressable onPress={stop} style={styles.sheet}>
          <SafeAreaView edges={['left', 'right', 'bottom']}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>SHARE FROM LJINGLE</Text>
                <Text numberOfLines={2} style={styles.title}>
                  {frequency?.trackTitle ?? 'Frekvencija'}
                </Text>
                <Text numberOfLines={1} style={styles.subtitle}>
                  {frequency?.artist || 'Memory Radio frequency'}
                </Text>
              </View>

              {coverUri ? (
                <Image source={{ uri: coverUri }} style={styles.cover} />
              ) : (
                <View style={styles.signal}>
                  <Text style={styles.signalMark}>♫</Text>
                </View>
              )}
            </View>

            <View style={styles.rule} />

            {choices.map((choice) => (
              <Pressable
                key={choice.mode}
                accessibilityRole="button"
                disabled={busy || !frequency}
                onPress={() => onChoose(choice.mode)}
                style={({ pressed }) => [
                  styles.choice,
                  pressed && styles.pressed,
                  (busy || !frequency) && styles.disabled,
                ]}
              >
                <View style={styles.choiceMark}>
                  <Text style={styles.choiceMarkText}>{choice.mark}</Text>
                </View>
                <View style={styles.choiceCopy}>
                  <Text style={styles.choiceTitle}>{choice.title}</Text>
                  <Text style={styles.choiceDetail}>{choice.detail}</Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </Pressable>
            ))}

            {busy ? (
              <View style={styles.statusRow}>
                <ActivityIndicator color={colors.text} size="small" />
                <Text style={styles.statusText}>Pripremam share…</Text>
              </View>
            ) : error ? (
              <View style={[styles.statusRow, styles.errorStatusRow]}>
                <Text style={styles.errorStatusMark}>!</Text>
                <Text style={styles.errorStatusText}>{error}</Text>
              </View>
            ) : status ? (
              <View style={styles.statusRow}>
                <Text style={styles.statusMark}>✓</Text>
                <Text style={styles.statusText}>{status}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onClose}
              style={({ pressed }) => [
                styles.done,
                pressed && styles.pressed,
                busy && styles.disabled,
              ]}
            >
              <Text style={styles.doneText}>Gotovo</Text>
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.34)',
  },
  sheet: {
    width: '100%',
    maxHeight: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 124,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.surface,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 5,
    color: colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
  },
  cover: {
    width: 78,
    height: 78,
    borderRadius: 18,
    backgroundColor: colors.fill,
  },
  signal: {
    width: 78,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.fill,
  },
  signalMark: { color: colors.text, fontSize: 28, fontWeight: '800' },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator },
  choice: {
    minHeight: 72,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  choiceMark: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.fill,
  },
  choiceMarkText: { color: colors.text, fontSize: 18, fontWeight: '900' },
  choiceCopy: { flex: 1, minWidth: 0, marginLeft: 12 },
  choiceTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  choiceDetail: { marginTop: 3, color: colors.textMuted, fontSize: 10.5, lineHeight: 15 },
  arrow: { marginLeft: 8, color: colors.textMuted, fontSize: 26, fontWeight: '300' },
  statusRow: {
    marginHorizontal: 16,
    marginTop: 13,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 14,
    backgroundColor: colors.fill,
  },
  statusMark: { color: colors.text, fontSize: 14, fontWeight: '900' },
  statusText: { flex: 1, color: colors.text, fontSize: 11, fontWeight: '700' },
  errorStatusRow: { backgroundColor: colors.dangerSoft },
  errorStatusMark: { color: colors.danger, fontSize: 14, fontWeight: '900' },
  errorStatusText: { flex: 1, color: colors.danger, fontSize: 11, fontWeight: '700' },
  done: {
    minHeight: 48,
    margin: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.black,
  },
  doneText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.5 },
});
