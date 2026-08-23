// universalUndoFoundationV1
//
// Lightweight global undo coordinator.
//
// No SQLite.
// No React dependency.
// No API dependency.
//
// A screen performs its normal action and registers
// an undo callback immediately afterwards.

export type UndoAction = {
  id: string;
  label: string;
  createdAt: number;
  expiresAt: number;
  undo: () => void | Promise<void>;
};

type UndoListener = (
  action: UndoAction | null,
) => void;

const DEFAULT_UNDO_DURATION = 6000;

let currentAction: UndoAction | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<UndoListener>();

function emit() {
  for (const listener of listeners) {
    listener(currentAction);
  }
}

function clearExpiryTimer() {
  if (expiryTimer) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }
}

export function getCurrentUndoAction() {
  return currentAction;
}

export function registerUndo(
  options: {
    label: string;
    undo: () => void | Promise<void>;
    durationMs?: number;
  },
) {
  clearExpiryTimer();

  const now = Date.now();
  const duration = Math.max(
    1000,
    options.durationMs ??
      DEFAULT_UNDO_DURATION,
  );

  const action: UndoAction = {
    id:
      'undo-' +
      now +
      '-' +
      Math.random()
        .toString(36)
        .slice(2, 8),
    label: options.label,
    createdAt: now,
    expiresAt: now + duration,
    undo: options.undo,
  };

  currentAction = action;

  emit();

  expiryTimer = setTimeout(() => {
    if (
      currentAction?.id === action.id
    ) {
      currentAction = null;
      emit();
    }

    expiryTimer = null;
  }, duration);

  return action;
}

export function dismissUndo(
  actionId?: string,
) {
  if (
    actionId &&
    currentAction?.id !== actionId
  ) {
    return;
  }

  clearExpiryTimer();

  currentAction = null;

  emit();
}

export async function performUndo(
  actionId?: string,
) {
  const action = currentAction;

  if (!action) {
    return false;
  }

  if (
    actionId &&
    action.id !== actionId
  ) {
    return false;
  }

  // Remove first so double taps cannot execute twice.
  dismissUndo(action.id);

  await action.undo();

  return true;
}

export function subscribeToUndo(
  listener: UndoListener,
) {
  listeners.add(listener);

  listener(currentAction);

  return () => {
    listeners.delete(listener);
  };
}

export function clearUndoManager() {
  dismissUndo();
  listeners.clear();
}
