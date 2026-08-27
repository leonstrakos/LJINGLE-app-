// forkFCollectionSymbolsTableV1
// forkLCollectionsMemoryBoxV2

export const DEFAULT_COLLECTION_SYMBOL = '◇';

export type CollectionSymbolGroup = {
  label: string;
  symbols: readonly string[];
};

export const COLLECTION_SYMBOL_GROUPS: readonly CollectionSymbolGroup[] = [
  {
    label: 'Oblici',
    symbols: ['◇', '◆', '◈', '◉', '◎', '○', '●', '□', '■', '△', '▲', '▽', '▼', '▷', '▶', '◁', '◀', '◐', '◑', '◌'],
  },
  {
    label: 'Zvijezde',
    symbols: ['☆', '★', '✦', '✧', '✩', '✪', '✫', '✬', '✭', '✮', '✯', '✰', '✱', '✲', '✳', '✴', '✵', '✶', '✷', '✸'],
  },
  {
    label: 'Ornamenti',
    symbols: ['✹', '✺', '✻', '✼', '✽', '✾', '✿', '❀', '❁', '❂', '❃', '❇', '❈', '❉', '❊', '❋', '⌁', '⌂', '☂', '☼'],
  },
  {
    label: 'Putanje',
    symbols: ['←', '↑', '→', '↓', '↖', '↗', '↘', '↙', '↔', '↕', '↚', '↛', '↜', '↝', '↞', '↠', '↢', '↣', '↺', '↻'],
  },
  {
    label: 'Znakovi',
    symbols: ['⌘', '⌬', '⌾', '⌖', '⊕', '⊗', '⊙', '⊚', '⊛', '⊞', '⊟', '⊠', '⊡', '⋄', '⋆', '∞', '∴', '∵', '∿', '≋'],
  },
] as const;

export const COLLECTION_SYMBOLS = COLLECTION_SYMBOL_GROUPS.flatMap(
  (group) => [...group.symbols],
);

const COLLECTION_SYMBOL_SET = new Set(COLLECTION_SYMBOLS);

const MOJIBAKE_SYMBOL_REPAIRS: Record<string, string> = {
  "â—Ś": '◌',
  "â‚": '☂',
  "â—‡": '◇',
  "âŚ": '⌁',
  "â†": '☆',
  "âĽ": '☼',
  "â†»": '↻',
};

function splitGraphemes(value: string) {
  const Segmenter = (Intl as any).Segmenter;

  if (typeof Segmenter === 'function') {
    const segmenter = new Segmenter(undefined, {
      granularity: 'grapheme',
    });

    return Array.from(
      segmenter.segment(value),
      (part: any) => String(part.segment),
    );
  }

  // Array.from is a safe fallback for code points. Hermes in current Expo
  // supports Intl.Segmenter, so ZWJ emoji stay one grapheme in normal builds.
  return Array.from(value);
}

export function collectionSymbolGraphemeCount(value: string) {
  return splitGraphemes(value.trim()).length;
}

export function clampCollectionSymbolInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  return splitGraphemes(trimmed)
    .slice(0, 2)
    .join('');
}

export function isCollectionPresetSymbol(value: string) {
  return COLLECTION_SYMBOL_SET.has(value);
}

export function normalizeCollectionSymbol(
  value: string | null | undefined,
) {
  const raw = value?.trim() ?? '';
  if (!raw) return DEFAULT_COLLECTION_SYMBOL;

  const repaired = MOJIBAKE_SYMBOL_REPAIRS[raw] ?? raw;
  const clamped = clampCollectionSymbolInput(repaired);

  return clamped || DEFAULT_COLLECTION_SYMBOL;
}
