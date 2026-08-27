// forkK14_1_2ContextSpineV1

type AliasRecord = {
  key: string;
  aliases: string[];
  at: number;
};

const MAX_ENTITIES = 16;
const MAX_ALIASES = 5;
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

let records: AliasRecord[] = [];

function clean(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fresh() {
  const now = Date.now();
  records = records.filter(item => now - item.at <= MAX_AGE_MS);
  return records;
}

/**
 * An alias is learned ONLY after the user explicitly opens/selects a real entity.
 * Seeing an entity in search results is not enough.
 */
export function rememberContextAlias(entityKey: string, phrase: string) {
  const key = entityKey.trim();
  const alias = clean(phrase);
  if (!key || alias.length < 2 || alias.length > 160) return;

  const existing = fresh().find(item => item.key === key);
  const aliases = [
    alias,
    ...(existing?.aliases ?? []).filter(item => item !== alias),
  ].slice(0, MAX_ALIASES);

  records = [
    { key, aliases, at: Date.now() },
    ...records.filter(item => item.key !== key),
  ].slice(0, MAX_ENTITIES);
}

export function getContextAliases(entityKey: string): string[] {
  return fresh().find(item => item.key === entityKey)?.aliases ?? [];
}

export function clearContextAliases() {
  records = [];
}
