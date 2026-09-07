// completionCelebrationR1
import { semanticFeedback } from '../utils/semanticFeedback';

export type CompletionCelebrationKind =
  | 'BOOK'
  | 'MOVIE'
  | 'SERIES'
  | 'GAME';

export type CompletionCelebrationEvent = {
  id: number;
  kind: CompletionCelebrationKind;
  title: string;
};

type Listener = (event: CompletionCelebrationEvent) => void;

const listeners = new Set<Listener>();
let sequence = 0;
let lastKey = '';
let lastAt = 0;

const DUPLICATE_WINDOW_MS = 900;

export function subscribeCompletionCelebration(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function triggerCompletionCelebration(input: {
  kind: CompletionCelebrationKind;
  title: string;
}) {
  const title = input.title.trim() || 'Završeno';
  const now = Date.now();
  const key = input.kind + ':' + title.toLocaleLowerCase();

  // One persisted completion should feel like one event even when adjacent UI
  // layers react to the same mutation.
  if (key === lastKey && now - lastAt < DUPLICATE_WINDOW_MS) return;

  lastKey = key;
  lastAt = now;

  // Completion keeps its existing success haptic. It intentionally does NOT
  // borrow create.mp3: the create sound remains reserved for newly added data.
  void semanticFeedback.complete();

  const event: CompletionCelebrationEvent = {
    id: ++sequence,
    kind: input.kind,
    title,
  };

  for (const listener of listeners) listener(event);
}
