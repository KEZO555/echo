import { create } from "zustand";
import type {
  SavedTrackObject,
  SpotifyPaginatedResponse,
} from "@/shared/types/spotify";
import { apiGet } from "@/shared/utils/api-client";
import { saveCachedData } from "../utils/cache";

interface SavedTracksState {
  savedTracks: SavedTrackObject[] | null;
  nextUrl: string | null;
  isRefreshing: boolean;
  isFetching: boolean;
  isLoadingMore: boolean;
  fetch: (options?: { showRefreshing?: boolean }) => Promise<void>;
  fetchMore: () => Promise<void>;
  setSavedTracks: (savedTracks: SavedTrackObject[] | null) => void;
  reset: () => void;
}

export const useSavedTracksStore = create<SavedTracksState>()((set, get) => ({
  savedTracks: null,
  nextUrl: null,
  isRefreshing: false,
  isFetching: false,
  isLoadingMore: false,

  fetch: async (options) => {
    const showRefreshing = options?.showRefreshing ?? true;
    if (showRefreshing) {
      set({ isRefreshing: true, isFetching: true });
    } else {
      set({ isFetching: true });
    }
    try {
      const data = await apiGet<SpotifyPaginatedResponse<SavedTrackObject>>(
        "https://api.spotify.com/v1/me/tracks?limit=50"
      );
      if (data) {
        set({ savedTracks: data.items, nextUrl: data.next });
        await saveCachedData({ tracks: data.items });
      } else if (get().savedTracks === null) {
        set({ savedTracks: [], nextUrl: null });
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
    const data =
      await apiGet<SpotifyPaginatedResponse<SavedTrackObject>>(nextUrl);
    if (data) {
      set((state) => ({
        savedTracks: [...(state.savedTracks || []), ...data.items],
        nextUrl: data.next,
      }));
    }
    set({ isLoadingMore: false });
  },

  setSavedTracks: (savedTracks) => set({ savedTracks }),
  reset: () =>
    set({
      savedTracks: null,
      nextUrl: null,
      isRefreshing: false,
      isFetching: false,
      isLoadingMore: false,
    }),
}));
