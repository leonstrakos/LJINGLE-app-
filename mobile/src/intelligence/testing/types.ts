export type FixtureOwner =
  | 'K8_DETERMINISTIC'
  | 'K11_COMPOUND'
  | 'K13_CAPTURE'
  | 'K9_LANGUAGE'
  | 'UNRESOLVED';

export type FixtureSafety =
  | 'ALLOW'
  | 'CONFIRM'
  | 'REFUSE_MUTATION'
  | 'NO_PARTIAL_EXECUTION';

export interface IntelligenceTestFixture {
  id: string;
  text: string;
  owner: FixtureOwner;
  safety: FixtureSafety;
  tags: string[];
  note?: string;
}

export interface FixtureResult {
  id: string;
  text: string;
  expectedOwner: FixtureOwner;
  actualOwner: FixtureOwner;
  passed: boolean;
  detail?: string;
}
