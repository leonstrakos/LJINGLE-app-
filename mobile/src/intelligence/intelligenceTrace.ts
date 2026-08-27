// forkK13_1UnifiedIntelligenceRouterV1

export type IntelligenceStage =
  | 'K8_DETERMINISTIC'
  | 'K11_COMPOUND'
  | 'K13_CAPTURE'
  | 'K9_LANGUAGE'
  | 'UNRESOLVED';

export interface IntelligenceTraceEvent {
  stage: IntelligenceStage;
  outcome: 'SKIPPED' | 'MATCH' | 'MISS' | 'REJECTED' | 'ERROR';
  detail?: string;
  elapsedMs?: number;
}

export function traceEvent(
  stage: IntelligenceStage,
  outcome: IntelligenceTraceEvent['outcome'],
  startedAt: number,
  detail?: string,
): IntelligenceTraceEvent {
  return {
    stage,
    outcome,
    detail,
    elapsedMs: Math.max(0, Date.now() - startedAt),
  };
}
