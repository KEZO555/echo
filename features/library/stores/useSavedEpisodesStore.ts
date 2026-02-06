import { create } from "zustand";
import type {
  SpotifySavedEpisode,
  SpotifySavedEpisodesResponse,
} from "@/shared/types/spotify";
import { apiGet } from "@/shared/utils/api-client";
import { saveCachedData } from "../utils/cache";

interface SavedEpisodesState {
  savedEpisodes: SpotifySavedEpisode[] | null;
  nextUrl: string | null;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  fetch: () => Promise<void>;
  fetchMore: () => Promise<void>;
  setSavedEpisodes: (savedEpisodes: SpotifySavedEpisode[] | null) => void;
  reset: () => void;
}

export const useSavedEpisodesStore = create<SavedEpisodesState>()(
  (set, get) => ({
    savedEpisodes: null,
    nextUrl: null,
    isRefreshing: false,
    isLoadingMore: false,

    fetch: async () => {
      set({ isRefreshing: true });
      const data = await apiGet<SpotifySavedEpisodesResponse>(
        "https://api.spotify.com/v1/me/episodes?limit=50&market=from_token"
      );
      if (data) {
        set({ savedEpisodes: data.items, nextUrl: data.next });
        await saveCachedData({ savedEpisodes: data.items });
      }
      set({ isRefreshing: false });
    },

    fetchMore: async () => {
      const { nextUrl, isLoadingMore } = get();
      if (!nextUrl || isLoadingMore) return;
      set({ isLoadingMore: true });
      const data = await apiGet<SpotifySavedEpisodesResponse>(nextUrl);
      if (data) {
        set((state) => ({
          savedEpisodes: [...(state.savedEpisodes || []), ...data.items],
          nextUrl: data.next,
        }));
      }
      set({ isLoadingMore: false });
    },

    setSavedEpisodes: (savedEpisodes) => set({ savedEpisodes }),
    reset: () =>
      set({
        savedEpisodes: null,
        nextUrl: null,
        isRefreshing: false,
        isLoadingMore: false,
      }),
  })
);
