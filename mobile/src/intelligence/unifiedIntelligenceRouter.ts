// forkK13_1UnifiedIntelligenceRouterV1

import type { LJingleIntent } from './intentRouter';
import { routeLJingleIntent } from './intentRouter';
import type {
  LocalLanguageContext,
  LocalLanguagePlanResult,
} from './languageModel/types';
import {
  isLikelyCompoundLanguage,
  planCompoundLanguage,
} from './languageModel/compoundIntentPlanner';
import { routeWithLocalLanguageModel } from './languageModel/languageRouter';
import {
  completeStructuredLocalLlama,
} from './languageModel/localLlamaProvider';
import {
  looksLikeNaturalCapture,
  parseNaturalCapture,
  type NaturalCaptureContext,
  type ValidatedCapture,
} from './naturalCapture';
import {
  traceEvent,
  type IntelligenceTraceEvent,
} from './intelligenceTrace';

export type UnifiedIntelligenceResult =
  | {
      kind: 'DETERMINISTIC_INTENT';
      intent: LJingleIntent;
      trace: IntelligenceTraceEvent[];
    }
  | {
      kind: 'COMPOUND_PLAN';
      plan: LocalLanguagePlanResult;
      trace: IntelligenceTraceEvent[];
    }
  | {
      kind: 'NATURAL_CAPTURE';
      capture: ValidatedCapture;
      trace: IntelligenceTraceEvent[];
    }
  | {
      kind: 'LANGUAGE_INTENT';
      intent: LJingleIntent;
      trace: IntelligenceTraceEvent[];
    }
  | {
      kind: 'UNRESOLVED';
      trace: IntelligenceTraceEvent[];
    };

export type UnifiedIntelligenceContext = LocalLanguageContext & {
  activeSession?: NaturalCaptureContext['activeSession'];
  lastReferent?: NaturalCaptureContext['lastReferent'];
};

export interface UnifiedRouterOptions {
  /**
   * Useful for unit tests / privacy modes.
   * Deterministic K8 still runs when false.
   */
  allowLocalModel?: boolean;
}

const captureModel = {
  parseNaturalCapture: async ({
    text,
    systemPrompt,
    schema,
    context,
  }: {
    text: string;
    systemPrompt: string;
    schema: unknown;
    context?: unknown;
  }) => completeStructuredLocalLlama(text, systemPrompt, schema, context),
};

/**
 * Canonical K8–K13.1 interpretation path.
 *
 * Ownership rules:
 *  - K8 always gets first refusal.
 *  - obvious compound language belongs to K11; an invalid compound plan does
 *    not silently degrade into a single mutation.
 *  - obvious life/media statements belong to K13 before generic K9.
 *  - K9 handles remaining messy single-action language.
 *  - K10/K12 resolve referents AFTER this function returns.
 */
export async function routeLJingleIntelligence(
  value: string,
  context: UnifiedIntelligenceContext,
  options: UnifiedRouterOptions = {},
): Promise<UnifiedIntelligenceResult> {
  const trace: IntelligenceTraceEvent[] = [];
  const text = value.trim();

  // K8
  {
    const started = Date.now();
    const deterministic = routeLJingleIntent(text);
    trace.push(traceEvent(
      'K8_DETERMINISTIC',
      deterministic ? 'MATCH' : 'MISS',
      started,
      deterministic?.action,
    ));
    if (deterministic) {
      return { kind: 'DETERMINISTIC_INTENT', intent: deterministic, trace };
    }
  }

  if (options.allowLocalModel === false) {
    trace.push({
      stage: 'K9_LANGUAGE',
      outcome: 'SKIPPED',
      detail: 'Local model disabled by caller.',
    });
    return { kind: 'UNRESOLVED', trace };
  }

  // K11 owns utterances that clearly contain several actions.
  if (isLikelyCompoundLanguage(text)) {
    const started = Date.now();
    try {
      const plan = await planCompoundLanguage(text, context);
      if (plan.raw.length >= 2) {
        trace.push(traceEvent(
          'K11_COMPOUND',
          plan.fullyValid ? 'MATCH' : 'REJECTED',
          started,
          plan.fullyValid
            ? String(plan.intents.length) + ' validated child intents'
            : 'Compound-shaped input failed all-child validation',
        ));
        return plan.fullyValid
          ? { kind: 'COMPOUND_PLAN', plan, trace }
          : { kind: 'UNRESOLVED', trace };
      }
      trace.push(traceEvent('K11_COMPOUND', 'MISS', started));
    } catch (error) {
      trace.push(traceEvent(
        'K11_COMPOUND',
        'ERROR',
        started,
        error instanceof Error ? error.message : 'unknown error',
      ));
      return { kind: 'UNRESOLVED', trace };
    }
  } else {
    trace.push({ stage: 'K11_COMPOUND', outcome: 'SKIPPED' });
  }

  // K13 gets semantic ownership of casual capture-shaped statements.
  if (looksLikeNaturalCapture(text)) {
    const started = Date.now();
    try {
      const capture = await parseNaturalCapture(text, captureModel, context);
      trace.push(traceEvent(
        'K13_CAPTURE',
        capture ? 'MATCH' : 'REJECTED',
        started,
        capture ? capture.confidence : 'Capture parser returned null',
      ));
      if (capture) return { kind: 'NATURAL_CAPTURE', capture, trace };

      // Capture-shaped language must not silently become a generic mutation.
      return { kind: 'UNRESOLVED', trace };
    } catch (error) {
      trace.push(traceEvent(
        'K13_CAPTURE',
        'ERROR',
        started,
        error instanceof Error ? error.message : 'unknown error',
      ));
      return { kind: 'UNRESOLVED', trace };
    }
  } else {
    trace.push({ stage: 'K13_CAPTURE', outcome: 'SKIPPED' });
  }

  // K9 generic single-action fallback.
  {
    const started = Date.now();
    try {
      const language = await routeWithLocalLanguageModel(text, context);
      trace.push(traceEvent(
        'K9_LANGUAGE',
        language.intent ? 'MATCH' : 'MISS',
        started,
        language.intent?.action,
      ));
      if (language.intent) {
        return { kind: 'LANGUAGE_INTENT', intent: language.intent, trace };
      }
    } catch (error) {
      trace.push(traceEvent(
        'K9_LANGUAGE',
        'ERROR',
        started,
        error instanceof Error ? error.message : 'unknown error',
      ));
    }
  }

  trace.push({ stage: 'UNRESOLVED', outcome: 'MISS' });
  return { kind: 'UNRESOLVED', trace };
}
