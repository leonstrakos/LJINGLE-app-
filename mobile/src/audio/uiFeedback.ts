import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer } from 'expo-audio';
import { getUiSoundEffectsEnabled } from './uiSoundPreference';

// uiFeedbackFinalV1
// Filenames are now the source of truth:
// app-open.mp3 = app opening
// delete.mp3   = successful delete
// jingle.mp3   = Jingle toggle/event
// create.mp3   = successful create

export type UiCue =
  | 'tap'
  | 'confirm'
  | 'start'
  | 'stop'
  | 'complete'
  | 'open'
  | 'jingle'
  | 'create'
  | 'delete';

let enabled = true;

const players = {
  open: createAudioPlayer(
    require('../assets/ui-sounds/app-open.mp3'),
  ),
  delete: createAudioPlayer(
    require('../assets/ui-sounds/delete.mp3'),
  ),
  jingle: createAudioPlayer(
    require('../assets/ui-sounds/jingle.mp3'),
  ),
  create: createAudioPlayer(
    require('../assets/ui-sounds/create.mp3'),
  ),
};

// uiSoundSingleFireV2
type AudibleUiCue =
  | 'open'
  | 'delete'
  | 'jingle'
  | 'create';

// The trimmed clips are ~1.5–1.9 s.
// Keep every player locked until comfortably after playback should have ended.
// This prevents a background seek from restarting a still-playing clip.
const SOUND_UNLOCK_MS:
  Record<AudibleUiCue, number> = {
  open: 2150,
  create: 1800,
  delete: 2100,
  jingle: 1800,
};

const soundLocked:
  Record<AudibleUiCue, boolean> = {
  open: false,
  delete: false,
  jingle: false,
  create: false,
};

const soundResetTimers:
  Partial<
    Record<
      AudibleUiCue,
      ReturnType<typeof setTimeout>
    >
  > = {};

function isAudibleUiCue(
  cue: UiCue,
): cue is AudibleUiCue {
  return (
    cue === 'open' ||
    cue === 'delete' ||
    cue === 'jingle' ||
    cue === 'create'
  );
}

function scheduleSoundReset(
  cue: AudibleUiCue,
) {
  const previous =
    soundResetTimers[cue];

  if (previous) {
    clearTimeout(previous);
  }

  soundResetTimers[cue] =
    setTimeout(() => {
      const player =
        players[cue];

      // Pause BEFORE seeking. seekTo(0) must never restart an audible clip.
      try {
        player.pause();
      } catch {
        // Player may already be stopped.
      }

      void player
        .seekTo(0)
        .catch(() => {})
        .finally(() => {
          soundLocked[cue] = false;
          delete soundResetTimers[cue];
        });
    }, SOUND_UNLOCK_MS[cue]);
}

// Warm the persistent sound preference cache once.
void getUiSoundEffectsEnabled();


export function setUiFeedbackEnabled(value: boolean) {
  enabled = value;
}

export function isUiFeedbackEnabled() {
  return enabled;
}

async function haptic(cue: UiCue) {
  if (Platform.OS === 'web' && cue === 'open') return;

  switch (cue) {
    case 'tap':
    case 'open':
    case 'jingle':
      await Haptics.selectionAsync();
      return;

    case 'confirm':
    case 'start':
    case 'create':
      await Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Light,
      );
      return;

    case 'stop':
    case 'delete':
      await Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Medium,
      );
      return;

    case 'complete':
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      return;
  }
}

async function sound(cue: UiCue) {
  if (Platform.OS === 'web') return;
  if (!(await getUiSoundEffectsEnabled())) return;

  if (!isAudibleUiCue(cue)) return;

  // One semantic action = one audible event.
  // If the same player is still inside its current clip window,
  // ignore duplicate callers instead of seeking/replaying.
  if (soundLocked[cue]) return;

  soundLocked[cue] = true;

  try {
    players[cue].play();
  } catch {
    soundLocked[cue] = false;
    return;
  }

  scheduleSoundReset(cue);
}

// uiSoundOnlyV2
export async function playUiSound(cue: UiCue) {
  if (!enabled) return;
  if (Platform.OS === 'web') return;

  try {
    await sound(cue);
  } catch {
    // Audio must never block the actual app action.
  }
}

export async function playUiCue(cue: UiCue) {
  if (!enabled) return;

  try {
    await Promise.all([
      haptic(cue),
      sound(cue),
    ]);
  } catch {
    // Feedback must never block the actual app action.
  }
}
