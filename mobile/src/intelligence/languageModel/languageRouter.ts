// forkK15BrainlessContextualLanguageV1

import type {
  LocalLanguageContext,
  LocalLanguageResult,
} from './types';

import {
  parseDeterministicLanguageIntent,
} from '../deterministicLanguage';

export function shouldAskLocalLanguageModel(
  value: string,
) {
  const clean =
    value.trim();

  if (
    !clean ||
    clean.startsWith('?')
  ) {
    return false;
  }

  // Colon commands belong to Palette parsers.
  if (
    clean.startsWith(':')
  ) {
    return false;
  }

  return clean.length <= 480;
}

/**
 * Compatibility name retained so layered K10-K14 imports do not break.
 * No model is consulted. This resolves synchronously inside an async API.
 */
export async function routeWithLocalLanguageModel(
  value: string,
  context: LocalLanguageContext,
): Promise<LocalLanguageResult> {
  return parseDeterministicLanguageIntent(
    value,
    context,
  );
}
