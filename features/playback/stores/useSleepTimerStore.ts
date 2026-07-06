import { create } from "zustand";

interface SleepTimerState {
  endAt: number | null;
  // Total duration of the running timer, so a countdown UI can show how much
  // is left as a fraction of the whole.
  durationMs: number | null;
  // When true, playback stops at the end of the current track/episode instead
  // of after a fixed duration.
  endOfTrack: boolean;
  start: (minutes: number) => void;
  startEndOfTrack: () => void;
  clear: () => void;
}

export const useSleepTimerStore = create<SleepTimerState>()((set) => ({
  endAt: null,
  durationMs: null,
  endOfTrack: false,
  start: (minutes) =>
    set({
      endAt: Date.now() + minutes * 60_000,
      durationMs: minutes * 60_000,
      endOfTrack: false,
    }),
  startEndOfTrack: () =>
    set({ endAt: null, durationMs: null, endOfTrack: true }),
  clear: () => set({ endAt: null, durationMs: null, endOfTrack: false }),
}));
