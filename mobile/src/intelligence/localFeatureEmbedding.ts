// forkKSemanticIndexV1

import type { EmbeddingProvider } from './semanticTypes';

const DIMENSIONS = 256;

function normalizedText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('hr-HR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function addFeature(
  vector: Float32Array,
  feature: string,
  weight: number,
) {
  if (!feature) return;

  const hash = fnv1a(feature);
  const bucket = hash % vector.length;
  const sign = (hash & 0x80000000) === 0 ? 1 : -1;
  vector[bucket] = (vector[bucket] ?? 0) + weight * sign;
}

function normalizeVector(vector: Float32Array) {
  let sum = 0;

  for (const value of vector) {
    sum += value * value;
  }

  const length = Math.sqrt(sum);
  if (!length) return vector;

  for (let index = 0; index < vector.length; index += 1) {
    vector[index] = (vector[index] ?? 0) / length;
  }

  return vector;
}

/**
 * localFeatureEmbeddingV1
 *
 * Zero-dependency local vectorizer used as the FIRST provider for the semantic
 * index infrastructure. It is intentionally not presented as an LLM embedding
 * model: it uses signed feature hashing over words, word pairs and character
 * n-grams. That already gives fuzzy archive retrieval while keeping LJingle
 * completely local/offline.
 *
 * Later we can swap this provider for MiniLM / E5 / llama.cpp embeddings without
 * changing semanticIndex.ts or any UI that consumes semanticSearch().
 */
export const localFeatureEmbeddingProvider: EmbeddingProvider = {
  id: 'local-feature-hash-v1',
  dimensions: DIMENSIONS,

  embed(value: string) {
    const text = normalizedText(value);
    const vector = new Float32Array(DIMENSIONS);

    if (!text) return vector;

    const words = text.split(/\s+/).filter(Boolean);

    for (let index = 0; index < words.length; index += 1) {
      const word = words[index]!;
      addFeature(vector, 'w:' + word, 2.4);

      if (index + 1 < words.length) {
        addFeature(
          vector,
          'b:' + word + '_' + words[index + 1],
          1.25,
        );
      }

      const padded = '^' + word + '$';
      for (let n = 3; n <= 4; n += 1) {
        for (let start = 0; start + n <= padded.length; start += 1) {
          addFeature(
            vector,
            'c' + n + ':' + padded.slice(start, start + n),
            n === 3 ? 0.28 : 0.16,
          );
        }
      }
    }

    return normalizeVector(vector);
  },
};
