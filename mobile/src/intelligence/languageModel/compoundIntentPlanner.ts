// forkK15BrainlessContextualLanguageV1

import type {
  LJingleIntent,
} from '../intentRouter';

import {
  routeLJingleIntent,
  toContextualVerbIntent,
} from '../intentRouter';

import type {
  LocalLanguageContext,
  LocalLanguagePlanResult,
} from './types';

const JOINERS =
  /(?:[,;]|\b(?:and then|and|then|also|plus|after that|i onda|onda|pa onda|i jos|i još|te onda)\b)/i;

const ACTION_CUES =
  /\b(?:open|otvori|note|remember|zapisi|zapiši|napisi|napiši|add|put|dodaj|stavi|link|connect|linkaj|povezi|poveži|start|begin|pocni|počni|stop|zaustavi|page|stranic|search|find|trazi|traži)\b/gi;

export function isLikelyCompoundLanguage(
  value: string,
) {
  const clean = value.trim();

  if (
    clean.length < 10 ||
    clean.length > 480 ||
    !JOINERS.test(clean)
  ) {
    return false;
  }

  const cues =
    clean.match(ACTION_CUES) ?? [];

  return cues.length >= 2;
}

export function isCompoundChildExecutable(
  intent: LJingleIntent,
) {
  if (intent.action === 'NOTE') return true;
  if (intent.action === 'ADD_TO_COLLECTION') return true;
  if (intent.action === 'OPEN') return true;
  return false;
}

export function compoundPlanCanExecute(
  intents: LJingleIntent[],
) {
  return (
    intents.length >= 2 &&
    intents.length <= 4 &&
    intents.every(
      isCompoundChildExecutable,
    )
  );
}

export function contextualChildren(
  intents: LJingleIntent[],
) {
  return intents.map(
    toContextualVerbIntent,
  );
}

export async function planCompoundLanguage(
  value: string,
  _context: LocalLanguageContext,
): Promise<LocalLanguagePlanResult> {
  if (
    !isLikelyCompoundLanguage(value)
  ) {
    return {
      intents: [],
      raw: [],
      fullyValid: false,
    };
  }

  const parts =
    value
      .split(JOINERS)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 4);

  if (
    parts.length < 2 ||
    parts.length > 4
  ) {
    return {
      intents: [],
      raw: [],
      fullyValid: false,
    };
  }

  // Deliberately conservative:
  // compound execution only accepts K8 children that are independently safe.
  // Natural referential children remain single-command confirmation flows.
  const intents =
    parts.map(
      (part) =>
        routeLJingleIntent(part),
    );

  if (
    intents.some(
      (intent) => !intent,
    )
  ) {
    return {
      intents:
        intents.filter(
          (
            intent,
          ): intent is LJingleIntent =>
            Boolean(intent),
        ),
      raw: [],
      fullyValid: false,
    };
  }

  const valid =
    intents.filter(
      (
        intent,
      ): intent is LJingleIntent =>
        Boolean(intent),
    );

  return {
    intents: valid,
    raw: [],
    fullyValid:
      compoundPlanCanExecute(valid),
  };
}
