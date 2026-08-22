import { Directory, File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

import { getDatabase } from '../storage/database';
import { hydrateWebAudio, persistWebAudio } from '../audio/webAudioStore';
import type { AttachMemoryTrackRequest, ImportedAudio, MemoryTrack } from '../types/memoryRadio';

type Row = Record<string, string | number | null>;

function id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function safeFilename(name: string) {
  const clean = name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return clean || 'track.mp3';
}

function titleFromFilename(name: string) {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Untitled track';
}

function mapRow(row: Row): MemoryTrack {
  return {
    // memoryRadioUnlinkDeleteV3
    linkId: row.link_id === null ? null : String(row.link_id),
    entryId: row.entry_id === null ? null : String(row.entry_id),
    entryTitle: row.entry_title as string | null,
    entryContent: row.entry_content === null ? null : String(row.entry_content),
    anchorText: row.anchor_text as string | null,
    clipStartSeconds: Number(row.clip_start_seconds ?? 0),
    clipEndSeconds: row.clip_end_seconds === null ? null : Number(row.clip_end_seconds),
    trackId: String(row.track_id),
    trackTitle: String(row.track_title),
    artist: row.artist as string | null,
    fileUri: String(row.file_uri),
    originalName: String(row.original_name),
    mimeType: row.mime_type as string | null,
    waveformSeed: String(row.waveform_seed),
    createdAt: String(row.track_created_at ?? row.created_at),
  };
}

type Database = Awaited<ReturnType<typeof getDatabase>>;

async function writeAtomically(
  database: Database,
  task: (transaction: Database) => Promise<void>,
) {
  if (Platform.OS === 'web') {
    await task(database);
    return;
  }
  await database.withExclusiveTransactionAsync(task);
}

export async function pickLocalAudio(): Promise<ImportedAudio | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  let fileUri = asset.uri;
  let storedFileUri: string | undefined;

  if (Platform.OS === 'web') {
    storedFileUri = await persistWebAudio(asset.uri);
    fileUri = await hydrateWebAudio(storedFileUri);
  } else {
    const directory = new Directory(Paths.document, 'ljingle-audio');
    directory.create({ idempotent: true, intermediates: true });
    const destination = new File(directory, `${Date.now()}-${safeFilename(asset.name)}`);
    new File(asset.uri).copy(destination);
    fileUri = destination.uri;
  }

  return {
    title: titleFromFilename(asset.name),
    artist: '',
    fileUri,
    storedFileUri,
    originalName: asset.name,
    mimeType: asset.mimeType ?? null,
  };
}

export const memoryRadioApi = {
  async getAll() {
    const database = await getDatabase();
    // memoryRadioUnlinkDeleteV3 — frequencies survive unlinking.
    const rows = await database.getAllAsync<Row>(
      `SELECT l.link_id, l.entry_id, l.anchor_text, l.clip_start_seconds,
              l.clip_end_seconds, l.created_at,
              e.title AS entry_title, e.content AS entry_content,
              t.track_id, t.title AS track_title, t.artist, t.file_uri,
              t.original_name, t.mime_type, t.waveform_seed,
              t.created_at AS track_created_at
       FROM audio_tracks t
       LEFT JOIN entry_soundtracks l ON l.link_id = (
         SELECT l2.link_id
         FROM entry_soundtracks l2
         WHERE l2.track_id = t.track_id
         ORDER BY l2.created_at DESC
         LIMIT 1
       )
       LEFT JOIN entries e ON e.entry_id = l.entry_id
       ORDER BY t.created_at DESC`,
    );
    const memories = rows.map(mapRow);
    if (Platform.OS !== 'web') return memories;
    const durableMemories = memories.filter((memory) => !memory.fileUri.startsWith('blob:'));
    return Promise.all(durableMemories.map(async (memory) => ({
      ...memory,
      fileUri: await hydrateWebAudio(memory.fileUri),
    })));
  },

  async attach(request: AttachMemoryTrackRequest) {
    const database = await getDatabase();
    const trackId = id();
    const linkId = id();
    const now = new Date().toISOString();
    await writeAtomically(database, async (transaction) => {
      await transaction.runAsync(
        `INSERT INTO audio_tracks
         (track_id, title, artist, file_uri, original_name, mime_type, waveform_seed, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        trackId,
        request.title.trim() || titleFromFilename(request.originalName),
        request.artist.trim() || null,
        request.storedFileUri ?? request.fileUri,
        request.originalName,
        request.mimeType,
        trackId,
        now,
        now,
      );
      await transaction.runAsync(
        `INSERT INTO entry_soundtracks
         (link_id, entry_id, track_id, anchor_text, clip_start_seconds,
          clip_end_seconds, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        linkId,
        request.entryId,
        trackId,
        request.anchorText?.trim() || null,
        Math.max(0, request.clipStartSeconds ?? 0),
        request.clipEndSeconds ?? null,
        now,
      );
    });
  },

  // memoryRadioUnlinkDeleteV3
  async unlink(linkId: string) {
    const database = await getDatabase();
    await writeAtomically(database, async (transaction) => {
      await transaction.runAsync('DELETE FROM entry_soundtracks WHERE link_id = ?', linkId);
    });
  },

  async linkExisting(request: { trackId: string; entryId: string; anchorText?: string | null }) {
    const database = await getDatabase();
    const linkId = id();
    const now = new Date().toISOString();
    await writeAtomically(database, async (transaction) => {
      // One Memory Radio frequency has one active note link at a time.
      await transaction.runAsync('DELETE FROM entry_soundtracks WHERE track_id = ?', request.trackId);
      await transaction.runAsync(
        `INSERT INTO entry_soundtracks
         (link_id, entry_id, track_id, anchor_text, clip_start_seconds, clip_end_seconds, created_at)
         VALUES (?, ?, ?, ?, 0, NULL, ?)`,
        linkId,
        request.entryId,
        request.trackId,
        request.anchorText?.trim() || null,
        now,
      );
    });
  },

  async deleteTrack(trackId: string) {
    const database = await getDatabase();
    const row = await database.getFirstAsync<Row>(
      'SELECT file_uri FROM audio_tracks WHERE track_id = ?',
      trackId,
    );
    if (!row) return;
    const fileUri = String(row.file_uri);

    await writeAtomically(database, async (transaction) => {
      await transaction.runAsync('DELETE FROM entry_soundtracks WHERE track_id = ?', trackId);
      await transaction.runAsync('DELETE FROM audio_tracks WHERE track_id = ?', trackId);
    });

    // Only delete the app-owned copy. Never touch an arbitrary external URI.
    if (Platform.OS !== 'web' && fileUri.includes('ljingle-audio')) {
      try {
        const file = new File(fileUri);
        if (file.exists) file.delete();
      } catch {
        // DB deletion already succeeded; a stale local file must not resurrect the frequency.
      }
    }
  },

  // Backward-compatible old name: removing a link now means unlink, not data loss.
  async remove(linkId: string) {
    const database = await getDatabase();
    await writeAtomically(database, async (transaction) => {
      await transaction.runAsync('DELETE FROM entry_soundtracks WHERE link_id = ?', linkId);
    });
  },
};
