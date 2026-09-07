// ljingleOnboardingPlayerV1
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';

import type { MemoryTrack } from '../types/memoryRadio';
import { claimAudioFocus, listenForAudioFocus } from './audioFocus';

type MemoryAudioValue = {
  current: MemoryTrack | null;
  currentTime: number;
  duration: number;
  playing: boolean;
  queue: MemoryTrack[];
  queueIndex: number;
  play: (memory: MemoryTrack, queue?: MemoryTrack[]) => void;
  resume: () => void;
  pause: () => void;
  toggle: (memory: MemoryTrack, queue?: MemoryTrack[]) => void;
  toggleCurrent: () => void;
  previous: () => void;
  next: () => void;
  stop: () => void;
  clear: () => void;
  updateMetadata: (
    trackId: string,
    title: string,
    artist: string | null,
  ) => void;
};

const MemoryAudioContext = createContext<MemoryAudioValue | null>(null);

function uniqueQueue(items: MemoryTrack[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.trackId)) return false;
    seen.add(item.trackId);
    return true;
  });
}

export function MemoryAudioProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const [current, setCurrent] = useState<MemoryTrack | null>(null);
  const [queue, setQueue] = useState<MemoryTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);

  const currentRef = useRef<MemoryTrack | null>(null);
  const queueRef = useRef<MemoryTrack[]>([]);
  const queueIndexRef = useRef(-1);
  const nextRef = useRef<() => void>(() => undefined);
  const finishedTrackRef = useRef<string | null>(null);

  currentRef.current = current;
  queueRef.current = queue;
  queueIndexRef.current = queueIndex;

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
  }, []);

  useEffect(
    () =>
      listenForAudioFocus((owner) => {
        if (owner !== 'memory-radio') player.pause();
      }),
    [player],
  );

  const applyQueue = useCallback(
    (memory: MemoryTrack, requested?: MemoryTrack[]) => {
      let nextQueue = requested?.length
        ? uniqueQueue(requested)
        : queueRef.current;

      if (!nextQueue.some((item) => item.trackId === memory.trackId)) {
        nextQueue = [memory];
      }

      const nextIndex = nextQueue.findIndex(
        (item) => item.trackId === memory.trackId,
      );

      queueRef.current = nextQueue;
      queueIndexRef.current = nextIndex;
      setQueue(nextQueue);
      setQueueIndex(nextIndex);
    },
    [],
  );

  const start = useCallback(
    (memory: MemoryTrack, requestedQueue?: MemoryTrack[]) => {
      claimAudioFocus('memory-radio');
      applyQueue(memory, requestedQueue);
      finishedTrackRef.current = null;

      const changed = currentRef.current?.trackId !== memory.trackId;
      if (changed) {
        player.replace(memory.fileUri);
        currentRef.current = memory;
        setCurrent(memory);
        player.setActiveForLockScreen(true, {
          title: memory.trackTitle,
          artist: memory.artist ?? 'LJingle Memory Radio',
          albumTitle: memory.entryTitle ?? 'Memory Radio',
        });
      } else if (
        status.duration > 0 &&
        status.currentTime >= status.duration - 0.2
      ) {
        void player.seekTo(memory.clipStartSeconds);
      }

      if (changed || status.currentTime < memory.clipStartSeconds) {
        void player.seekTo(memory.clipStartSeconds).then(() => player.play());
      } else {
        player.play();
      }
    },
    [applyQueue, player, status.currentTime, status.duration],
  );

  const pause = useCallback(() => player.pause(), [player]);

  const resume = useCallback(() => {
    if (!currentRef.current) return;
    claimAudioFocus('memory-radio');
    finishedTrackRef.current = null;
    player.play();
  }, [player]);

  const stop = useCallback(() => {
    const memory = currentRef.current;
    player.pause();
    if (memory) void player.seekTo(memory.clipStartSeconds);
    currentRef.current = null;
    queueRef.current = [];
    queueIndexRef.current = -1;
    setCurrent(null);
    setQueue([]);
    setQueueIndex(-1);
    finishedTrackRef.current = null;
  }, [player]);

  const previous = useCallback(() => {
    const memory = currentRef.current;
    if (!memory) return;

    if (status.currentTime > memory.clipStartSeconds + 3) {
      void player.seekTo(memory.clipStartSeconds);
      if (status.playing) player.play();
      return;
    }

    const items = queueRef.current;
    if (items.length === 0) {
      start(memory, [memory]);
      return;
    }

    const index = Math.max(0, queueIndexRef.current);
    const nextIndex = (index - 1 + items.length) % items.length;
    const nextMemory = items[nextIndex];
    if (nextMemory) start(nextMemory, items);
  }, [player, start, status.currentTime, status.playing]);

  const next = useCallback(() => {
    const memory = currentRef.current;
    const items = queueRef.current;
    if (!memory) return;

    if (items.length <= 1) {
      void player.seekTo(memory.clipStartSeconds);
      player.play();
      return;
    }

    const index = Math.max(0, queueIndexRef.current);
    const nextIndex = (index + 1) % items.length;
    const nextMemory = items[nextIndex];
    if (nextMemory) start(nextMemory, items);
  }, [player, start]);

  nextRef.current = next;

  useEffect(() => {
    const memory = currentRef.current;
    if (!memory || !status.playing || memory.clipEndSeconds === null) return;
    if (status.currentTime < memory.clipEndSeconds) return;

    if (queueRef.current.length > 1) {
      nextRef.current();
    } else {
      player.pause();
      void player.seekTo(memory.clipStartSeconds);
    }
  }, [player, status.currentTime, status.playing]);

  useEffect(() => {
    const memory = currentRef.current;
    if (!memory || !status.didJustFinish) return;
    if (finishedTrackRef.current === memory.trackId) return;
    finishedTrackRef.current = memory.trackId;

    if (queueRef.current.length > 1) {
      nextRef.current();
    }
  }, [status.didJustFinish]);

  const toggle = useCallback(
    (memory: MemoryTrack, requestedQueue?: MemoryTrack[]) => {
      if (currentRef.current?.trackId === memory.trackId && status.playing) {
        pause();
      } else if (currentRef.current?.trackId === memory.trackId) {
        if (requestedQueue) applyQueue(memory, requestedQueue);
        resume();
      } else {
        start(memory, requestedQueue);
      }
    },
    [applyQueue, pause, resume, start, status.playing],
  );

  const toggleCurrent = useCallback(() => {
    if (!currentRef.current) return;
    if (status.playing) pause();
    else resume();
  }, [pause, resume, status.playing]);

  const updateMetadata = useCallback(
    (trackId: string, title: string, artist: string | null) => {
      setCurrent((memory) => {
        if (!memory || memory.trackId !== trackId) return memory;

        const updated = { ...memory, trackTitle: title, artist };
        currentRef.current = updated;
        player.setActiveForLockScreen(true, {
          title: updated.trackTitle,
          artist: updated.artist ?? 'LJingle Memory Radio',
          albumTitle: updated.entryTitle ?? 'Memory Radio',
        });
        return updated;
      });

      setQueue((items) => {
        const updated = items.map((item) =>
          item.trackId === trackId
            ? { ...item, trackTitle: title, artist }
            : item,
        );
        queueRef.current = updated;
        return updated;
      });
    },
    [player],
  );

  const value = useMemo<MemoryAudioValue>(
    () => ({
      current,
      currentTime: status.currentTime || 0,
      duration: status.duration || 0,
      playing: Boolean(status.playing),
      queue,
      queueIndex,
      play: start,
      resume,
      pause,
      toggle,
      toggleCurrent,
      previous,
      next,
      stop,
      clear: stop,
      updateMetadata,
    }),
    [
      current,
      next,
      pause,
      previous,
      queue,
      queueIndex,
      resume,
      start,
      status.currentTime,
      status.duration,
      status.playing,
      stop,
      toggle,
      toggleCurrent,
      updateMetadata,
    ],
  );

  return (
    <MemoryAudioContext.Provider value={value}>
      {children}
    </MemoryAudioContext.Provider>
  );
}

export function useMemoryAudio() {
  const value = useContext(MemoryAudioContext);
  if (!value) {
    throw new Error('useMemoryAudio must be used inside MemoryAudioProvider');
  }
  return value;
}
