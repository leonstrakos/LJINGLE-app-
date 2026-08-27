// forkK15BrainlessContextualLanguageV1

import { Platform } from 'react-native';
import {
  Directory,
  File,
  Paths,
} from 'expo-file-system';

import type {
  LocalLanguageBrainStatus,
} from './types';

const MODEL_NAME =
  'qwen2.5-0.5b-instruct-q4_k_m.gguf';

const PREF_FILE =
  'ljingle-local-language-brain.json';

let cleanupAttempted = false;

function status():
  LocalLanguageBrainStatus {
  return {
    // Compatibility meaning after K15:
    // "enabled/loaded" = deterministic LJingle Intelligence is active.
    enabled: true,
    downloaded: false,
    loaded: true,
    bytes: 0,
    runtime:
      Platform.OS === 'web'
        ? 'web-unavailable'
        : 'native',
    model:
      'LJingle deterministic context',
  };
}

async function purgeLegacyBrain() {
  if (cleanupAttempted) return;

  cleanupAttempted = true;

  if (Platform.OS === 'web') {
    return;
  }

  try {
    const directory =
      new Directory(
        Paths.document,
        'ljingle-intelligence',
      );

    const model =
      new File(
        directory,
        MODEL_NAME,
      );

    if (model.exists) {
      model.delete();
    }
  } catch {
    // Cleanup must never block Palette.
  }

  try {
    const preference =
      new File(
        Paths.document,
        PREF_FILE,
      );

    if (preference.exists) {
      preference.delete();
    }
  } catch {
    // Cleanup must never block Palette.
  }
}

export async function isLocalLanguageBrainEnabled() {
  await purgeLegacyBrain();
  return true;
}

export async function enableLocalLanguageBrain() {
  await purgeLegacyBrain();
  return status();
}

export async function disableLocalLanguageBrain() {
  await purgeLegacyBrain();
  return status();
}

export async function deleteLocalLanguageBrain() {
  await purgeLegacyBrain();
  return status();
}

export async function getLocalLanguageBrainStatus():
  Promise<LocalLanguageBrainStatus> {
  await purgeLegacyBrain();
  return status();
}
