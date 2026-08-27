// forkK14LocalVoiceInputV2

import type { UnifiedIntelligenceContext } from '../unifiedIntelligenceRouter';
import { routeLJingleIntelligence } from '../unifiedIntelligenceRouter';
import type { VoiceInterpretation, VoiceTranscript } from './types';
import { transcribeLocalAudio } from './localSpeechProvider';

export async function interpretVoiceFile(
  audioPath: string,
  context: UnifiedIntelligenceContext,
  options: { language?: string } = {},
): Promise<VoiceInterpretation> {
  const transcript = await transcribeLocalAudio(audioPath, {
    language: options.language,
    translate: false,
  });

  if (!transcript.text.trim()) {
    throw new Error('No speech was detected.');
  }

  const result = await routeLJingleIntelligence(transcript.text, context);

  return { transcript, result };
}

/**
 * Important UI rule:
 * callers SHOULD preview transcript.text before any confirmation/execution UI.
 * Voice transcription itself never invokes an executor.
 */
export function transcriptNeedsReview(transcript: VoiceTranscript): boolean {
  return !transcript.text.trim() || transcript.text.trim().length < 2;
}
