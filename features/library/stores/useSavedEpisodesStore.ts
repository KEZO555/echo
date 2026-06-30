import { create } from "zustand";
import type {
  SpotifyEpisode,
  SpotifySavedEpisode,
  SpotifySavedEpisodesResponse,
} from "@/shared/types/spotify";
import {
  apiDelete,
  apiGet,
  apiGetWithStatus,
  apiPut,
} from "@/shared/utils/api-client";
import { logError } from "@/shared/utils/logger";
import { saveCachedData } from "../utils/cache";

interface SavedEpisodesState {
  savedEpisodes: SpotifySavedEpisode[] | null;
  nextUrl: string | null;
  isRefreshing: boolean;
  isFetching: boolean;
  isLoadingMore: boolean;
  isRateLimited: boolean;
  rateLimitRetryAt: number | null;
  fetch: (options?: { showRefreshing?: boolean }) => Promise<void>;
  fetchMore: () => Promise<void>;
  saveEpisode: (episode: SpotifyEpisode) => Promise<boolean>;
  removeEpisode: (episodeId: string) => Promise<boolean>;
  checkIfSaved: (episodeId: string) => Promise<boolean>;
  setSavedEpisodes: (savedEpisodes: SpotifySavedEpisode[] | null) => void;
  reset: () => void;
}

export const useSavedEpisodesStore = create<SavedEpisodesState>()(
  (set, get) => ({
    savedEpisodes: null,
    nextUrl: null,
    isRefreshing: false,
    isFetching: false,
    isLoadingMore: false,
    isRateLimited: false,
    rateLimitRetryAt: null,

    fetch: async (options) => {
      const showRefreshing = options?.showRefreshing ?? true;
      if (showRefreshing) {
        set({ isRefreshing: true, isFetching: true });
      } else {
        set({ isFetching: true });
      }
      try {
        const result = await apiGetWithStatus<SpotifySavedEpisodesResponse>(
          "https://api.spotify.com/v1/me/episodes?limit=50&market=from_token"
        );
        const data = result.data;
        if (data) {
          set({
            savedEpisodes: data.items,
            nextUrl: data.next,
            isRateLimited: false,
            rateLimitRetryAt: null,
          });
          await saveCachedData({ savedEpisodes: data.items });
        } else if (result.status === 429) {
          set({
            isRateLimited: true,
            rateLimitRetryAt:
              result.retryAfterMs !== null
                ? Date.now() + result.retryAfterMs
                : null,
          });
        } else if (get().savedEpisodes === null) {
          set({
            savedEpisodes: [],
            nextUrl: null,
            isRateLimited: false,
            rateLimitRetryAt: null,
          });
        }
      } finally {
        if (showRefreshing) {
          set({ isRefreshing: false, isFetching: false });
        } else {
          set({ isFetching: false });
        }
      }
    },

    fetchMore: async () => {
      const { nextUrl, isLoadingMore } = get();
      if (!nextUrl || isLoadingMore) {
        return;
      }
      set({ isLoadingMore: true });
      const result =
        await apiGetWithStatus<SpotifySavedEpisodesResponse>(nextUrl);
      const data = result.data;
      if (data) {
        set((state) => ({
          savedEpisodes: [...(state.savedEpisodes || []), ...data.items],
          nextUrl: data.next,
          isRateLimited: false,
          rateLimitRetryAt: null,
        }));
      } else if (result.status === 429) {
        set({
          isRateLimited: true,
          rateLimitRetryAt:
            result.retryAfterMs !== null
              ? Date.now() + result.retryAfterMs
              : null,
        });
      }
      set({ isLoadingMore: false });
    },

    saveEpisode: async (episode) => {
      try {
        const saved = await apiPut(
          `https://api.spotify.com/v1/me/episodes?ids=${episode.id}`
        );
        if (!saved) {
          return false;
        }
        set((state) => {
          const list = state.savedEpisodes ?? [];
          if (list.some((entry) => entry.episode.id === episode.id)) {
            return {};
          }
          return {
            savedEpisodes: [
              { added_at: new Date().toISOString(), episode },
              ...list,
            ],
          };
        });
        return true;
      } catch (error) {
        logError("Error saving episode:", error);
        return false;
      }
    },

    removeEpisode: async (episodeId) => {
      try {
        const removed = await apiDelete(
          `https://api.spotify.com/v1/me/episodes?ids=${episodeId}`
        );
        if (!removed) {
          return false;
        }
        set((state) => ({
          savedEpisodes: (state.savedEpisodes ?? []).filter(
            (entry) => entry.episode.id !== episodeId
          ),
        }));
        return true;
      } catch (error) {
        logError("Error removing episode:", error);
        return false;
      }
    },

    checkIfSaved: async (episodeId) => {
      const local = get().savedEpisodes;
      if (local?.some((entry) => entry.episode.id === episodeId)) {
        return true;
      }
      const data = await apiGet<boolean[]>(
        `https://api.spotify.com/v1/me/episodes/contains?ids=${episodeId}`
      );
      return data ? (data[0] ?? false) : false;
    },

    setSavedEpisodes: (savedEpisodes) => set({ savedEpisodes }),
    reset: () =>
      set({
        savedEpisodes: null,
        nextUrl: null,
        isRefreshing: false,
        isFetching: false,
        isLoadingMore: false,
        isRateLimited: false,
        rateLimitRetryAt: null,
      }),
  })
);
