// forkK2LocalNeuralEmbeddingsV1

import { Platform } from 'react-native';

import { localFeatureEmbeddingProvider } from './localFeatureEmbedding';
import {
  getSemanticIndexStats,
  rebuildSemanticIndex,
  setSemanticEmbeddingProvider,
} from './semanticIndex';
import {
  getLocalNeuralEmbeddingStatus,
  onnxMultilingualEmbeddingProvider,
  prepareLocalNeuralEmbeddingModel,
  removeLocalNeuralEmbeddingModel,
} from './onnxMultilingualEmbedding';

export async function activateLocalNeuralEmbeddings() {
  if (Platform.OS === 'web') {
    throw new Error('Local ONNX embeddings are currently Android/iOS only.');
  }

  await prepareLocalNeuralEmbeddingModel();
  setSemanticEmbeddingProvider(onnxMultilingualEmbeddingProvider);
  return rebuildSemanticIndex();
}

export async function activateFeatureEmbeddings() {
  setSemanticEmbeddingProvider(localFeatureEmbeddingProvider);
  return rebuildSemanticIndex();
}

export function getSemanticModelState() {
  return {
    active: getSemanticIndexStats(),
    neural: getLocalNeuralEmbeddingStatus(),
  };
}

export async function deleteLocalNeuralModel() {
  setSemanticEmbeddingProvider(localFeatureEmbeddingProvider);
  removeLocalNeuralEmbeddingModel();
  return rebuildSemanticIndex();
}
