// forkKSemanticIndexV1

export type SemanticEntityType =
  | 'BOOK'
  | 'MEDIA'
  | 'GAME'
  | 'TOPIC'
  | 'ENTRY'
  | 'FREQUENCY'
  | 'COLLECTION'
  | 'ACTIVITY';

export type SemanticDocument = {
  key: string;
  entityType: SemanticEntityType;
  entityId: string;
  title: string;
  subtitle: string | null;
  text: string;
  modifiedAt: string | null;
};

export type SemanticSearchResult = {
  key: string;
  entityType: SemanticEntityType;
  entityId: string;
  title: string;
  subtitle: string | null;
  score: number;
  vectorScore: number;
  graphBonus: number;
  reasons: string[];
};

export type SemanticSearchOptions = {
  limit?: number;
  entityTypes?: SemanticEntityType[];
  excludeKey?: string | null;
  minimumScore?: number;
};

// forkK2LocalNeuralEmbeddingsV1
export type EmbeddingProvider = {
  id: string;
  dimensions: number;
  prepare?(): Promise<void>;
  embed(text: string): Promise<Float32Array> | Float32Array;
  embedMany?(texts: string[]): Promise<Float32Array[]>;
};

export type SemanticIndexStats = {
  providerId: string;
  dimensions: number;
  documents: number;
  signature: string;
  builtAt: string | null;
};
