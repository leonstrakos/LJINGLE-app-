import type { CaptureTimeFact } from "./types";

/**
 * Resolve only coarse dates deterministically.
 * Dayparts remain metadata rather than invented clock times.
 */
export function resolveCaptureDate(
  fact: CaptureTimeFact | undefined,
  now = new Date()
): string | undefined {
  if (!fact) return undefined;
  if (fact.isoDate && /^\d{4}-\d{2}-\d{2}$/.test(fact.isoDate)) return fact.isoDate;

  const d = new Date(now);
  if (fact.relative === "YESTERDAY" || fact.relative === "LAST_NIGHT") {
    d.setDate(d.getDate() - 1);
  } else if (fact.durationAgo) {
    const { value, unit } = fact.durationAgo;
    if (!Number.isFinite(value) || value < 0) return undefined;
    if (unit === "DAY") d.setDate(d.getDate() - value);
    if (unit === "WEEK") d.setDate(d.getDate() - value * 7);
    if (unit === "MONTH") d.setMonth(d.getMonth() - value);
  } else if (
    fact.relative &&
    !["NOW", "TODAY", "THIS_MORNING", "THIS_AFTERNOON", "THIS_EVENING"].includes(fact.relative)
  ) {
    return undefined;
  }

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
