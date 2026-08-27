import type {
  NaturalCaptureFact,
  ValidatedCapture,
  ProgressFact,
} from "./types";

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function validProgress(p?: ProgressFact): boolean {
  if (!p) return true;
  if (!finite(p.value) || p.value < 0) return false;
  switch (p.kind) {
    case "FRACTION": return p.value >= 0 && p.value <= 1;
    case "PERCENT": return p.value >= 0 && p.value <= 100;
    case "PAGE":
    case "CHAPTER":
    case "EPISODES":
    case "DURATION_MINUTES":
      return p.value >= 0;
    default:
      return false;
  }
}

export function validateNaturalCapture(raw: unknown, sourceText: string): ValidatedCapture | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as any;

  const domains = new Set(["READING", "WATCHING", "LISTENING", "GENERIC"]);
  const events = new Set(["STARTED", "PROGRESSED", "FINISHED", "PAUSED", "RESUMED", "EXPERIENCED"]);
  const hints = new Set(["CURRENT_ENTITY", "ACTIVE_SESSION", "LAST_REFERENT", "QUERY"]);

  if (!domains.has(r.domain) || !events.has(r.event)) return null;
  if (r.targetHint && !hints.has(r.targetHint)) return null;
  if (r.subjectQuery != null && typeof r.subjectQuery !== "string") return null;
  if (r.note != null && typeof r.note !== "string") return null;
  if (!validProgress(r.progress)) return null;

  // A model is never allowed to smuggle identifiers or executable payloads.
  const forbidden = ["id", "entityId", "dbId", "sql", "querySql", "mutation", "table"];
  for (const key of forbidden) if (Object.prototype.hasOwnProperty.call(r, key)) return null;

  const reasons: string[] = [];
  let confidence: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";

  const hasTarget = Boolean(r.subjectQuery?.trim()) ||
    ["CURRENT_ENTITY", "ACTIVE_SESSION", "LAST_REFERENT"].includes(r.targetHint);
  if (!hasTarget) {
    confidence = "LOW";
    reasons.push("No resolvable target hint.");
  } else if (r.event === "FINISHED" || r.progress) {
    confidence = "HIGH";
    reasons.push("Concrete progress/event fact.");
  } else {
    reasons.push("Valid capture but requires domain/context resolution.");
  }

  return {
    fact: {
      kind: "NATURAL_CAPTURE",
      domain: r.domain,
      event: r.event,
      subjectQuery: r.subjectQuery?.trim() || undefined,
      targetHint: r.targetHint,
      progress: r.progress,
      occurredAt: r.occurredAt,
      note: r.note?.trim() || undefined,
      sourceText,
    },
    confidence,
    reasons,
  };
}
