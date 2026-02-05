import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useAuth } from "@/features/auth";
import {
  getCachedShowDetail,
  saveCachedShowDetail,
  useSpotifyLibrary,
} from "@/features/library";
import { usePlayback } from "@/features/playback";
import { useSettings } from "@/features/settings";
import {
  ContentContainer,
  CustomScrollView,
  FallbackImage,
  HapticPressable,
  ListFooter,
  StyledText,
} from "@/shared/components";
import {
  useNetworkState,
  usePreventDoubleTap,
  useSaveStatus,
} from "@/shared/hooks";
import { detailScreenStyles } from "@/shared/styles/detailScreen";
import type { SpotifyEpisode, SpotifyShow } from "@/shared/types/spotify";
import {
  formatDuration,
  getLargestImage,
  log,
  logError,
  n,
} from "@/shared/utils";

export default function PodcastDetailScreen() {
  const { id, showString, showName } = useLocalSearchParams<{
    id: string;
    showString?: string;
    showName?: string;
  }>();

  const { accessToken } = useAuth();
  const { playTrackWithContext } = usePlayback();
  const {
    followPodcast,
    unfollowPodcast,
    checkIfFollowingPodcast,
    makeApiRequest,
  } = useSpotifyLibrary();
  const router = useRouter();
  const { hideDetailCovers } = useSettings();
  const { isOnline } = useNetworkState();

  const initialShow = useMemo(() => {
    if (!showString) return null;
    try {
      return JSON.parse(showString) as SpotifyShow;
    } catch {
      return null;
    }
  }, [showString]);

  const [fetchedShow, setShow] = useState<SpotifyShow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMoreEpisodes, setIsLoadingMoreEpisodes] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const show = fetchedShow ?? initialShow;
  const displayName = show?.name ?? showName ?? "Podcast";
  const displayImageUrl = getLargestImage(show?.images);

  const {
    isSaved: isShowFollowed,
    isChecking: isCheckingFollowed,
    toggle: handleToggleFollowShow,
  } = useSaveStatus({
    id,
    checkFn: checkIfFollowingPodcast,
    saveFn: followPodcast,
    removeFn: unfollowPodcast,
    accessToken,
  });

  useEffect(() => {
    if (!id) {
      setError("Podcast ID is missing.");
      return;
    }

    const fetchShowDetails = async () => {
      let hasDisplayedData = !!initialShow?.episodes?.items;

      if (!hasDisplayedData) {
        try {
          const cachedShow = await getCachedShowDetail(id);
          if (cachedShow?.episodes?.items) {
            log("Podcast details: Displaying cached data");
            setShow(cachedShow);
            hasDisplayedData = true;
          }
        } catch (error) {
          logError("Error retrieving cached show:", error);
        }
      }

      if (isOnline) {
        try {
          const data = await makeApiRequest(
            `https://api.spotify.com/v1/shows/${id}?market=from_token&limit=10`,
            "Podcast details"
          );
          if (data) {
            log("Podcast details: Fetched fresh data from API");
            setShow(data);
            await saveCachedShowDetail(data);
          } else if (!hasDisplayedData) {
            throw new Error("Failed to fetch podcast details");
          }
        } catch (e: any) {
          logError("Error fetching podcast details:", e);
          if (!hasDisplayedData) {
            setError(e.message || "An unexpected error occurred.");
          }
        }
      } else if (!hasDisplayedData) {
        setError(
          "No cached data available. Connect to the internet to load this podcast."
        );
      }

      setIsInitialLoading(false);
    };

    fetchShowDetails();
  }, [id, makeApiRequest]);

  const loadMoreEpisodes = useCallback(async () => {
    if (!show?.episodes?.next || isLoadingMoreEpisodes) {
      return;
    }
    setIsLoadingMoreEpisodes(true);
    try {
      const data = await makeApiRequest(
        show.episodes.next,
        "More podcast episodes"
      );
      if (data) {
        setShow((prevShow: SpotifyShow | null) => {
          if (!(prevShow && prevShow.episodes)) return prevShow;
          const updatedShow = {
            ...prevShow,
            episodes: {
              ...prevShow.episodes,
              items: [...prevShow.episodes.items, ...data.items],
              next: data.next,
            },
          } as SpotifyShow;
          saveCachedShowDetail(updatedShow);
          return updatedShow;
        });
      }
    } catch (e: any) {
      logError("Error fetching more podcast episodes:", e);
    } finally {
      setIsLoadingMoreEpisodes(false);
    }
  }, [show, isLoadingMoreEpisodes, makeApiRequest]);

  const episodeItems = useMemo(
    () =>
      (show?.episodes?.items || []).filter(
        (episode: unknown): episode is SpotifyEpisode =>
          !!episode &&
          typeof episode === "object" &&
          !!(episode as SpotifyEpisode).id
      ),
    [show?.episodes?.items]
  );

  const handleEpisodePress = usePreventDoubleTap(
    async (episode: SpotifyEpisode, index: number) => {
      const albumArtUrl =
        getLargestImage(episode.images) ?? getLargestImage(show?.images) ?? "";

      try {
        await playTrackWithContext(episode.uri, {
          type: "podcast",
          uri: `spotify:show:${id}`,
          currentIndex: index,
        });
        router.push({
          pathname: "/playing",
          params: {
            trackName: episode.name ?? "",
            artistName: show?.name ?? "",
            albumArtUrl,
            durationMs: episode.duration_ms?.toString() ?? "0",
          },
        });
      } catch (error) {
        logError("Error playing episode:", error);
        router.push({
          pathname: "/playing",
          params: {
            trackName: episode.name ?? "",
            artistName: show?.name ?? "",
            albumArtUrl,
            durationMs: episode.duration_ms?.toString() ?? "0",
          },
        });
      }
    }
  );

  const renderEpisodeItem = ({
    item: episode,
    index,
  }: {
    item: SpotifyEpisode;
    index: number;
  }) => (
    <HapticPressable
      onPress={() => handleEpisodePress(episode, index)}
      style={styles.episodeItemContainer}
    >
      <View style={styles.episodeInfoContainer}>
        <View style={styles.titleRow}>
          {episode.resume_point?.fully_played && (
            <MaterialIcons
              color="#ffffff"
              name="check-circle"
              size={16}
              style={{ marginTop: n(6) }}
            />
          )}
          <StyledText numberOfLines={1} style={styles.episodeName}>
            {episode.name}
          </StyledText>
        </View>
        {(() => {
          const resumePoint = episode.resume_point;
          const remainingMs =
            resumePoint && !resumePoint.fully_played
              ? Math.max(
                  episode.duration_ms - (resumePoint.resume_position_ms ?? 0),
                  0
                )
              : 0;
          const progressLabel = resumePoint
            ? resumePoint.fully_played
              ? "Played"
              : resumePoint.resume_position_ms > 0
                ? `${formatDuration(remainingMs, true)} left`
                : null
            : null;
          return (
            <StyledText numberOfLines={1} style={styles.episodeMeta}>
              {new Date(episode.release_date).toLocaleDateString()} ·{" "}
              {formatDuration(episode.duration_ms, true)}
              {progressLabel ? ` · ${progressLabel}` : ""}
            </StyledText>
          );
        })()}
      </View>
    </HapticPressable>
  );

  return (
    <ContentContainer
      headerIcon={isShowFollowed ? "remove" : "add"}
      headerIconPress={handleToggleFollowShow}
      headerIconShowLength={isCheckingFollowed ? 0 : 1}
      headerTitle={displayName}
      style={{ paddingHorizontal: n(20) }}
    >
      <View style={{ paddingBottom: n(20) }}>
        <CustomScrollView
          contentContainerStyle={detailScreenStyles.listContentContainer}
          data={episodeItems}
          keyExtractor={(item, index) => item?.id || index.toString()}
          ListEmptyComponent={
            error ? (
              <StyledText style={detailScreenStyles.errorText}>
                {error}
              </StyledText>
            ) : !isInitialLoading && episodeItems.length === 0 ? (
              <StyledText style={detailScreenStyles.emptyText}>
                No episodes found for this podcast.
              </StyledText>
            ) : null
          }
          ListFooterComponent={<ListFooter isLoading={isLoadingMoreEpisodes} />}
          ListHeaderComponent={
            hideDetailCovers ? null : (
              <View style={detailScreenStyles.imageContainer}>
                <FallbackImage
                  placeholderIcon="mic"
                  placeholderText={displayName.charAt(0)}
                  style={detailScreenStyles.image}
                  uri={displayImageUrl}
                />
              </View>
            )
          }
          onEndReached={loadMoreEpisodes}
          onEndReachedThreshold={2}
          overScrollMode="never"
          renderItem={renderEpisodeItem}
        />
      </View>
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  placeholderText: {
    fontSize: n(64),
  },
  episodeItemContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    width: "100%",
  },
  episodeName: {
    flex: 1,
    fontSize: n(26),
    paddingRight: n(10),
  },
  episodeMeta: {
    fontSize: n(16),
    lineHeight: n(18),
    paddingBottom: n(6),
  },
  episodeInfoContainer: {
    flex: 1,
    alignItems: "flex-start",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: n(6),
    marginBottom: n(4),
  },
});
