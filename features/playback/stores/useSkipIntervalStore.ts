import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const STORAGE_KEY = "podcastSkipSeconds";
const DEFAULT_SECONDS = 15;

export const SKIP_INTERVAL_OPTIONS = [10, 15, 30, 45] as const;

interface SkipIntervalState {
  seconds: number;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSeconds: (seconds: number) => void;
}

export const useSkipIntervalStore = create<SkipIntervalState>((set, get) => ({
  seconds: DEFAULT_SECONDS,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) {
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_SECONDS;
      set({
        seconds: Number.isFinite(parsed) ? parsed : DEFAULT_SECONDS,
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },
  setSeconds: (seconds) => {
    set({ seconds });
    AsyncStorage.setItem(STORAGE_KEY, String(seconds)).catch(() => undefined);
  },
}));
