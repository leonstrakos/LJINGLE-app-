// memoryRadioUnlinkDeleteV3
export type MemoryTrack = {
  linkId: string | null;
  entryId: string | null;
  entryTitle: string | null;
  entryContent: string | null;
  anchorText: string | null;
  clipStartSeconds: number;
  clipEndSeconds: number | null;
  trackId: string;
  trackTitle: string;
  artist: string | null;
  fileUri: string;
  originalName: string;
  mimeType: string | null;
  waveformSeed: string;
  createdAt: string;
};

export type ImportedAudio = {
  title: string;
  artist: string;
  fileUri: string;
  storedFileUri?: string;
  originalName: string;
  mimeType: string | null;
};

export type AttachMemoryTrackRequest = ImportedAudio & {
  entryId: string;
  anchorText?: string | null;
  clipStartSeconds?: number;
  clipEndSeconds?: number | null;
};
