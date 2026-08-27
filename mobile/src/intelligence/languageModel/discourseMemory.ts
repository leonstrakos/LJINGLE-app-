// forkK12DiscourseMemoryV1

export type DiscourseEntity = {
  key: string;
  kind: 'BOOK' | 'MEDIA' | 'GAME' | 'TOPIC' | 'ENTRY' | 'FREQUENCY';
  id: string;
  title: string;
};

export type DiscourseAction = {
  action: 'OPEN' | 'NOTE' | 'ADD_TO_COLLECTION' | 'LINK' | 'START_READING' | 'OTHER';
  referentKey: string | null;
  destination: string | null;
  at: number;
};

export type DiscourseState = {
  lastReferent: DiscourseEntity | null;
  recentReferents: DiscourseEntity[];
  lastAction: DiscourseAction | null;
  lastDestination: string | null;
  pendingClarification: string | null;
};

const MAX_RECENT = 4;
const MAX_AGE_MS = 30 * 60 * 1000;

let state: DiscourseState = {
  lastReferent: null,
  recentReferents: [],
  lastAction: null,
  lastDestination: null,
  pendingClarification: null,
};

function freshAction(action: DiscourseAction | null) {
  return action && Date.now() - action.at <= MAX_AGE_MS ? action : null;
}

export function getDiscourseState(): DiscourseState {
  const lastAction = freshAction(state.lastAction);
  if (!lastAction && state.lastAction) {
    state = { ...state, lastAction: null, lastDestination: null, pendingClarification: null };
  }
  return state;
}

export function rememberReferent(entity: DiscourseEntity | null | undefined) {
  if (!entity) return;
  const recentReferents = [entity, ...state.recentReferents.filter(item => item.key !== entity.key)].slice(0, MAX_RECENT);
  state = { ...state, lastReferent: entity, recentReferents };
}

export function rememberAction(input: {
  action: DiscourseAction['action'];
  referent?: DiscourseEntity | null;
  destination?: string | null;
}) {
  if (input.referent) rememberReferent(input.referent);
  state = {
    ...state,
    lastAction: {
      action: input.action,
      referentKey: input.referent?.key ?? state.lastReferent?.key ?? null,
      destination: input.destination?.trim() || null,
      at: Date.now(),
    },
    lastDestination: input.destination?.trim() || state.lastDestination,
    pendingClarification: null,
  };
}

export function setPendingClarification(value: string | null) {
  state = { ...state, pendingClarification: value?.trim() || null };
}

export function clearDiscourseMemory() {
  state = {
    lastReferent: null,
    recentReferents: [],
    lastAction: null,
    lastDestination: null,
    pendingClarification: null,
  };
}

export function isBareDiscoursePronoun(value: string) {
  const clean = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return /^(?:it|this|that|this one|that one|same one|the same one|ovo|to|ono|taj|ta|isti|ista|isto)$/.test(clean);
}

export type DiscourseCorrection = {
  kind: 'COLLECTION_DESTINATION';
  destination: string;
  referentKey: string;
};

/**
 * Narrow deterministic follow-up correction recognizer. It does NOT mutate.
 * K12 only surfaces the remembered interpretation; a future domain-specific
 * transactional editor may implement replacement/removal semantics safely.
 */
export function parseDiscourseCorrection(value: string): DiscourseCorrection | null {
  const current = getDiscourseState();
  const action = current.lastAction;
  const referent = current.lastReferent;
  if (!action || !referent || action.action !== 'ADD_TO_COLLECTION') return null;

  const match = value.trim().match(/^(?:actually|instead|no[, ]+actually|zapravo|ustvari|u stvari|ne[, ]+zapravo)\s+(.{1,80})$/i);
  const destination = match?.[1]?.trim();
  return destination ? { kind: 'COLLECTION_DESTINATION', destination, referentKey: referent.key } : null;
}
