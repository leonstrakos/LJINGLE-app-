// forkK13_1UnifiedIntelligenceRouterV1

export type ExpectedOwner =
  | 'K8_DETERMINISTIC'
  | 'K11_COMPOUND'
  | 'K13_CAPTURE'
  | 'K9_LANGUAGE';

export interface IntelligenceFixture {
  text: string;
  owner: ExpectedOwner;
  note?: string;
}

export const INTELLIGENCE_SEED_FIXTURES: IntelligenceFixture[] = [
  { text: 'page 143', owner: 'K8_DETERMINISTIC' },
  { text: 'stop', owner: 'K8_DETERMINISTIC' },
  { text: 'open dune', owner: 'K8_DETERMINISTIC' },
  { text: 'stranica 208', owner: 'K8_DETERMINISTIC' },

  { text: 'open twin peaks and add it to winter', owner: 'K11_COMPOUND' },
  { text: 'make a note that the ending was weird and put this in winter', owner: 'K11_COMPOUND' },
  { text: 'otvori dune i zapiši da mi je kraj čudan', owner: 'K11_COMPOUND' },

  { text: 'i watched like half of this yesterday', owner: 'K13_CAPTURE' },
  { text: 'finished it last night', owner: 'K13_CAPTURE' },
  { text: 'i watched three episodes yesterday', owner: 'K13_CAPTURE' },
  { text: 'been reading this for about two weeks', owner: 'K13_CAPTURE' },
  { text: 'jučer sam pogledao tri epizode', owner: 'K13_CAPTURE' },
  { text: 'sinoć sam završio ovo', owner: 'K13_CAPTURE' },
  { text: 'pročitao sam otprilike pola', owner: 'K13_CAPTURE' },

  { text: 'put that lynch thing i was looking at in winter', owner: 'K9_LANGUAGE' },
  { text: 'can u start tracking the book im reading', owner: 'K9_LANGUAGE' },
  { text: 'make a note that the ending reminded me of jung', owner: 'K9_LANGUAGE' },
  { text: 'open whatever frequency i had connected to twin peaks', owner: 'K9_LANGUAGE' },
];
