import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSavedEpisodesStore } from "@/features/library/stores";
import { usePlayback } from "@/features/playback";
import { useSettings } from "@/features/settings";
import {
  ContentContainer,
  CustomScrollView,
  FallbackImage,
  HapticPressable,
  StyledText,
} from "@/shared/components";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import type { SpotifyEpisode } from "@/shared/types/spotify";
import type { EpisodeChapter } from "@/shared/utils";
import {
  formatDuration,
  getLargestImage,
  log,
  logError,
  n,
  parseEpisodeChapters,
} from "@/shared/utils";
import { apiGet } from "@/shared/utils/api-client";

const formatTimestamp = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;
  if (hours > 0) {
    const paddedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }
  return `${minutes}:${paddedSeconds}`;
};

const getResumeMs = (episode: SpotifyEpisode | null): number | undefined => {
  const resumePoint = episode?.resume_point;
  if (resumePoint && !resumePoint.fully_played) {
    return resumePoint.resume_position_ms;
  }
  return undefined;
};

const buildMetaLine = (episode: SpotifyEpisode): string => {
  const parts: string[] = [];
  if (episode.release_date) {
    parts.push(new Date(episode.release_date).toLocaleDateString());
  }
  parts.push(formatDuration(episode.duration_ms, true));

  const resumePoint = episode.resume_point;
  if (resumePoint?.fully_played) {
    parts.push("Played");
  } else if (resumePoint && resumePoint.resume_position_ms > 0) {
    const remaining = Math.max(
      episode.duration_ms - resumePoint.resume_position_ms,
      0
    );
    parts.push(`${formatDuration(remaining, true)} left`);
  }

  if (episode.explicit) {
    parts.push("Explicit");
  }

  return parts.join(" · ");
};

export default function EpisodeDetailScreen() {
  const { id, episodeString, episodeName, showName } = useLocalSearchParams<{
    id: string;
    episodeString?: string;
    episodeName?: string;
    showName?: string;
  }>();

  const { playContext, addToQueue } = usePlayback();
  const { triggerHaptic, hideDetailCovers } = useSettings();
  const { isOnline } = useNetworkState();
  const router = useRouter();
  const saveEpisode = useSavedEpisodesStore((s) => s.saveEpisode);
  const removeEpisode = useSavedEpisodesStore((s) => s.removeEpisode);
  const checkIfSaved = useSavedEpisodesStore((s) => s.checkIfSaved);
  const [isSaved, setIsSaved] = useState(false);

  const initialEpisode = useMemo(() => {
    if (!episodeString) {
      return null;
    }
    try {
      return JSON.parse(episodeString) as SpotifyEpisode;
    } catch {
      return null;
    }
  }, [episodeString]);

  const [fetchedEpisode, setEpisode] = useState<SpotifyEpisode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(
    !initialEpisode?.description
  );
  const [aboutExpanded, setAboutExpanded] = useState(false);

  const episode = fetchedEpisode ?? initialEpisode;
  const displayName = episode?.name ?? episodeName ?? "Episode";
  const displayShowName = episode?.show?.name ?? showName ?? "";
  const imageUrl =
    getLargestImage(episode?.images) ?? getLargestImage(episode?.show?.images);

  useEffect(() => {
    if (!id) {
      setError("Episode ID is missing.");
      setIsInitialLoading(false);
      return;
    }

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: data fetching with offline and cache fallbacks
    const fetchEpisode = async () => {
      if (!isOnline) {
        if (!initialEpisode?.description) {
          setError(
            "No cached data available. Connect to the internet to load this episode."
          );
        }
        setIsInitialLoading(false);
        return;
      }

      try {
        const data = await apiGet<SpotifyEpisode>(
          `https://api.spotify.com/v1/episodes/${id}?market=from_token`
        );
        if (data) {
          log("Episode details: Fetched fresh data from API");
          setEpisode(data);
        } else if (!initialEpisode?.description) {
          setError("Failed to fetch episode details.");
        }
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : "An unexpected error occurred.";
        logError("Error fetching episode details:", e);
        if (!initialEpisode?.description) {
          setError(message);
        }
      } finally {
        setIsInitialLoading(false);
      }
    };

    fetchEpisode();
  }, [id, initialEpisode?.description, isOnline]);

  const chapters = useMemo(
    () =>
      episode
        ? parseEpisodeChapters(episode.description, episode.duration_ms)
        : [],
    [episode]
  );

  const navigateToPlaying = useCallback(
    (target: SpotifyEpisode) => {
      router.push({
        pathname: "/playing",
        params: {
          trackName: target.name ?? "",
          artistName: target.show?.name ?? "",
          albumArtUrl:
            getLargestImage(target.images) ??
            getLargestImage(target.show?.images) ??
            "",
          durationMs: target.duration_ms?.toString() ?? "0",
        },
      });
    },
    [router]
  );

  const playFromPosition = useCallback(
    async (target: SpotifyEpisode, positionMs?: number) => {
      const showUri =
        target.show?.uri ?? `spotify:show:${target.show?.id ?? ""}`;
      await playContext(showUri, {
        offsetUri: target.uri,
        positionMs,
      });
    },
    [playContext]
  );

  const handlePlay = usePreventDoubleTap(async () => {
    if (!episode) {
      return;
    }
    try {
      await playFromPosition(episode, getResumeMs(episode));
      navigateToPlaying(episode);
    } catch (playError) {
      logError("Error playing episode:", playError);
      navigateToPlaying(episode);
    }
  });

  const handlePlayChapter = usePreventDoubleTap(async (positionMs: number) => {
    if (!episode) {
      return;
    }
    try {
      await playFromPosition(episode, positionMs);
      navigateToPlaying(episode);
    } catch (playError) {
      logError("Error playing chapter:", playError);
    }
  });

  useEffect(() => {
    if (!(id && isOnline)) {
      return;
    }
    let cancelled = false;
    checkIfSaved(id)
      .then((saved) => {
        if (!cancelled) {
          setIsSaved(saved);
        }
      })
      .catch(() => {
        // ignore; leave default
      });
    return () => {
      cancelled = true;
    };
  }, [id, isOnline, checkIfSaved]);

  const handleToggleSave = usePreventDoubleTap(async () => {
    if (!episode) {
      return;
    }
    triggerHaptic();
    const next = !isSaved;
    setIsSaved(next);
    const ok = next
      ? await saveEpisode(episode)
      : await removeEpisode(episode.id);
    if (!ok) {
      setIsSaved(!next);
    }
  });

  const handleAddToQueue = useCallback(async () => {
    if (!episode?.uri) {
      return;
    }
    triggerHaptic();
    try {
      await addToQueue(episode.uri);
    } catch (queueError) {
      logError("Error adding episode to queue:", queueError);
    }
  }, [addToQueue, episode?.uri, triggerHaptic]);

  const handleShowPress = usePreventDoubleTap(() => {
    if (isOnline && episode?.show?.id) {
      router.push({
        pathname: "/podcast/[id]",
        params: { id: episode.show.id, showName: episode.show.name },
      });
    }
  });

  const renderHeader = () => (
    <View>
      {!hideDetailCovers && (
        <View style={styles.imageContainer}>
          <FallbackImage
            placeholderIcon="mic"
            style={styles.image}
            uri={imageUrl}
          />
        </View>
      )}
      <StyledText style={styles.title}>{displayName}</StyledText>
      {displayShowName ? (
        <HapticPressable
          disabled={!(isOnline && episode?.show?.id)}
          onPress={handleShowPress}
        >
          <StyledText numberOfLines={1} style={styles.showName}>
            {displayShowName}
          </StyledText>
        </HapticPressable>
      ) : null}
      {episode ? (
        <StyledText style={styles.meta}>{buildMetaLine(episode)}</StyledText>
      ) : null}

      <View style={styles.actions}>
        <HapticPressable onPress={handlePlay} style={styles.actionButton}>
          <MaterialIcons color="white" name="play-arrow" size={n(32)} />
          <StyledText style={styles.actionLabel}>Play</StyledText>
        </HapticPressable>
        <HapticPressable onPress={handleToggleSave} style={styles.actionButton}>
          <MaterialIcons
            color="white"
            name={isSaved ? "bookmark" : "bookmark-border"}
            size={n(28)}
          />
          <StyledText style={styles.actionLabel}>
            {isSaved ? "Saved" : "Save"}
          </StyledText>
        </HapticPressable>
        <HapticPressable onPress={handleAddToQueue} style={styles.actionButton}>
          <MaterialIcons color="white" name="queue-music" size={n(28)} />
          <StyledText style={styles.actionLabel}>Queue</StyledText>
        </HapticPressable>
      </View>

      {chapters.length > 0 ? (
        <StyledText style={styles.sectionLabel}>Chapters</StyledText>
      ) : null}
    </View>
  );

  const renderFooter = () => {
    if (!episode?.description) {
      return null;
    }
    const isLongAbout = episode.description.length > 280;
    return (
      <View style={styles.descriptionSection}>
        <StyledText style={styles.sectionLabel}>About</StyledText>
        <StyledText
          numberOfLines={isLongAbout && !aboutExpanded ? 6 : undefined}
          style={styles.description}
        >
          {episode.description}
        </StyledText>
        {isLongAbout ? (
          <HapticPressable onPress={() => setAboutExpanded((value) => !value)}>
            <StyledText style={styles.showMore}>
              {aboutExpanded ? "Show less" : "Show more"}
            </StyledText>
          </HapticPressable>
        ) : null}
      </View>
    );
  };

  if (error && !episode) {
    return (
      <ContentContainer
        headerTitle={displayName}
        style={{ paddingHorizontal: n(20) }}
      >
        <StyledText style={styles.errorText}>{error}</StyledText>
      </ContentContainer>
    );
  }

  if (isInitialLoading && !episode) {
    return (
      <ContentContainer
        headerTitle={displayName}
        style={{ paddingHorizontal: n(20) }}
      />
    );
  }

  return (
    <ContentContainer
      headerTitle={displayName}
      style={{ paddingHorizontal: n(20) }}
    >
      <View style={styles.listWrapper}>
        <CustomScrollView
          data={chapters}
          keyExtractor={(item: EpisodeChapter, index: number) =>
            `${item.positionMs}-${index}`
          }
          ListFooterComponent={renderFooter()}
          ListHeaderComponent={renderHeader()}
          overScrollMode="never"
          renderItem={({ item }: { item: EpisodeChapter }) => (
            <HapticPressable
              onPress={() => handlePlayChapter(item.positionMs)}
              style={styles.chapterRow}
            >
              <StyledText style={styles.chapterTime}>
                {formatTimestamp(item.positionMs)}
              </StyledText>
              <StyledText numberOfLines={2} style={styles.chapterTitle}>
                {item.title}
              </StyledText>
            </HapticPressable>
          )}
        />
      </View>
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  listWrapper: {
    flex: 1,
    paddingBottom: n(20),
  },
  imageContainer: {
    alignItems: "center",
    paddingBottom: n(20),
  },
  image: {
    width: n(200),
    height: n(200),
  },
  title: {
    fontSize: n(26),
    marginBottom: n(6),
  },
  showName: {
    fontSize: n(16),
    textDecorationLine: "underline",
    marginBottom: n(8),
  },
  meta: {
    fontSize: n(16),
    marginBottom: n(16),
  },
  actions: {
    flexDirection: "row",
    gap: n(28),
    marginBottom: n(24),
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: n(6),
  },
  actionLabel: {
    fontSize: n(20),
  },
  sectionLabel: {
    fontSize: n(16),
    marginBottom: n(12),
  },
  chapterRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingBottom: n(16),
    gap: n(12),
  },
  chapterTime: {
    fontSize: n(18),
    width: n(72),
  },
  chapterTitle: {
    flex: 1,
    fontSize: n(18),
  },
  descriptionSection: {
    marginTop: n(8),
  },
  description: {
    fontSize: n(16),
    lineHeight: n(22),
  },
  showMore: {
    fontSize: n(16),
    textDecorationLine: "underline",
    marginTop: n(10),
  },
  errorText: {
    fontSize: n(16),
    textAlign: "center",
    marginTop: n(20),
  },
});
