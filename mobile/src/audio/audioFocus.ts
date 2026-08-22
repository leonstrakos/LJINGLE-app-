type Listener = (owner: string) => void;

const listeners = new Set<Listener>();

export function claimAudioFocus(owner: string) {
  listeners.forEach((listener) => listener(owner));
}

export function listenForAudioFocus(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
