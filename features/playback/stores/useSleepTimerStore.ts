import { create } from "zustand";

interface SleepTimerState {
  endAt: number | null;
  // Total duration of the running timer, so a countdown UI can show how much
  // is left as a fraction of the whole.
  durationMs: number | null;
  start: (minutes: number) => void;
  clear: () => void;
}

export const useSleepTimerStore = create<SleepTimerState>()((set) => ({
  endAt: null,
  durationMs: null,
  start: (minutes) =>
    set({
      endAt: Date.now() + minutes * 60_000,
      durationMs: minutes * 60_000,
    }),
  clear: () => set({ endAt: null, durationMs: null }),
}));
