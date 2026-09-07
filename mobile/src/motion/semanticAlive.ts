// ljingleSemanticAliveR1
export type SemanticAliveEvent =
  | { type: 'JINGLE' }
  | { type: 'ENTRY_SAVE'; entityKey?: string }
  | { type: 'COLLECTION_ADD'; entityKey?: string };

type Listener = (event: SemanticAliveEvent) => void;
const listeners = new Set<Listener>();

export function emitSemanticAlive(event: SemanticAliveEvent) {
  for (const listener of listeners) {
    try { listener(event); } catch { /* visuals never block the action */ }
  }
}

export function subscribeSemanticAlive(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
