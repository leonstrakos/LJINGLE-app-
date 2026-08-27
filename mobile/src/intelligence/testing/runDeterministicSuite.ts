import {
  routeLJingleIntelligence,
  type UnifiedIntelligenceContext,
} from '../unifiedIntelligenceRouter';
import { INTELLIGENCE_TORTURE_CORPUS } from './corpus';
import type { FixtureResult, FixtureOwner } from './types';

const EMPTY_TEST_CONTEXT: UnifiedIntelligenceContext = {
  activeTimerCount: 0,
  activeTimerLabel: null,
  currentEntity: null,
  currentBook: null,
};

function ownerOf(kind: string): FixtureOwner {
  switch (kind) {
    case 'DETERMINISTIC_INTENT': return 'K8_DETERMINISTIC';
    case 'COMPOUND_PLAN': return 'K11_COMPOUND';
    case 'NATURAL_CAPTURE': return 'K13_CAPTURE';
    case 'LANGUAGE_INTENT': return 'K9_LANGUAGE';
    default: return 'UNRESOLVED';
  }
}

export async function runDeterministicOwnershipSuite(): Promise<FixtureResult[]> {
  const fixtures = INTELLIGENCE_TORTURE_CORPUS.filter(
    f => f.owner === 'K8_DETERMINISTIC' || f.owner === 'UNRESOLVED',
  );
  const results: FixtureResult[] = [];
  for (const fixture of fixtures) {
    const result = await routeLJingleIntelligence(
      fixture.text,
      EMPTY_TEST_CONTEXT,
      { allowLocalModel: false },
    );
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
