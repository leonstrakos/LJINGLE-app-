// forkK2LocalNeuralEmbeddingsV1

export type EncodedText = {
  inputIds: number[];
  attentionMask: number[];
};

function isWhitespace(character: string) {
  return /\s/u.test(character);
}

function isControl(character: string) {
  if (character === '\t' || character === '\n' || character === '\r') return false;
  return /\p{Cc}|\p{Cf}/u.test(character);
}

function isPunctuation(character: string) {
  return /[\p{P}\p{S}]/u.test(character);
}

function cleanText(value: string) {
  let output = '';
  for (const character of value.normalize('NFC')) {
    if (isControl(character)) continue;
    output += isWhitespace(character) ? ' ' : character;
  }
  return output;
}

function basicTokenize(value: string) {
  const tokens: string[] = [];
  let current = '';

  const flush = () => {
    if (current) tokens.push(current);
    current = '';
  };

  for (const character of cleanText(value)) {
    if (isWhitespace(character)) {
      flush();
      continue;
    }
    if (isPunctuation(character)) {
      flush();
      tokens.push(character);
      continue;
    }
    current += character;
  }
  flush();
  return tokens;
}

export class WordPieceTokenizer {
  private readonly vocabulary: Map<string, number>;
  private readonly unknownId: number;
  private readonly clsId: number;
  private readonly sepId: number;
  private readonly padId: number;

  constructor(vocabularyText: string) {
    const lines = vocabularyText.replace(/\r\n/g, '\n').split('\n');
    this.vocabulary = new Map<string, number>();

    lines.forEach((token, index) => {
      if (token) this.vocabulary.set(token, index);
    });

    const required = ['[UNK]', '[CLS]', '[SEP]', '[PAD]'];
    for (const token of required) {
      if (!this.vocabulary.has(token)) {
        throw new Error('Embedding vocabulary is missing ' + token + '.');
      }
    }

    this.unknownId = this.vocabulary.get('[UNK]')!;
    this.clsId = this.vocabulary.get('[CLS]')!;
    this.sepId = this.vocabulary.get('[SEP]')!;
    this.padId = this.vocabulary.get('[PAD]')!;
  }

  private wordPiece(token: string) {
    if (token.length > 100) return [this.unknownId];

    const pieces: number[] = [];
    let start = 0;

    while (start < token.length) {
      let end = token.length;
      let found: number | null = null;
      let foundEnd = start;

      while (start < end) {
        const piece = (start === 0 ? '' : '##') + token.slice(start, end);
        const id = this.vocabulary.get(piece);
        if (id !== undefined) {
          found = id;
          foundEnd = end;
          break;
        }
        end -= 1;
      }

      if (found === null) return [this.unknownId];
      pieces.push(found);
      start = foundEnd;
    }

    return pieces;
  }

  encode(value: string, maximumLength = 128): EncodedText {
    const usableMaximum = Math.max(8, Math.min(256, maximumLength));
    const ids: number[] = [this.clsId];

    for (const token of basicTokenize(value)) {
      for (const id of this.wordPiece(token)) {
        if (ids.length >= usableMaximum - 1) break;
        ids.push(id);
      }
      if (ids.length >= usableMaximum - 1) break;
    }

    ids.push(this.sepId);
    return {
      inputIds: ids,
      attentionMask: ids.map(() => 1),
    };
  }

  padIdValue() {
    return this.padId;
  }
}
