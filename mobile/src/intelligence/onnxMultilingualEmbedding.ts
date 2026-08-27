// forkK2LocalNeuralEmbeddingsV1

import { Directory, File, Paths } from 'expo-file-system';
import * as ort from 'onnxruntime-react-native';

import type { EmbeddingProvider } from './semanticTypes';
import { WordPieceTokenizer } from './wordPieceTokenizer';

const MODEL_ID = 'distiluse-multilingual-cased-v2-int8-mean-v1';
const DIMENSIONS = 768;
const MAX_TOKENS = 128;
const MAX_BATCH = 6;

const MODEL_URL =
  'https://huggingface.co/Xenova/distiluse-base-multilingual-cased-v2/resolve/main/onnx/model_int8.onnx?download=true';
const VOCAB_URL =
  'https://huggingface.co/Xenova/distiluse-base-multilingual-cased-v2/resolve/main/vocab.txt?download=true';

const MODEL_NAME = 'distiluse-base-multilingual-cased-v2-int8.onnx';
const VOCAB_NAME = 'distiluse-base-multilingual-cased-v2-vocab.txt';
const MINIMUM_MODEL_BYTES = 120_000_000;
const MINIMUM_VOCAB_BYTES = 900_000;

type RuntimeState = 'idle' | 'downloading' | 'loading' | 'ready' | 'error';

let runtimeState: RuntimeState = 'idle';
let runtimeError: string | null = null;
let session: ort.InferenceSession | null = null;
let tokenizer: WordPieceTokenizer | null = null;
let preparing: Promise<void> | null = null;

function modelDirectory() {
  const directory = new Directory(Paths.document, 'ljingle-intelligence');
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function modelFiles() {
  const directory = modelDirectory();
  return {
    model: new File(directory, MODEL_NAME),
    vocab: new File(directory, VOCAB_NAME),
  };
}

function normalizedModelPath(uri: string) {
  if (!uri.startsWith('file://')) return uri;
  return decodeURIComponent(uri.slice('file://'.length));
}

async function downloadIfMissing(
  url: string,
  target: File,
  minimumBytes: number,
) {
  if (target.exists && Number(target.size ?? 0) >= minimumBytes) return;

  if (target.exists) {
    target.delete();
  }

  await File.downloadFileAsync(url, target);
  if (!target.exists || Number(target.size ?? 0) < minimumBytes) {
    try { if (target.exists) target.delete(); } catch {}
    throw new Error('Local embedding model download is incomplete.');
  }
}

async function ensureFiles() {
  runtimeState = 'downloading';
  const { model, vocab } = modelFiles();

  await downloadIfMissing(MODEL_URL, model, MINIMUM_MODEL_BYTES);
  await downloadIfMissing(VOCAB_URL, vocab, MINIMUM_VOCAB_BYTES);
  return { model, vocab };
}

function int64(values: number[]) {
  return new BigInt64Array(values.map((value) => BigInt(value)));
}

function normalizeVector(vector: Float32Array) {
  let squared = 0;
  for (const value of vector) squared += value * value;
  const length = Math.sqrt(squared);
  if (!length) return vector;
  for (let index = 0; index < vector.length; index += 1) {
    vector[index] = (vector[index] ?? 0) / length;
  }
  return vector;
}

function poolBatch(
  output: ort.Tensor,
  masks: number[][],
) {
  const dimensions = output.dims.map(Number);
  if (dimensions.length !== 3) {
    throw new Error('Embedding model returned an unexpected tensor rank.');
  }

  const batchSize = dimensions[0];
  const sequenceLength = dimensions[1];
  const hiddenSize = dimensions[2];
  if (
    batchSize === undefined ||
    sequenceLength === undefined ||
    hiddenSize === undefined
  ) {
    throw new Error('Embedding model dimensions are incomplete.');
  }
  if (hiddenSize !== DIMENSIONS || batchSize !== masks.length) {
    throw new Error('Embedding model returned unexpected dimensions.');
  }

  const data = output.data as Float32Array;
  const vectors: Float32Array[] = [];

  for (let batch = 0; batch < batchSize; batch += 1) {
    const vector = new Float32Array(hiddenSize);
    let tokenCount = 0;

    for (let token = 0; token < sequenceLength; token += 1) {
      if (!masks[batch]?.[token]) continue;
      tokenCount += 1;
      const offset = (batch * sequenceLength + token) * hiddenSize;
      for (let hidden = 0; hidden < hiddenSize; hidden += 1) {
        vector[hidden] = (vector[hidden] ?? 0) + Number(data[offset + hidden] ?? 0);
      }
    }

    if (tokenCount > 0) {
      for (let hidden = 0; hidden < hiddenSize; hidden += 1) {
        vector[hidden] = (vector[hidden] ?? 0) / tokenCount;
      }
    }

    vectors.push(normalizeVector(vector));
  }

  return vectors;
}

function pickHiddenState(outputs: Record<string, ort.Tensor>) {
  const named = outputs.last_hidden_state;
  if (named && named.dims.length === 3) return named;

  const candidate = Object.values(outputs).find(
    (value) => value.dims.length === 3 && Number(value.dims[value.dims.length - 1]) === DIMENSIONS,
  );
  if (!candidate) {
    throw new Error('Embedding model hidden state output was not found.');
  }
  return candidate;
}

async function prepareRuntime() {
  if (session && tokenizer) {
    runtimeState = 'ready';
    return;
  }
  if (preparing) return preparing;

  preparing = (async () => {
    try {
      const { model, vocab } = await ensureFiles();
      runtimeState = 'loading';
      runtimeError = null;

      tokenizer = new WordPieceTokenizer(vocab.textSync());

      const nativePath = normalizedModelPath(model.uri);
      try {
        session = await ort.InferenceSession.create(nativePath);
      } catch (firstError) {
        // Some RN builds accept the file:// URI while others want a native path.
        session = await ort.InferenceSession.create(model.uri).catch(() => {
          throw firstError;
        });
      }

      runtimeState = 'ready';
    } catch (caught) {
      runtimeState = 'error';
      runtimeError = caught instanceof Error ? caught.message : String(caught);
      session = null;
      tokenizer = null;
      throw caught;
    } finally {
      preparing = null;
    }
  })();

  return preparing;
}

async function embedBatch(values: string[]) {
  await prepareRuntime();
  if (!session || !tokenizer) throw new Error('Local embedding runtime is not ready.');

  const encoded = values.map((value) => tokenizer!.encode(value, MAX_TOKENS));
  const sequenceLength = Math.max(...encoded.map((item) => item.inputIds.length));
  const inputIds: number[] = [];
  const attentionMasks: number[][] = [];
  const flatMasks: number[] = [];
  const padId = tokenizer.padIdValue();

  for (const item of encoded) {
    const ids = item.inputIds.slice();
    const mask = item.attentionMask.slice();
    while (ids.length < sequenceLength) {
      ids.push(padId);
      mask.push(0);
    }
    inputIds.push(...ids);
    attentionMasks.push(mask);
    flatMasks.push(...mask);
  }

  const shape = [values.length, sequenceLength];
  const feeds: Record<string, ort.Tensor> = {};

  if (session.inputNames.includes('input_ids')) {
    feeds.input_ids = new ort.Tensor('int64', int64(inputIds), shape);
  }
  if (session.inputNames.includes('attention_mask')) {
    feeds.attention_mask = new ort.Tensor('int64', int64(flatMasks), shape);
  }
  if (session.inputNames.includes('token_type_ids')) {
    feeds.token_type_ids = new ort.Tensor(
      'int64',
      new BigInt64Array(inputIds.length),
      shape,
    );
  }

  if (!feeds.input_ids || !feeds.attention_mask) {
    throw new Error('Embedding model input contract is not compatible.');
  }

  const outputs = await session.run(feeds);
  return poolBatch(pickHiddenState(outputs), attentionMasks);
}

export const onnxMultilingualEmbeddingProvider: EmbeddingProvider = {
  id: MODEL_ID,
  dimensions: DIMENSIONS,
  prepare: prepareRuntime,

  async embed(value: string) {
    const [vector] = await embedBatch([value]);
    return vector!;
  },

  async embedMany(values: string[]) {
    const vectors: Float32Array[] = [];
    for (let offset = 0; offset < values.length; offset += MAX_BATCH) {
      vectors.push(...await embedBatch(values.slice(offset, offset + MAX_BATCH)));
      // Yield between neural batches to keep app interaction responsive.
      await Promise.resolve();
    }
    return vectors;
  },
};

export function getLocalNeuralEmbeddingStatus() {
  const { model, vocab } = modelFiles();
  return {
    modelId: MODEL_ID,
    state: runtimeState,
    error: runtimeError,
    ready: runtimeState === 'ready',
    downloaded:
      model.exists &&
      vocab.exists &&
      Number(model.size ?? 0) >= MINIMUM_MODEL_BYTES &&
      Number(vocab.size ?? 0) >= MINIMUM_VOCAB_BYTES,
    modelBytes: model.exists ? Number(model.size ?? 0) : 0,
    vocabBytes: vocab.exists ? Number(vocab.size ?? 0) : 0,
  };
}

export async function prepareLocalNeuralEmbeddingModel() {
  await prepareRuntime();
  return getLocalNeuralEmbeddingStatus();
}

export function removeLocalNeuralEmbeddingModel() {
  session = null;
  tokenizer = null;
  preparing = null;
  runtimeState = 'idle';
  runtimeError = null;

  const { model, vocab } = modelFiles();
  try { if (model.exists) model.delete(); } catch {}
  try { if (vocab.exists) vocab.delete(); } catch {}
}
