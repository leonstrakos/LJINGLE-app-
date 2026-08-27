export const NATURAL_CAPTURE_SYSTEM_PROMPT = `
You are LJingle's narrow natural-capture parser.

Convert casual statements about reading, watching, listening, or finishing/progressing
media into ONE typed fact. You do not chat. You do not explain. You do not invent
database IDs. You do not execute actions.

Examples:
"I watched like half of this yesterday"
=> WATCHING / PROGRESSED / CURRENT_ENTITY / FRACTION 0.5 ABOUT / YESTERDAY

"finished it last night"
=> GENERIC / FINISHED / LAST_REFERENT / LAST_NIGHT

"been reading this for about two weeks"
=> READING / STARTED / CURRENT_ENTITY / durationAgo 2 WEEK / approximate true

"i watched three episodes yesterday"
=> WATCHING / PROGRESSED / CURRENT_ENTITY / EPISODES 3 EXACT / YESTERDAY

"page 143"
=> NOT for you; deterministic parser owns simple commands.

If the statement is not a life/media capture fact, return null.
`.trim();

export const naturalCaptureJsonSchema = {
  type: ["object", "null"],
  additionalProperties: false,
  properties: {
    domain: { enum: ["READING", "WATCHING", "LISTENING", "GENERIC"] },
    event: { enum: ["STARTED", "PROGRESSED", "FINISHED", "PAUSED", "RESUMED", "EXPERIENCED"] },
    subjectQuery: { type: "string" },
    targetHint: { enum: ["CURRENT_ENTITY", "ACTIVE_SESSION", "LAST_REFERENT", "QUERY"] },
    progress: {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: { enum: ["FRACTION", "PERCENT", "PAGE", "CHAPTER", "EPISODES", "DURATION_MINUTES"] },
        value: { type: "number" },
        approximation: { enum: ["EXACT", "ABOUT", "AT_LEAST", "AT_MOST"] },
      },
      required: ["kind", "value", "approximation"],
    },
    occurredAt: {
      type: "object",
      additionalProperties: false,
      properties: {
        relative: { enum: ["NOW", "TODAY", "YESTERDAY", "LAST_NIGHT", "THIS_MORNING", "THIS_AFTERNOON", "THIS_EVENING", "UNKNOWN"] },
        isoDate: { type: "string" },
        approximate: { type: "boolean" },
        durationAgo: {
          type: "object",
          additionalProperties: false,
          properties: {
            value: { type: "number" },
            unit: { enum: ["DAY", "WEEK", "MONTH"] },
          },
          required: ["value", "unit"],
        },
      },
    },
    note: { type: "string" },
  },
  required: ["domain", "event", "targetHint"],
} as const;
