import type { FixtureResult } from './types';

export interface IntelligenceTestReport {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  failures: FixtureResult[];
}

export function buildReport(results: FixtureResult[]): IntelligenceTestReport {
  const passed = results.filter(r => r.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length ? passed / results.length : 1,
    failures: results.filter(r => !r.passed),
  };
}
