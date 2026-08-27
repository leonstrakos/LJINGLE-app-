import { validateNaturalCapture } from "./captureValidator";
import type { ValidatedCapture } from "./types";

/**
 * Provider-neutral boundary. K9's llama.rn provider can implement this without
 * K13 importing native runtime details.
 */
export interface NaturalCaptureModel {
  parseNaturalCapture(input: {
    text: string;
    systemPrompt: string;
    schema: unknown;
    context?: unknown;
  }): Promise<unknown>;
}

export interface NaturalCaptureContext {
  currentEntity?: unknown;
  activeSession?: unknown;
  lastReferent?: unknown;
}

/**
 * Cheap deterministic gate: don't spend model tokens on obvious commands or
 * arbitrary search phrases. This is intentionally permissive for casual facts.
 */
export function looksLikeNaturalCapture(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t || t.length < 5) return false;

  if (/^(open|search|find|add|remove|link|note|page|stop|start)\b/.test(t)) return false;

  return /\b(watched|watching|read|reading|finished|finish|started|listened|listening|episode|episodes|chapter|chapters|pages?|half|yesterday|last\s+night|this\s+morning|this\s+evening|two\s+weeks|jučer|sinoc|sinoć|gledao|gledala|čitao|citao|čitala|procitao|pročitao|zavrsio|završio)\b/.test(t);
}

export async function parseNaturalCapture(
  text: string,
  model: NaturalCaptureModel,
  context: NaturalCaptureContext = {}
): Promise<ValidatedCapture | null> {
  if (!looksLikeNaturalCapture(text)) return null;

  const { NATURAL_CAPTURE_SYSTEM_PROMPT, naturalCaptureJsonSchema } = await import("./capturePrompt");
  const raw = await model.parseNaturalCapture({
    text,
    systemPrompt: NATURAL_CAPTURE_SYSTEM_PROMPT,
    schema: naturalCaptureJsonSchema,
    context: {
      hasCurrentEntity: Boolean(context.currentEntity),
      hasActiveSession: Boolean(context.activeSession),
      hasLastReferent: Boolean(context.lastReferent),
    },
  });

  return validateNaturalCapture(raw, text);
}
