// forkK9LocalLanguageBrainV1
// forkK10ReferentialResolutionV1

import { semanticSearch } from '../semanticIndex';
import { rankContextCandidates } from '../contextSpine';

export type ResolvableEntity = {
  key: string;
  kind: 'BOOK' | 'MEDIA' | 'GAME' | 'TOPIC' | 'ENTRY' | 'FREQUENCY';
  id: string;
  title: string;
  typeLabel?: string;
  meta?: string;
};

export type ResolutionLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type ReferentCandidate = {
  entity: ResolvableEntity;
  score: number;
  source: 'CURRENT' | 'DISCOURSE' | 'CONTEXT' | 'LEXICAL' | 'SEMANTIC';
};

export type ReferentResolution = {
  query: string;
  level: ResolutionLevel;
  candidates: ReferentCandidate[];
};

function norm(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, ' ').trim();
}

function lexicalScore(query: string, entity: ResolvableEntity) {
  const q = norm(query);
  if (!q) return 0;
  const title = norm(entity.title);
  const hay = norm([entity.title, entity.meta || '', entity.typeLabel || ''].join(' '));
  if (title === q) return 1;
  if (title.startsWith(q) || q.startsWith(title)) return 0.92;
  if (hay.includes(q)) return 0.82;
  const terms = q.split(/\s+/).filter(x => x.length > 2);
  if (!terms.length) return 0;
  const hits = terms.filter(term => hay.includes(term)).length;
  return hits ? Math.min(0.78, 0.3 + (hits / terms.length) * 0.48) : 0;
}

export async function resolveReferent(
  query: string,
  entities: ResolvableEntity[],
  currentEntity: ResolvableEntity | null,
  discourseEntity: ResolvableEntity | null = null,
): Promise<ReferentResolution> {
  const clean = query.trim().replace(/\s+/g, ' ').slice(0, 240);
  if (!clean) return { query: clean, level: 'LOW', candidates: [] };

  const byKey = new Map(entities.map(entity => [entity.key, entity]));
  const scores = new Map<string, ReferentCandidate>();
  const add = (
    entity: ResolvableEntity,
    score: number,
    source: ReferentCandidate['source'],
  ) => {
    const previous = scores.get(entity.key);
    if (!previous || score > previous.score) scores.set(entity.key, { entity, score, source });
  };

  const q = norm(clean);
  const barePronoun = /^(?:this|that|it|this one|that one|same one|the same one|ovo|to|taj|ta|ono|isti|ista|isto|thing|stvar)$/i.test(q);
  if (currentEntity && barePronoun) {
    add(currentEntity, 0.99, 'CURRENT');
  } else if (discourseEntity && barePronoun) {
    add(discourseEntity, 0.97, 'DISCOURSE');
  }

  const contextualCandidates = await rankContextCandidates(
    clean,
    new Set(entities.map(entity => entity.key)),
    8,
  ).catch(() => []);

  for (const contextual of contextualCandidates) {
    const entity = byKey.get(contextual.key);
    if (!entity) continue;

    // Context is allowed to contribute a candidate, but recent context by itself
    // never reaches HIGH. Explicit aliases/topic/location/temporal wording can.
    if (contextual.score >= 0.3) {
      add(entity, contextual.score, 'CONTEXT');
    }
  }

  for (const entity of entities) {
    const score = lexicalScore(clean, entity);
    if (score >= 0.3) add(entity, score, 'LEXICAL');
  }

  try {
    const semantic = await semanticSearch(clean, {
      limit: 6,
      entityTypes: ['BOOK', 'MEDIA', 'GAME', 'TOPIC', 'ENTRY', 'FREQUENCY'],
      minimumScore: 0.12,
    });
    for (const match of semantic) {
      const entity = byKey.get(match.key);
      if (!entity) continue;
      // Semantic scores in LJingle are deliberately usable at low cosine values.
      // Lift them into a resolver confidence scale without pretending they are probabilities.
      const lifted = Math.min(0.9, 0.18 + match.score * 1.7);
      add(entity, lifted, 'SEMANTIC');
    }
  } catch {}

  const candidates = [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const first = candidates[0];
  const second = candidates[1];
  if (!first) return { query: clean, level: 'LOW', candidates };
  const margin = first.score - (second?.score || 0);

  const level: ResolutionLevel =
    first.score >= 0.82 && margin >= 0.08
      ? 'HIGH'
      : first.score >= 0.48 && margin >= 0.04
        ? 'MEDIUM'
        : 'LOW';

  return { query: clean, level, candidates };
}
