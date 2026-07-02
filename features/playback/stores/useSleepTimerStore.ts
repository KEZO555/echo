import { create } from "zustand";

interface SleepTimerState {
  endAt: number | null;
  start: (minutes: number) => void;
  clear: () => void;
}

export const useSleepTimerStore = create<SleepTimerState>()((set) => ({
  endAt: null,
  start: (minutes) => set({ endAt: Date.now() + minutes * 60_000 }),
  clear: () => set({ endAt: null }),
}));
