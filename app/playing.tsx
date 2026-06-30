import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import AutoScroll from "@homielab/react-native-auto-scroll";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  type TextStyle,
  View,
} from "react-native";
import { useAuth } from "@/features/auth";
import { useSavedEpisodesStore } from "@/features/library/stores";
import { usePlayback } from "@/features/playback";
import { useSettings } from "@/features/settings";
import { spotify } from "@/modules/spotify-sdk";
import ContentContainer from "@/shared/components/ContentContainer";
import { FallbackImage } from "@/shared/components/FallbackImage";
import { HapticPressable } from "@/shared/components/HapticPressable";
import { StyledText } from "@/shared/components/StyledText";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import type {
  SpotifyCurrentlyPlaying,
  SpotifyEpisode,
  SpotifyTrackSimple,
} from "@/shared/types/spotify";
import type { EpisodeChapter } from "@/shared/utils";
import {
  getArtistNames,
  getCurrentChapterIndex,
  log,
  logError,
  n,
  parseEpisodeChapters,
  setAlbumNavigationImage,
} from "@/shared/utils";
import { apiGet } from "@/shared/utils/api-client";

function MarqueeText({
  children,
  style,
  msPerChar = 380,
  delay = 1800,
  isActive = true,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
  msPerChar?: number;
  delay?: number;
  isActive?: boolean;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  const handleContainerLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  }, []);

  const handleTextLayout = useCallback((event: LayoutChangeEvent) => {
    setTextWidth(event.nativeEvent.layout.width);
  }, []);

  const shouldScroll =
    isActive && textWidth > containerWidth + 5 && containerWidth > 0;
  const duration = children.length * msPerChar;

  return (
    <View onLayout={handleContainerLayout} style={styles.marqueeContainer}>
      <View pointerEvents="none" style={styles.marqueeMeasuringContainer}>
        <StyledText onLayout={handleTextLayout} style={style}>
          {children}
        </StyledText>
      </View>

      {shouldScroll ? (
        <AutoScroll
          delay={delay}
          duration={duration}
          endPaddingWidth={n(25)}
          style={styles.marqueeScrollContainer}
        >
          <StyledText style={style}>{children}</StyledText>
        </AutoScroll>
      ) : (
        <StyledText numberOfLines={1} style={style}>
          {children}
        </StyledText>
      )}
    </View>
  );
}

let cachedPlaybackState: SpotifyCurrentlyPlaying | null = null;
interface PlayingRouteParams {
  trackName?: string;
  artistName?: string;
  albumArtUrl?: string;
  durationMs?: string;
  sourceContext?: string;
}
const ROUTE_PLAYBACK_TIMEOUT_MS = 4000;

const formatTime = (ms: number | null | undefined): string => {
  if (ms === null || ms === undefined) {
    return "0:00";
  }
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

const getRouteTrackKey = (params: PlayingRouteParams): string | null => {
  if (!params.trackName) {
    return null;
  }

  return [
    params.trackName,
    params.artistName ?? "",
    params.durationMs ?? "",
  ].join("::");
};

const getPlaybackTrackKey = (
  state: SpotifyCurrentlyPlaying | null
): string | null => {
  const item = state?.item;
  if (
    !item ||
    state?.currently_playing_type !== "track" ||
    item.type === "episode"
  ) {
    return null;
  }

  const track = item as SpotifyTrackSimple;
  return [
    track.name ?? "",
    getArtistNames(track.artists ?? []),
    track.duration_ms?.toString() ?? "",
  ].join("::");
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: large screen component with playback controls
export default function PlayingScreen() {
  const { appState } = useAuth();
  const {
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
    getPlaybackState,
  } = usePlayback();
  const {
    invertColors,
    hideLikeButton,
    hideDevicesButton,
    hideAddToPlaylistButton,
    hideLyricsButton,
    hideQueueButton,
    hidePlayingCover,
  } = useSettings();
  const { isOnline } = useNetworkState();
  const saveEpisodeStore = useSavedEpisodesStore((s) => s.saveEpisode);
  const removeEpisodeStore = useSavedEpisodesStore((s) => s.removeEpisode);
  const checkEpisodeSaved = useSavedEpisodesStore((s) => s.checkIfSaved);
  const params = useLocalSearchParams<{
    trackName?: string;
    artistName?: string;
    albumArtUrl?: string;
    durationMs?: string;
    sourceContext?: string;
  }>();

  const paramsState = useMemo(
    () =>
      params.trackName
        ? ({
            is_playing: true,
            progress_ms: 0,
            item: {
              name: params.trackName,
              artists: params.artistName
                ? [
                    {
                      name: params.artistName,
                      id: "",
                      uri: "",
                      href: "",
                      type: "artist",
                      external_urls: { spotify: "" },
                    },
                  ]
                : [],
              album: params.albumArtUrl
                ? { images: [{ url: params.albumArtUrl }] }
                : undefined,
              duration_ms: params.durationMs
                ? Number.parseInt(params.durationMs, 10)
                : 0,
              id: "",
              uri: "",
              type: "track",
            },
          } as SpotifyCurrentlyPlaying)
        : null,
    [params.trackName, params.artistName, params.albumArtUrl, params.durationMs]
  );

  const initialState = paramsState ?? cachedPlaybackState;

  const [playbackState, setPlaybackState] =
    useState<SpotifyCurrentlyPlaying | null>(initialState);
  const [isRoutePlaybackPending, setIsRoutePlaybackPending] = useState(
    paramsState !== null
  );
  const [isCurrentTrackSaved, setIsCurrentTrackSaved] = useState(false);
  const [pendingSaveOperation, setPendingSaveOperation] = useState(false);
  const [optimisticSaveState, setOptimisticSaveState] = useState<
    boolean | null
  >(null);
  const [episodeChapters, setEpisodeChapters] = useState<EpisodeChapter[]>([]);
  const chaptersEpisodeIdRef = useRef<string | null>(null);
  const [displayPositionMs, setDisplayPositionMs] = useState(
    initialState?.progress_ms ?? 0
  );
  const positionBaseMsRef = useRef(initialState?.progress_ms ?? 0);
  const positionBaseAtRef = useRef(Date.now());
  const durationMsRef = useRef(0);

  const progress = useRef(new Animated.Value(0)).current;
  const progressBarWidthRef = useRef<number | null>(null);
  const appStateRef = useRef(appState);
  const isFocusedRef = useRef(true);
  const lastCheckedTrackUriRef = useRef<string | null>(null);
  const isPlayingRef = useRef(false);
  const pausePollingUntilRef = useRef<number | null>(null);
  const routePlaybackExpiresAtRef = useRef<number | null>(
    paramsState !== null ? Date.now() + ROUTE_PLAYBACK_TIMEOUT_MS : null
  );

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  const clearPendingRoutePlayback = useCallback(() => {
    routePlaybackExpiresAtRef.current = null;
    setIsRoutePlaybackPending(false);
  }, []);

  const routeTrackKey = getRouteTrackKey(params);
  const isPendingRoutePlayback = isRoutePlaybackPending && paramsState !== null;
  const isPendingLikedSongPlayback =
    isPendingRoutePlayback && params.sourceContext === "liked";
  const visiblePlaybackState = isPendingRoutePlayback
    ? paramsState
    : playbackState;
  const displayedLikeState =
    isPendingLikedSongPlayback || (optimisticSaveState ?? isCurrentTrackSaved);

  useEffect(() => {
    if (!isPendingRoutePlayback) {
      return;
    }

    progress.setValue(0);
    positionBaseMsRef.current = 0;
    positionBaseAtRef.current = Date.now();
    setDisplayPositionMs(0);
    lastCheckedTrackUriRef.current = null;
    setIsCurrentTrackSaved(isPendingLikedSongPlayback);
    setOptimisticSaveState(null);
  }, [isPendingLikedSongPlayback, isPendingRoutePlayback, progress]);

  const applyPosition = useCallback(
    (positionMs: number, durationMs: number) => {
      durationMsRef.current = durationMs;
      positionBaseMsRef.current = positionMs;
      positionBaseAtRef.current = Date.now();
      setDisplayPositionMs(positionMs);
      if (durationMs > 0 && positionMs > 0) {
        progress.setValue(Math.min(positionMs / durationMs, 1));
      } else {
        progress.setValue(0);
      }
    },
    [progress]
  );

  const checkIfTrackIsSaved = useCallback(
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: track save check with multiple conditions
    async (state: SpotifyCurrentlyPlaying | null): Promise<void> => {
      if (
        pausePollingUntilRef.current &&
        Date.now() < pausePollingUntilRef.current
      ) {
        return;
      }

      const item = state?.item;
      const trackId =
        item && "id" in item ? (item as { id?: string }).id : null;
      const trackUri =
        item && "uri" in item ? (item as { uri?: string }).uri : null;
      const isEpisode =
        state?.currently_playing_type === "episode" || item?.type === "episode";

      if (isEpisode) {
        const episodeUri =
          trackUri || (trackId ? `spotify:episode:${trackId}` : null);
        if (!(episodeUri && trackId)) {
          lastCheckedTrackUriRef.current = null;
          setIsCurrentTrackSaved(false);
          return;
        }
        if (lastCheckedTrackUriRef.current === episodeUri) {
          return;
        }
        const saved = await checkEpisodeSaved(trackId);
        lastCheckedTrackUriRef.current = episodeUri;
        setIsCurrentTrackSaved(saved);
        return;
      }

      const normalizedTrackUri =
        trackUri || (trackId ? `spotify:track:${trackId}` : null);
      if (!normalizedTrackUri || state?.currently_playing_type !== "track") {
        lastCheckedTrackUriRef.current = null;
        setIsCurrentTrackSaved(false);
        return;
      }

      if (lastCheckedTrackUriRef.current === normalizedTrackUri) {
        return;
      }

      const result = await getLibraryState(normalizedTrackUri);
      if (result) {
        lastCheckedTrackUriRef.current = normalizedTrackUri;
        setIsCurrentTrackSaved(result.isAdded);
      } else {
        lastCheckedTrackUriRef.current = null;
      }
    },
    [getLibraryState, checkEpisodeSaved]
  );

  const fetchAndUpdatePlaybackState = useCallback(async () => {
    const state = (await getPlaybackState()) as SpotifyCurrentlyPlaying | null;
    const playbackTrackKey = getPlaybackTrackKey(state);

    if (
      isRoutePlaybackPending &&
      (playbackTrackKey === routeTrackKey ||
        (routePlaybackExpiresAtRef.current !== null &&
          Date.now() >= routePlaybackExpiresAtRef.current))
    ) {
      clearPendingRoutePlayback();
    }

    if (state) {
      cachedPlaybackState = state;
    }
    setPlaybackState(state);
    isPlayingRef.current = state?.is_playing ?? false;

    if (state?.item && "duration_ms" in state.item) {
      applyPosition(state.progress_ms ?? 0, state.item.duration_ms ?? 0);
    } else {
      applyPosition(0, 0);
    }

    await checkIfTrackIsSaved(state);

    return state;
  }, [
    applyPosition,
    checkIfTrackIsSaved,
    clearPendingRoutePlayback,
    getPlaybackState,
    isRoutePlaybackPending,
    routeTrackKey,
  ]);

  const handlePlayPause = async () => {
    if (!playbackState) {
      return;
    }

    try {
      if (playbackState.is_playing) {
        await pausePlayback();
      } else {
        await startPlayback();
      }
      await fetchAndUpdatePlaybackState();
    } catch (error) {
      logError("Error toggling playback:", error);
    }
  };

  const handleSkipToNext = async () => {
    try {
      await skipToNext();
      clearPendingRoutePlayback();
      await fetchAndUpdatePlaybackState();
    } catch (error) {
      logError("Error skipping to next track:", error);
    }
  };

  const handleSkipToPrevious = async () => {
    try {
      await skipToPrevious();
      clearPendingRoutePlayback();
      await fetchAndUpdatePlaybackState();
    } catch (error) {
      logError("Error skipping to previous track:", error);
    }
  };

  const handleSeekBackward = async () => {
    if (!playbackState?.item) {
      return;
    }

    const currentPosition = playbackState.progress_ms ?? 0;
    const newPosition = Math.max(currentPosition - 15_000, 0);

    try {
      await seekToPosition(newPosition);
      applyPosition(newPosition, playbackState.item.duration_ms ?? 0);
      await fetchAndUpdatePlaybackState();
    } catch (error) {
      logError("Error seeking backward:", error);
    }
  };

  const handleSeekForward = async (amountMs = 15_000) => {
    if (!playbackState?.item) {
      return;
    }

    const currentPosition = playbackState.progress_ms ?? 0;
    const totalDuration = playbackState.item.duration_ms;
    if (!totalDuration) {
      return;
    }

    const newPosition = Math.min(currentPosition + amountMs, totalDuration);

    try {
      await seekToPosition(newPosition);
      applyPosition(newPosition, totalDuration);
      await fetchAndUpdatePlaybackState();
    } catch (error) {
      logError("Error seeking forward:", error);
    }
  };

  const handleShuffleToggle = async () => {
    if (!playbackState) {
      return;
    }

    try {
      await toggleShuffle(!playbackState.shuffle_state);
      await fetchAndUpdatePlaybackState();
    } catch (error) {
      logError("Error toggling shuffle:", error);
    }
  };

  const handleRepeatToggle = async () => {
    if (!playbackState) {
      return;
    }

    try {
      let newState: "off" | "context" | "track";
      if (playbackState.repeat_state === "off") {
        newState = "context";
      } else if (playbackState.repeat_state === "context") {
        newState = "track";
      } else {
        newState = "off";
      }
      await toggleRepeat(newState);
      await fetchAndUpdatePlaybackState();
    } catch (error) {
      logError("Error toggling repeat:", error);
    }
  };

  const handleProgressBarSeek = async (event: GestureResponderEvent) => {
    if (!(playbackState?.item && progressBarWidthRef.current)) {
      return;
    }

    const tapPositionX = event.nativeEvent.locationX;
    const totalDurationMs = playbackState.item.duration_ms;
    const seekPositionMs =
      (tapPositionX / progressBarWidthRef.current) * totalDurationMs;

    try {
      await seekToPosition(seekPositionMs);
      applyPosition(seekPositionMs, totalDurationMs);
      await fetchAndUpdatePlaybackState();
    } catch (error) {
      logError("Error seeking track:", error);
    }
  };

  const handleToggleSaveTrack = async () => {
    const item = playbackState?.item;
    if (!item?.id) {
      return;
    }

    const isEpisodeItem =
      playbackState?.currently_playing_type === "episode" ||
      item.type === "episode";
    const currentlySaved = isCurrentTrackSaved;

    setPendingSaveOperation(true);
    setOptimisticSaveState(!currentlySaved);
    setIsCurrentTrackSaved(!currentlySaved);
    pausePollingUntilRef.current = Date.now() + 3000;

    let success: boolean;
    if (isEpisodeItem) {
      success = currentlySaved
        ? await removeEpisodeStore(item.id)
        : await saveEpisodeStore(item as SpotifyEpisode);
    } else {
      const trackUri = `spotify:track:${item.id}`;
      success = currentlySaved
        ? await removeFromLibrary(trackUri)
        : await addToLibrary(trackUri);
    }

    if (success) {
      setTimeout(() => {
        setOptimisticSaveState(null);
        pausePollingUntilRef.current = null;
        lastCheckedTrackUriRef.current = null;
      }, 3000);
    } else {
      setIsCurrentTrackSaved(currentlySaved);
      setOptimisticSaveState(null);
      pausePollingUntilRef.current = null;
    }
    setPendingSaveOperation(false);
  };

  const handleNavigateToAddToPlaylist = usePreventDoubleTap(() => {
    if (
      playbackState?.item?.uri &&
      playbackState.currently_playing_type === "track" &&
      playbackState.item.type !== "episode"
    ) {
      log(
        "Navigating to add-to-playlist with trackUri:",
        playbackState.item.uri
      );
      router.push({
        pathname: "/add-to-playlist",
        params: { trackUri: playbackState.item.uri },
      });
    } else {
      console.warn(
        "Cannot navigate to add to playlist: No track playing or track URI is missing."
      );
    }
  });

  const handleNavigateToLyrics = usePreventDoubleTap(() => {
    if (
      playbackState?.item &&
      playbackState.currently_playing_type === "track" &&
      playbackState.item.type !== "episode"
    ) {
      const track = playbackState.item as SpotifyTrackSimple;
      log("Navigating to lyrics with track:", track.name);
      router.push({
        pathname: "/lyrics",
        params: {
          trackName: track.name,
          artistName: getArtistNames(track.artists),
          albumName: track.album?.name,
          durationMs: track.duration_ms?.toString(),
        },
      });
    } else {
      console.warn("Cannot navigate to lyrics: No track playing.");
    }
  });

  useFocusEffect(
    React.useCallback(() => {
      isFocusedRef.current = true;

      const fetchAll = async () => {
        if (!isFocusedRef.current || appStateRef.current !== "active") {
          return;
        }

        await fetchAndUpdatePlaybackState();
      };

      fetchAll();

      // Push: sync immediately when the SDK reports a state change (track
      // change, play/pause, seek). This replaces most of the polling.
      const unsubscribe = spotify.onPlayerStateChanged(() => {
        fetchAll();
      });

      // Local tick: advance the progress bar/time from the last known
      // position without any native call. Runs only while playing.
      const tickId = setInterval(() => {
        if (
          !isPlayingRef.current ||
          routePlaybackExpiresAtRef.current !== null
        ) {
          return;
        }
        const duration = durationMsRef.current;
        if (duration <= 0) {
          return;
        }
        const elapsed = Date.now() - positionBaseAtRef.current;
        const positionMs = Math.min(
          positionBaseMsRef.current + elapsed,
          duration
        );
        setDisplayPositionMs(positionMs);
        progress.setValue(Math.min(positionMs / duration, 1));
      }, 1000);

      // Low-frequency native reconcile to correct drift and catch changes the
      // push subscription may miss.
      const reconcileId = setInterval(() => {
        if (
          isPlayingRef.current ||
          routePlaybackExpiresAtRef.current !== null
        ) {
          fetchAll();
        }
      }, 5000);

      return () => {
        isFocusedRef.current = false;
        clearInterval(tickId);
        clearInterval(reconcileId);
        unsubscribe();
        log("PlayingScreen unfocused, cleared timers.");
      };
    }, [fetchAndUpdatePlaybackState, progress])
  );

  const playingEpisodeId =
    playbackState?.currently_playing_type === "episode" &&
    playbackState.item &&
    "id" in playbackState.item &&
    playbackState.item.id
      ? playbackState.item.id
      : null;

  useEffect(() => {
    if (!(playingEpisodeId && isOnline)) {
      chaptersEpisodeIdRef.current = null;
      setEpisodeChapters([]);
      return;
    }

    if (chaptersEpisodeIdRef.current === playingEpisodeId) {
      return;
    }
    chaptersEpisodeIdRef.current = playingEpisodeId;

    let cancelled = false;
    const fetchChapters = async () => {
      const data = await apiGet<SpotifyEpisode>(
        `https://api.spotify.com/v1/episodes/${playingEpisodeId}?market=from_token`
      );
      if (cancelled) {
        return;
      }
      setEpisodeChapters(
        data ? parseEpisodeChapters(data.description, data.duration_ms) : []
      );
    };

    fetchChapters();

    return () => {
      cancelled = true;
    };
  }, [playingEpisodeId, isOnline]);

  const item = visiblePlaybackState?.item ?? null;

  const isEpisode =
    visiblePlaybackState?.currently_playing_type === "episode" ||
    item?.type === "episode";
  const currentEpisode = isEpisode ? (item as SpotifyEpisode) : null;
  const currentTrack = !isEpisode && item ? (item as SpotifyTrackSimple) : null;
  const artworkUrl =
    (isPendingRoutePlayback && params.albumArtUrl) ||
    (isEpisode
      ? currentEpisode?.images?.[0]?.url ||
        currentEpisode?.show?.images?.[0]?.url
      : currentTrack?.album?.images?.[0]?.url);
  const displayTitle = isEpisode
    ? (currentEpisode?.name ?? "")
    : (currentTrack?.name ?? "");
  const subtitleParts = isEpisode
    ? [currentEpisode?.show?.name, currentEpisode?.show?.publisher].filter(
        (value): value is string => !!value
      )
    : [];
  const episodeSubtitle =
    subtitleParts.length > 0 ? subtitleParts.join(" • ") : "Podcast";
  const trackSubtitle = currentTrack
    ? getArtistNames(currentTrack.artists)
    : "";
  const displaySubtitle = isEpisode ? episodeSubtitle : trackSubtitle;
  const canNavigateToShow = isEpisode && isOnline && !!currentEpisode?.show?.id;
  const canViewEpisode = isEpisode && isOnline && !!currentEpisode?.id;
  const canNavigateToAlbum =
    !isEpisode && isOnline && !!currentTrack?.album?.id;

  const episodeDurationMs =
    isEpisode && item?.duration_ms ? item.duration_ms : 0;
  const hasChapters =
    isEpisode &&
    !isPendingRoutePlayback &&
    episodeDurationMs > 0 &&
    episodeChapters.length > 0;
  const currentChapterIndex = hasChapters
    ? getCurrentChapterIndex(
        episodeChapters,
        visiblePlaybackState?.progress_ms ?? 0
      )
    : -1;
  const currentChapterTitle =
    currentChapterIndex >= 0
      ? episodeChapters[currentChapterIndex].title
      : null;

  const showLikeButton = !hideLikeButton;
  const showDevicesButton = !hideDevicesButton;
  const showLyricsButton = !(hideLyricsButton || isEpisode);
  const showAddButton = !(hideAddToPlaylistButton || isEpisode);
  const showQueueButton = !hideQueueButton;
  const visibleButtonCount = [
    showLikeButton,
    showDevicesButton,
    showLyricsButton,
    showAddButton,
    showQueueButton,
  ].filter(Boolean).length;

  const animatedWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });
  const progressBarWidth = isPendingRoutePlayback ? "0%" : animatedWidth;

  const handleTitlePress = usePreventDoubleTap(() => {
    if (!isOnline) {
      return;
    }
    if (isEpisode && currentEpisode?.id) {
      router.push({
        pathname: "/episode/[id]",
        params: {
          id: currentEpisode.id,
          episodeName: currentEpisode.name as string,
          showName: (currentEpisode.show?.name as string) ?? "",
        },
      } as never);
    } else if (currentTrack?.album?.id) {
      if (artworkUrl) {
        setAlbumNavigationImage(currentTrack.album.id, artworkUrl);
      }
      router.push({
        pathname: "/album/[id]",
        params: {
          id: currentTrack.album.id,
          albumName: currentTrack.album.name as string,
        },
      });
    }
  });

  const handleSubtitlePress = usePreventDoubleTap(() => {
    if (!isOnline) {
      return;
    }
    if (isEpisode && currentEpisode?.show?.id) {
      router.push({
        pathname: "/podcast/[id]",
        params: {
          id: currentEpisode.show.id,
          showName: currentEpisode.show.name as string,
        },
      } as never);
    }
  });

  const handleSelectDevicePress = usePreventDoubleTap(() => {
    if (isOnline) {
      router.push({ pathname: "/select-device" as never });
    }
  });

  const handleQueuePress = usePreventDoubleTap(() => {
    if (isOnline) {
      router.push({ pathname: "/queue" as never });
    }
  });

  if (!(visiblePlaybackState && item)) {
    return (
      <ContentContainer
        headerTitle=" "
        hideNowPlaying
        style={{ paddingHorizontal: n(20) }}
      >
        <View style={styles.content}>
          <View style={styles.mainContent}>
            {!hidePlayingCover && (
              <View style={styles.placeholderImageContainer} />
            )}
            <View style={styles.trackInfoContainer}>
              <StyledText numberOfLines={1} style={styles.trackName}>
                No song playing
              </StyledText>
              <StyledText numberOfLines={1} style={styles.artistName}>
                Go back and play something!
              </StyledText>
            </View>

            <View style={styles.timeIndicatorContainer}>
              <View style={styles.progressBarPressable}>
                <View style={[styles.progressBarBackground, { opacity: 0 }]} />
              </View>
              <View style={styles.progressBarInfo}>
                <StyledText style={[styles.timeText, { opacity: 0 }]}>
                  0:00
                </StyledText>
                <StyledText style={[styles.timeText, { opacity: 0 }]}>
                  0:00
                </StyledText>
              </View>
            </View>
            <View style={[styles.musicControls, { opacity: 0 }]}>
              <MaterialIcons color="transparent" name="shuffle" size={n(30)} />
              <MaterialIcons
                color="transparent"
                name="skip-previous"
                size={n(52)}
              />
              <MaterialIcons
                color="transparent"
                name="play-arrow"
                size={n(52)}
              />
              <MaterialIcons
                color="transparent"
                name="skip-next"
                size={n(52)}
              />
              <MaterialIcons color="transparent" name="repeat" size={n(30)} />
            </View>
          </View>
          {visibleButtonCount > 0 && (
            <View style={[styles.musicControlsExtra, { opacity: 0 }]}>
              <MaterialIcons
                color="transparent"
                name="favorite-outline"
                size={n(30)}
              />
            </View>
          )}
        </View>
      </ContentContainer>
    );
  }

  return (
    <ContentContainer
      headerTitle=" "
      hideNowPlaying
      style={{ paddingHorizontal: n(20) }}
    >
      <View style={styles.content}>
        <View style={styles.mainContent}>
          {!hidePlayingCover && (
            <FallbackImage
              placeholderIcon={isEpisode ? "mic" : "music-note"}
              placeholderIconColor={invertColors ? "black" : "white"}
              style={styles.albumArt}
              uri={artworkUrl}
            />
          )}
          <View style={styles.trackInfoContainer}>
            <HapticPressable
              disabled={!(isEpisode ? canViewEpisode : canNavigateToAlbum)}
              onPress={handleTitlePress}
            >
              <MarqueeText
                isActive={isFocusedRef.current}
                style={styles.trackName}
              >
                {displayTitle}
              </MarqueeText>
            </HapticPressable>
            <HapticPressable
              disabled={!canNavigateToShow}
              onPress={handleSubtitlePress}
            >
              <MarqueeText
                isActive={isFocusedRef.current}
                style={styles.artistName}
              >
                {displaySubtitle}
              </MarqueeText>
            </HapticPressable>
          </View>

          <View style={styles.timeIndicatorContainer}>
            <HapticPressable
              onPress={handleProgressBarSeek}
              style={styles.progressBarPressable}
            >
              <View
                onLayout={(event) => {
                  progressBarWidthRef.current = event.nativeEvent.layout.width;
                }}
                style={[
                  styles.progressBarBackground,
                  { backgroundColor: invertColors ? "#C1C1C1" : "#4A4A4A" },
                ]}
              >
                <Animated.View
                  style={[
                    styles.progressBarForeground,
                    { backgroundColor: invertColors ? "black" : "white" },
                    { width: progressBarWidth },
                  ]}
                />
                {hasChapters &&
                  episodeChapters.map((chapter) => (
                    <View
                      key={chapter.positionMs}
                      style={[
                        styles.chapterTick,
                        { backgroundColor: invertColors ? "black" : "white" },
                        {
                          left: `${Math.min(
                            (chapter.positionMs / episodeDurationMs) * 100,
                            100
                          )}%`,
                        },
                      ]}
                    />
                  ))}
              </View>
            </HapticPressable>
            <View style={styles.progressBarInfo}>
              <StyledText style={styles.timeText}>
                {formatTime(isPendingRoutePlayback ? 0 : displayPositionMs)}
              </StyledText>
              <StyledText style={styles.timeText}>
                {formatTime(item.duration_ms)}
              </StyledText>
            </View>
            {currentChapterTitle ? (
              <StyledText numberOfLines={1} style={styles.chapterLabel}>
                {currentChapterTitle}
              </StyledText>
            ) : null}
          </View>
          <View
            style={[
              styles.musicControls,
              isEpisode && styles.musicControlsCentered,
            ]}
          >
            {isEpisode ? (
              <HapticPressable
                hitSlop={n(12)}
                onPress={() => handleSeekBackward()}
              >
                <MaterialCommunityIcons
                  color={invertColors ? "black" : "white"}
                  name="rewind-15"
                  size={n(44)}
                />
              </HapticPressable>
            ) : (
              <>
                <HapticPressable hitSlop={n(10)} onPress={handleShuffleToggle}>
                  <MaterialIcons
                    color={invertColors ? "black" : "white"}
                    name={"shuffle"}
                    size={n(30)}
                  />
                  <View
                    style={[
                      styles.shuffleIndicator,
                      playbackState?.shuffle_state && [
                        styles.activeShuffleIndicator,
                        { backgroundColor: invertColors ? "black" : "white" },
                      ],
                    ]}
                  />
                </HapticPressable>
                <HapticPressable hitSlop={n(10)} onPress={handleSkipToPrevious}>
                  <MaterialIcons
                    color={invertColors ? "black" : "white"}
                    name={"skip-previous"}
                    size={n(52)}
                  />
                </HapticPressable>
              </>
            )}
            <HapticPressable hitSlop={n(12)} onPress={handlePlayPause}>
              <MaterialIcons
                color={invertColors ? "black" : "white"}
                name={visiblePlaybackState.is_playing ? "pause" : "play-arrow"}
                size={n(52)}
              />
            </HapticPressable>
            {isEpisode ? (
              <HapticPressable
                hitSlop={n(12)}
                onPress={() => handleSeekForward(30_000)}
              >
                <MaterialCommunityIcons
                  color={invertColors ? "black" : "white"}
                  name="fast-forward-30"
                  size={n(44)}
                />
              </HapticPressable>
            ) : (
              <>
                <HapticPressable hitSlop={n(10)} onPress={handleSkipToNext}>
                  <MaterialIcons
                    color={invertColors ? "black" : "white"}
                    name={"skip-next"}
                    size={n(52)}
                  />
                </HapticPressable>
                <HapticPressable hitSlop={n(10)} onPress={handleRepeatToggle}>
                  <MaterialIcons
                    color={invertColors ? "black" : "white"}
                    name={
                      playbackState?.repeat_state === "track"
                        ? "repeat-one"
                        : "repeat"
                    }
                    size={n(30)}
                  />
                  <View
                    style={[
                      styles.shuffleIndicator,
                      (playbackState?.repeat_state === "context" ||
                        playbackState?.repeat_state === "track") && [
                        styles.activeShuffleIndicator,
                        { backgroundColor: invertColors ? "black" : "white" },
                      ],
                    ]}
                  />
                </HapticPressable>
              </>
            )}
          </View>
        </View>
        <View
          style={[
            styles.musicControlsExtra,
            visibleButtonCount === 1 && styles.musicControlsExtraCentered,
          ]}
        >
          {showLikeButton && (
            <HapticPressable
              disabled={
                pendingSaveOperation || !isOnline || isPendingRoutePlayback
              }
              onPress={handleToggleSaveTrack}
              style={
                (pendingSaveOperation || !isOnline) && styles.disabledButton
              }
            >
              <MaterialIcons
                color={invertColors ? "black" : "white"}
                name={(() => {
                  if (isEpisode) {
                    return displayedLikeState ? "bookmark" : "bookmark-border";
                  }
                  return displayedLikeState ? "favorite" : "favorite-outline";
                })()}
                size={n(30)}
              />
            </HapticPressable>
          )}
          {showDevicesButton && (
            <HapticPressable
              disabled={!isOnline}
              onPress={handleSelectDevicePress}
              style={!isOnline && styles.disabledButton}
            >
              <MaterialIcons
                color={invertColors ? "black" : "white"}
                name={"devices"}
                size={n(30)}
              />
            </HapticPressable>
          )}
          {showLyricsButton && (
            <HapticPressable
              disabled={!isOnline || isPendingRoutePlayback}
              onPress={() => {
                if (isOnline && !isPendingRoutePlayback) {
                  handleNavigateToLyrics();
                }
              }}
              style={!isOnline && styles.disabledButton}
            >
              <MaterialIcons
                color={invertColors ? "black" : "white"}
                name="mic-external-on"
                size={n(30)}
              />
            </HapticPressable>
          )}
          {showAddButton && (
            <HapticPressable
              disabled={!isOnline || isPendingRoutePlayback}
              onPress={() => {
                if (isOnline && !isPendingRoutePlayback) {
                  handleNavigateToAddToPlaylist();
                }
              }}
              style={!isOnline && styles.disabledButton}
            >
              <MaterialIcons
                color={invertColors ? "black" : "white"}
                name="add"
                size={n(30)}
              />
            </HapticPressable>
          )}
          {showQueueButton && (
            <HapticPressable
              disabled={!isOnline || isPendingRoutePlayback}
              onPress={() => {
                if (isOnline && !isPendingRoutePlayback) {
                  handleQueuePress();
                }
              }}
              style={!isOnline && styles.disabledButton}
            >
              <MaterialIcons
                color={invertColors ? "black" : "white"}
                name="queue-music"
                size={n(30)}
              />
            </HapticPressable>
          )}
        </View>
      </View>
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mainContent: {
    flex: 1,
    width: "100%",
    alignItems: "center",
  },
  albumArt: {
    width: n(200),
    height: n(200),
    marginBottom: n(20),
  },
  placeholderImageContainer: {
    width: n(200),
    height: n(200),
    backgroundColor: "#282828",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: n(20),
  },
  placeholderImageContainerNoGap: {
    width: n(200),
    height: n(200),
    backgroundColor: "#282828",
    justifyContent: "center",
    alignItems: "center",
  },
  trackInfoContainer: {
    alignItems: "center",
    width: "90%",
    marginBottom: n(20),
  },
  trackName: {
    fontSize: n(22),
    lineHeight: n(24),
    textAlign: "center",
  },
  artistName: {
    fontSize: n(14),
    lineHeight: n(16),
    textAlign: "center",
  },
  emptyText: {
    fontSize: n(18),
    textAlign: "center",
    marginTop: n(20),
  },
  timeIndicatorContainer: {
    width: "100%",
    alignItems: "center",
  },
  progressBarPressable: {
    width: "90%",
    paddingVertical: n(10),
  },
  progressBarBackground: {
    height: n(3),
    width: "100%",
    overflow: "visible",
    marginBottom: n(3),
  },
  progressBarForeground: {
    height: n(3),
    position: "absolute",
    top: 0,
  },
  progressBarInfo: {
    flexDirection: "row",
    width: "90%",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: n(6),
  },
  chapterTick: {
    position: "absolute",
    top: n(-4),
    width: n(2),
    height: n(10),
  },
  chapterLabel: {
    fontSize: n(12),
    width: "90%",
    textAlign: "center",
    marginBottom: n(6),
  },
  musicControls: {
    flexDirection: "row",
    width: "92%",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: n(20),
  },
  musicControlsCentered: {
    justifyContent: "center",
    gap: n(48),
  },
  musicControlsExtra: {
    flexDirection: "row",
    width: "92%",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: n(20),
  },
  musicControlsExtraCentered: {
    justifyContent: "center",
  },
  shuffleIndicator: {
    height: n(1),
    width: "100%",
    overflow: "visible",
  },
  activeShuffleIndicator: {
    height: n(1),
    width: "100%",
    overflow: "visible",
  },
  timeText: {
    fontSize: n(12),
  },
  disabledButton: {
    opacity: 0.3,
  },
  marqueeContainer: {
    width: "100%",
    overflow: "hidden",
  },
  marqueeMeasuringContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    opacity: 0,
  },
  marqueeScrollContainer: {
    width: "100%",
  },
});
