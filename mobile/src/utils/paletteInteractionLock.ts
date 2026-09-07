// forkLCollectionsMemoryBoxV2
// Small process-local UI mutex. It deliberately stores no user data.

const locks = new Set<string>();
const listeners = new Set<() => void>();

function notifyPaletteInteractionLock() {
  for (const listener of listeners) {
    try { listener(); } catch { /* UI lock listeners must never break gestures. */ }
  }
}

export function setPaletteInteractionLock(
  owner: string,
  locked: boolean,
) {
  const before = locks.size;
  if (locked) {
    locks.add(owner);
  } else {
    locks.delete(owner);
  }
  if (before !== locks.size) notifyPaletteInteractionLock();
}

export function isPaletteInteractionLocked() {
  return locks.size > 0;
}


export function subscribePaletteInteractionLock(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
