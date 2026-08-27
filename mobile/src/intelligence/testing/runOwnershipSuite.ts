import { routeLJingleIntelligence } from '../unifiedIntelligenceRouter';
import { INTELLIGENCE_TORTURE_CORPUS } from './corpus';
import type { FixtureResult, FixtureOwner } from './types';

function ownerOf(kind: string): FixtureOwner {
  switch (kind) {
    case 'DETERMINISTIC_INTENT': return 'K8_DETERMINISTIC';
    case 'COMPOUND_PLAN': return 'K11_COMPOUND';
    case 'NATURAL_CAPTURE': return 'K13_CAPTURE';
    case 'LANGUAGE_INTENT': return 'K9_LANGUAGE';
    default: return 'UNRESOLVED';
  }
}

export async function runFullOwnershipSuite(
  context: Record<string, unknown> = {},
): Promise<FixtureResult[]> {
  const results: FixtureResult[] = [];
  for (const fixture of INTELLIGENCE_TORTURE_CORPUS) {
    const result = await routeLJingleIntelligence(fixture.text, context as any);
    const actualOwner = ownerOf(result.kind);
    results.push({
      id: fixture.id,
      text: fixture.text,
      expectedOwner: fixture.owner,
      actualOwner,
      passed: actualOwner === fixture.owner,
      detail: result.trace.map(t => t.stage + ':' + t.outcome).join(' > '),
    });
  }
  return results;
}
