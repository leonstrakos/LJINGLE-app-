// forkK15BrainlessContextualLanguageV1

import { Platform } from 'react-native';

import type {
  LocalLanguageBrainStatus,
  LocalLanguageContext,
  RawModelIntent,
} from './types';

/**
 * K15 compatibility shim.
 * There is deliberately no llama native runtime import in this file.
 */

export async function prepareLocalLlamaModel():
  Promise<null> {
  return null;
}

export async function releaseLocalLlamaModel() {
  return;
}

export async function removeLocalLlamaModel() {
  return;
}

export function localLlamaFileStatus() {
  return {
    downloaded: false,
    bytes: 0,
    loaded: false,
  };
}

export async function completeIntentWithLocalLlama(
  _input: string,
  _appContext: LocalLanguageContext,
): Promise<RawModelIntent | null> {
  return null;
}

export async function completeIntentPlanWithLocalLlama(
  _input: string,
  _appContext: LocalLanguageContext,
): Promise<RawModelIntent[]> {
  return [];
}

export async function completeStructuredLocalLlama(
  _input: string,
  _systemPrompt: string,
  _schema: unknown,
  _appContext: unknown,
): Promise<unknown> {
  return null;
}

export function getNativeLocalLlamaStatus():
  Omit<LocalLanguageBrainStatus, 'enabled'> {
  return {
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
