import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import type { MemoryTrack } from '../types/memoryRadio';
import { claimAudioFocus, listenForAudioFocus } from './audioFocus';

type MemoryAudioValue = {
  current: MemoryTrack | null;
  currentTime: number;
  duration: number;
  playing: boolean;
  play: (memory: MemoryTrack) => void;
  pause: () => void;
  toggle: (memory: MemoryTrack) => void;
  clear: () => void;
};

const MemoryAudioContext = createContext<MemoryAudioValue | null>(null);

export function MemoryAudioProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const [current, setCurrent] = useState<MemoryTrack | null>(null);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
  }, []);

  useEffect(() => listenForAudioFocus((owner) => {
    if (owner !== 'memory-radio') player.pause();
  }), [player]);

  useEffect(() => {
    if (!current || !status.playing || current.clipEndSeconds === null) return;
    if (status.currentTime < current.clipEndSeconds) return;
    player.pause();
    void player.seekTo(current.clipStartSeconds);
  }, [current, player, status.currentTime, status.playing]);

  const play = useCallback((memory: MemoryTrack) => {
    claimAudioFocus('memory-radio');
    if (current?.trackId !== memory.trackId) {
      player.replace(memory.fileUri);
      setCurrent(memory);
      player.setActiveForLockScreen(true, {
        title: memory.trackTitle,
        artist: memory.artist ?? 'LJingle Memory Radio',
        albumTitle: memory.entryTitle ?? 'Memory Radio',
      });
    } else if (status.duration > 0 && status.currentTime >= status.duration - 0.2) {
      void player.seekTo(0);
    }
    if (current?.trackId !== memory.trackId || status.currentTime < memory.clipStartSeconds) {
      void player.seekTo(memory.clipStartSeconds).then(() => player.play());
    } else {
      player.play();
    }
  }, [current?.trackId, player, status.currentTime, status.duration]);

  const pause = useCallback(() => player.pause(), [player]);

  // memoryRadioUnlinkDeleteV3
  const clear = useCallback(() => {
    player.pause();
    player.replace(null);
    setCurrent(null);
  }, [player]);

  const toggle = useCallback((memory: MemoryTrack) => {
    if (current?.trackId === memory.trackId && status.playing) pause();
    else play(memory);
  }, [current?.trackId, pause, play, status.playing]);

  const value = useMemo<MemoryAudioValue>(() => ({
    current,
    currentTime: status.currentTime || 0,
    duration: status.duration || 0,
    playing: Boolean(status.playing),
    play,
    pause,
    toggle,
    clear,
  }), [clear, current, pause, play, status.currentTime, status.duration, status.playing, toggle]);

  return <MemoryAudioContext.Provider value={value}>{children}</MemoryAudioContext.Provider>;
}

export function useMemoryAudio() {
  const value = useContext(MemoryAudioContext);
  if (!value) throw new Error('useMemoryAudio must be used inside MemoryAudioProvider');
  return value;
}
