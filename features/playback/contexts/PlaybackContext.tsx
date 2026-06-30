import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { AppState } from "react-native";
import { useAuth } from "@/features/auth";
import { useSpotifyConnection } from "@/modules/spotify-sdk";

import type {
  SpotifyCurrentlyPlaying,
  SpotifyQueueResponse,
} from "@/shared/types/spotify";

import type {
  PlayContextOptions,
  SourceContext,
  SpotifyPlayerTrack,
} from "../services/spotifyPlayback";
import {
  addToLibrary as addToLibraryService,
  addToQueue as addToQueueService,
  forceAppRemoteConnection as forceAppRemoteConnectionService,
  getAlbumArt as getAlbumArtService,
  getCurrentTrack as getCurrentTrackService,
  getLibraryState as getLibraryStateService,
  getPlaybackState as getPlaybackStateService,
  getQueue as getQueueService,
  pausePlayback as pausePlaybackService,
  playContext as playContextService,
  playTracksWithWebApi as playTracksWithWebApiService,
  playTrackWithContext as playTrackWithContextService,
  playUriWithSkipToUri as playUriWithSkipToUriService,
  removeFromLibrary as removeFromLibraryService,
  seekToPosition as seekToPositionService,
  skipToNext as skipToNextService,
  skipToPrevious as skipToPreviousService,
  startPlayback as startPlaybackService,
  toggleRepeat as toggleRepeatService,
  toggleShuffle as toggleShuffleService,
} from "../services/spotifyPlayback";

export interface PlaybackContextType {
  isConnectedToAppRemote: boolean;

  startPlayback: () => Promise<void>;
  pausePlayback: () => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  seekToPosition: (positionMs: number) => Promise<void>;
  toggleShuffle: (state: boolean) => Promise<void>;
  toggleRepeat: (state: "off" | "context" | "track") => Promise<void>;

  getPlaybackState: () => Promise<SpotifyCurrentlyPlaying | null>;
  getCurrentTrack: () => Promise<SpotifyPlayerTrack | null>;
  getAlbumArt: (uri?: string, size?: string) => Promise<string | null>;

  playTrackWithContext: (
    trackUri: string,
    sourceContext?: SourceContext
  ) => Promise<void>;
  playContext: (
    contextUri: string,
    options?: PlayContextOptions
  ) => Promise<void>;
  playUriWithSkipToUri: (uri: string, skipToUri: string) => Promise<void>;
  playTracksWithWebApi: (uris: string[]) => Promise<void>;
  addToQueue: (uri: string) => Promise<void>;
  getQueue: () => Promise<SpotifyQueueResponse | null>;

  addToLibrary: (uri: string) => Promise<boolean>;
  removeFromLibrary: (uri: string) => Promise<boolean>;
  getLibraryState: (
    uri: string
  ) => Promise<{ isAdded: boolean; canAdd: boolean } | null>;

  forceAppRemoteConnection: () => Promise<boolean>;
}

const PlaybackContext = createContext<PlaybackContextType | undefined>(
  undefined
);

export const PlaybackProvider = ({ children }: { children: ReactNode }) => {
  const { accessToken, ensureValidToken } = useAuth();
  const { isConnected: isConnectedToAppRemote } = useSpotifyConnection();

  const playTracksWithWebApi = useCallback(
    (uris: string[]) => {
      return playTracksWithWebApiService(uris, accessToken, ensureValidToken);
    },
    [accessToken, ensureValidToken]
  );

  const playTrackWithContext = useCallback(
    async (trackUri: string, sourceContext?: SourceContext) => {
      const validToken = await ensureValidToken();

      return playTrackWithContextService(
        trackUri,
        validToken,
        sourceContext,
        ensureValidToken
      );
    },
    [ensureValidToken]
  );

  const playContext = useCallback(
    async (contextUri: string, options?: PlayContextOptions) => {
      const validToken = await ensureValidToken();
      return playContextService(
        contextUri,
        validToken,
        options,
        ensureValidToken
      );
    },
    [ensureValidToken]
  );

  const addToQueue = useCallback(
    async (uri: string) => {
      const validToken = await ensureValidToken();
      return addToQueueService(uri, validToken, ensureValidToken);
    },
    [ensureValidToken]
  );

  const getQueue = useCallback(() => getQueueService(), []);

  const playUriWithSkipToUri = useCallback((uri: string, skipToUri: string) => {
    return playUriWithSkipToUriService(uri, skipToUri);
  }, []);

  const getPlaybackState = useCallback(
    (): Promise<SpotifyCurrentlyPlaying | null> => getPlaybackStateService(),
    []
  );

  const getCurrentTrack = useCallback(() => getCurrentTrackService(), []);

  const getAlbumArt = useCallback(
    (uri?: string, size?: string) => getAlbumArtService(uri, size),
    []
  );

  const startPlayback = useCallback(async () => {
    return await startPlaybackService();
  }, []);

  const pausePlayback = useCallback(async () => {
    return await pausePlaybackService();
  }, []);

  // Pause playback when Echo leaves the foreground (backgrounded or closed)
  // so music/podcasts don't keep playing after you exit the app.
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (appStateRef.current === "active" && nextState === "background") {
        pausePlaybackService().catch(() => {
          // ignore — nothing playing or not connected
        });
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  const skipToNext = useCallback(async () => {
    return await skipToNextService();
  }, []);

  const skipToPrevious = useCallback(async () => {
    return await skipToPreviousService();
  }, []);

  const toggleShuffle = useCallback(
    (state: boolean) => toggleShuffleService(state),
    []
  );

  const toggleRepeat = useCallback(
    (state: "off" | "context" | "track") => toggleRepeatService(state),
    []
  );

  const seekToPosition = useCallback(
    (positionMs: number) => seekToPositionService(positionMs),
    []
  );

  const addToLibrary = useCallback(
    (uri: string) => addToLibraryService(uri, accessToken),
    [accessToken]
  );

  const removeFromLibrary = useCallback(
    (uri: string) => removeFromLibraryService(uri, accessToken),
    [accessToken]
  );

  const getLibraryState = useCallback(
    (uri: string) => getLibraryStateService(uri),
    []
  );

  const forceAppRemoteConnectionMethod =
    useCallback(async (): Promise<boolean> => {
      return await forceAppRemoteConnectionService();
    }, []);

  const value: PlaybackContextType = useMemo(
    () => ({
      isConnectedToAppRemote,
      playTracksWithWebApi,
      playTrackWithContext,
      playContext,
      playUriWithSkipToUri,
      addToQueue,
      getQueue,
      getPlaybackState,
      getCurrentTrack,
      getAlbumArt,
      startPlayback,
      pausePlayback,
      skipToNext,
      skipToPrevious,
      toggleShuffle,
      toggleRepeat,
      seekToPosition,
      addToLibrary,
      removeFromLibrary,
      getLibraryState,
      forceAppRemoteConnection: forceAppRemoteConnectionMethod,
    }),
    [
      isConnectedToAppRemote,
      playTracksWithWebApi,
      playTrackWithContext,
      playContext,
      playUriWithSkipToUri,
      addToQueue,
      getQueue,
      getPlaybackState,
      getCurrentTrack,
      getAlbumArt,
      startPlayback,
      pausePlayback,
      skipToNext,
      skipToPrevious,
      toggleShuffle,
      toggleRepeat,
      seekToPosition,
      addToLibrary,
      removeFromLibrary,
      getLibraryState,
      forceAppRemoteConnectionMethod,
    ]
  );

  return (
    <PlaybackContext.Provider value={value}>
      {children}
    </PlaybackContext.Provider>
  );
};

export const usePlayback = () => {
  const context = useContext(PlaybackContext);
  if (context === undefined) {
    throw new Error("usePlayback must be used within a PlaybackProvider");
  }
  return context;
};
