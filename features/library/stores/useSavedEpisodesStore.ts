import { create } from "zustand";
import type {
  SpotifySavedEpisode,
  SpotifySavedEpisodesResponse,
} from "@/shared/types/spotify";
import { apiGetWithStatus } from "@/shared/utils/api-client";
import { saveCachedData } from "../utils/cache";

const STALE_REMAINING_MS = 300_000;

// Spotify rejects the save/remove episode endpoints for this app (403), so
// this store is read-only: episodes are saved and removed in the official
// Spotify app, and finished or nearly finished ones are only hidden here.
const isEpisodeStale = (entry: SpotifySavedEpisode): boolean => {
  const resume = entry.episode.resume_point;
  if (!resume) {
    return false;
  }
  if (resume.fully_played) {
    return true;
  }
  return (
    resume.resume_position_ms > 0 &&
    entry.episode.duration_ms - resume.resume_position_ms <= STALE_REMAINING_MS
  );
};

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
          const fresh = data.items.filter((entry) => !isEpisodeStale(entry));
          set({
            savedEpisodes: fresh,
            nextUrl: data.next,
            isRateLimited: false,
            rateLimitRetryAt: null,
          });
          await saveCachedData({ savedEpisodes: fresh });
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
        const fresh = data.items.filter((entry) => !isEpisodeStale(entry));
        set((state) => ({
          savedEpisodes: [...(state.savedEpisodes || []), ...fresh],
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
