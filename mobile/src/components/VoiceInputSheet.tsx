// forkK14LocalVoiceInputV2

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { UnifiedIntelligenceContext, UnifiedIntelligenceResult } from '../intelligence/unifiedIntelligenceRouter';
import { routeLJingleIntelligence } from '../intelligence/unifiedIntelligenceRouter';

interface Props {
  visible: boolean;
  transcript: string;
  context: UnifiedIntelligenceContext;
  onClose: () => void;
  onInterpretation: (result: UnifiedIntelligenceResult, finalTranscript: string) => void;
}

/**
 * K14.0 transcript review UI.
 * The existing Bell drag-up gesture can feed transcript into this sheet.
 * Bell HOLD remains the existing Home gesture.
 * User may correct STT mistakes before LJingle interprets the text.
 */
export function VoiceInputSheet({
  visible,
  transcript,
  context,
  onClose,
  onInterpretation,
}: Props) {
  const [edited, setEdited] = useState(transcript);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      setEdited(transcript);
      setError(null);
    }
  }, [transcript, visible]);

  const clean = useMemo(() => edited.trim(), [edited]);

  const continueWithTranscript = async () => {
    if (!clean || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await routeLJingleIntelligence(clean, context);
      onInterpretation(result, clean);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Voice interpretation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>VOICE</Text>
          <Text style={styles.title}>I heard</Text>

          <TextInput
            multiline
            value={edited}
            onChangeText={setEdited}
            style={styles.transcript}
            accessibilityLabel="Voice transcript"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.row}>
            <Pressable onPress={onClose} style={styles.secondary}>
              <Text>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={!clean || busy}
              onPress={continueWithTranscript}
              style={[styles.primary, (!clean || busy) && styles.disabled]}
            >
              {busy ? <ActivityIndicator /> : <Text>Use this</Text>}
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
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  card: {
    backgroundColor: 'white',
    padding: 20,
    paddingBottom: 34,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 12,
  },
  eyebrow: { fontSize: 11, letterSpacing: 2, opacity: 0.55 },
  title: { fontSize: 22, fontWeight: '700' },
  transcript: {
    minHeight: 90,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
    borderRadius: 14,
    padding: 14,
    fontSize: 17,
  },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  primary: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, backgroundColor: '#eee' },
  secondary: { paddingHorizontal: 18, paddingVertical: 12 },
  disabled: { opacity: 0.4 },
  error: { fontSize: 13 },
});
