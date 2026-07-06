import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export interface PlayEvent {
  uri: string;
  name: string;
  /** Artist name(s) for a track, or the show name for an episode. */
  subtitle: string;
  type: "track" | "episode";
  /** Show uri for episodes, so episodes can be grouped by their show. */
  showUri?: string;
  /** When this listening chunk was recorded (epoch ms). */
  at: number;
  /** Seconds actually listened in this chunk. */
  seconds: number;
}

const STORAGE_KEY = "listeningHistory";
// A rolling window - plenty for weekly/monthly stats without unbounded growth.
const MAX_EVENTS = 1500;

interface PlayHistoryState {
  events: PlayEvent[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  logEvent: (event: PlayEvent) => void;
  clear: () => void;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
const persist = (events: PlayEvent[]) => {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(events)).catch(
      () => undefined
    );
  }, 1500);
};

export const usePlayHistoryStore = create<PlayHistoryState>((set, get) => ({
  events: [],
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) {
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const events = raw ? (JSON.parse(raw) as PlayEvent[]) : [];
      set({ events, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  logEvent: (event) => {
    // Never write before hydration or we would clobber saved history with an
    // empty list.
    if (!get().hydrated) {
      return;
    }
    const events = [...get().events, event].slice(-MAX_EVENTS);
    set({ events });
    persist(events);
  },
  clear: () => {
    set({ events: [] });
    persist([]);
  },
}));
