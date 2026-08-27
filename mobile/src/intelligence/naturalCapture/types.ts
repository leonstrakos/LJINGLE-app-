export type CaptureDomain = "READING" | "WATCHING" | "LISTENING" | "GENERIC";

export type CaptureEvent =
  | "STARTED"
  | "PROGRESSED"
  | "FINISHED"
  | "PAUSED"
  | "RESUMED"
  | "EXPERIENCED";

export type Approximation = "EXACT" | "ABOUT" | "AT_LEAST" | "AT_MOST";

export type ProgressFact =
  | { kind: "FRACTION"; value: number; approximation: Approximation }
  | { kind: "PERCENT"; value: number; approximation: Approximation }
  | { kind: "PAGE"; value: number; approximation: Approximation }
  | { kind: "CHAPTER"; value: number; approximation: Approximation }
  | { kind: "EPISODES"; value: number; approximation: Approximation }
  | { kind: "DURATION_MINUTES"; value: number; approximation: Approximation };

export type RelativeTime =
  | "NOW"
  | "TODAY"
  | "YESTERDAY"
  | "LAST_NIGHT"
  | "THIS_MORNING"
  | "THIS_AFTERNOON"
  | "THIS_EVENING"
  | "UNKNOWN";

export interface CaptureTimeFact {
  relative?: RelativeTime;
  isoDate?: string;
  approximate?: boolean;
  durationAgo?: { value: number; unit: "DAY" | "WEEK" | "MONTH" };
}

export interface NaturalCaptureFact {
  kind: "NATURAL_CAPTURE";
  domain: CaptureDomain;
  event: CaptureEvent;
  /** Human phrase only. Never a DB id. */
  subjectQuery?: string;
  /** Lets K10/K12 resolve current/last real entity. */
  targetHint?: "CURRENT_ENTITY" | "ACTIVE_SESSION" | "LAST_REFERENT" | "QUERY";
  progress?: ProgressFact;
  occurredAt?: CaptureTimeFact;
  note?: string;
  sourceText: string;
}

export type CaptureConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface ValidatedCapture {
  fact: NaturalCaptureFact;
  confidence: CaptureConfidence;
  reasons: string[];
}
