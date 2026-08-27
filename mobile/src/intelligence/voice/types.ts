export type VoiceState =
  | 'IDLE'
  | 'PREPARING'
  | 'LISTENING'
  | 'TRANSCRIBING'
  | 'READY'
  | 'ERROR';

export interface VoiceTranscript {
  text: string;
  detectedLanguage?: string;
  durationMs?: number;
}

export interface VoiceInterpretation {
  transcript: VoiceTranscript;
  result: import('../unifiedIntelligenceRouter').UnifiedIntelligenceResult;
}

export interface VoiceStatus {
  state: VoiceState;
  error?: string;
}
