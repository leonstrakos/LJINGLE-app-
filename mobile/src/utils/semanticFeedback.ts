import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { playUiCue, playUiSound } from '../audio/uiFeedback';

// semanticFeedbackV1
//
// Screens describe WHAT happened.
// This module decides HOW that should feel.
//
// Keep feedback intentionally subtle.
// No feature should call expo-haptics directly once integrated.

export type SemanticFeedbackEvent =
  | 'JINGLE'
  | 'COMPLETE'
  | 'TIMER_START'
  | 'TIMER_STOP'
  | 'GESTURE_THRESHOLD'
  | 'RANDOM_PICK'
  | 'UNDO'
  | 'SELECTION'
  | 'ERROR';

let enabled = true;
let lastEventAt = 0;

const MIN_INTERVAL_MS = 45;

export function setSemanticFeedbackEnabled(
  value: boolean,
) {
  enabled = value;
}

export function isSemanticFeedbackEnabled() {
  return enabled;
}

function canPlay() {
  if (!enabled) return false;

  // Web haptics are deliberately disabled.
  if (Platform.OS === 'web') {
    return false;
  }

  const now = Date.now();

  if (now - lastEventAt < MIN_INTERVAL_MS) {
    return false;
  }

  lastEventAt = now;

  return true;
}

export async function playSemanticFeedback(
  event: SemanticFeedbackEvent,
) {
if (!canPlay()) return;

  try {
    switch (event) {
      case 'JINGLE':
        await Haptics.impactAsync(
          Haptics.ImpactFeedbackStyle.Light,
        );
        return;

      case 'COMPLETE':
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        return;

      case 'TIMER_START':
        await Haptics.impactAsync(
          Haptics.ImpactFeedbackStyle.Light,
        );
        return;

      case 'TIMER_STOP':
        await Haptics.impactAsync(
          Haptics.ImpactFeedbackStyle.Medium,
        );
        return;

      case 'GESTURE_THRESHOLD':
        await Haptics.selectionAsync();
        return;

      case 'RANDOM_PICK':
        await Haptics.selectionAsync();
        return;

      case 'UNDO':
        await Haptics.impactAsync(
          Haptics.ImpactFeedbackStyle.Light,
        );
        return;

      case 'SELECTION':
        await Haptics.selectionAsync();
        return;

      case 'ERROR':
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error,
        );
        return;
    }
  } catch {
    // Haptics must never break the actual interaction.
  }
}

export const semanticFeedback = {
  // semanticCrudSoundFinalV1
  create: () => playUiCue('create'),
  delete: () => playUiCue('delete'),
  // jingleActivationSoundV2

  jingle: (active = true) => {

    if (active) {

      void playUiSound('jingle');

    }

    return playSemanticFeedback('JINGLE');

  },

  complete: () =>
    playSemanticFeedback('COMPLETE'),

  timerStart: () =>
    playSemanticFeedback('TIMER_START'),

  timerStop: () =>
    playSemanticFeedback('TIMER_STOP'),

  gestureThreshold: () =>
    playSemanticFeedback(
      'GESTURE_THRESHOLD',
    ),

  randomPick: () =>
    playSemanticFeedback('RANDOM_PICK'),

  undo: () =>
    playSemanticFeedback('UNDO'),

  selection: () =>
    playSemanticFeedback('SELECTION'),

  error: () =>
    playSemanticFeedback('ERROR'),
};
