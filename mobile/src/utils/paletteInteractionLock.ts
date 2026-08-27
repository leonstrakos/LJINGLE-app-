// forkLCollectionsMemoryBoxV2
// Small process-local UI mutex. It deliberately stores no user data.

const locks = new Set<string>();

export function setPaletteInteractionLock(
  owner: string,
  locked: boolean,
) {
  if (locked) {
    locks.add(owner);
  } else {
    locks.delete(owner);
  }
}

export function isPaletteInteractionLocked() {
  return locks.size > 0;
}
