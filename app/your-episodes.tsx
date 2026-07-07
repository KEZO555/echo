import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { useAuth } from "@/features/auth";
import { useSavedEpisodesStore } from "@/features/library/stores";
import { usePlayback } from "@/features/playback";
import { useSettings } from "@/features/settings";
import {
  ContentContainer,
  CustomScrollView,
  HapticPressable,
  ListFooter,
  MediaListItem,
  RateLimitListMessage,
  StyledText,
} from "@/shared/components";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import { tabScreenStyles as styles } from "@/shared/styles/detailScreen";
import { getSecondaryContentColor } from "@/shared/styles/lightTokens";
import type { SpotifySavedEpisode } from "@/shared/types/spotify";
import type { WithRateLimitItem } from "@/shared/utils";
import {
  formatDuration,
  getLargestImage,
  getRateLimitMessage,
  getThumbnailImage,
  isRateLimitItem,
  n,
  prependRateLimitItem,
} from "@/shared/utils";

const ItemSeparator = () => <View style={{ height: n(8) }} />;
type EpisodeListItem = WithRateLimitItem<SpotifySavedEpisode>;

type EpisodeFilter = "all" | "unplayed" | "inProgress";

const EPISODE_FILTERS: { id: EpisodeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unplayed", label: "Unplayed" },
  { id: "inProgress", label: "In progress" },
];

const filterEpisodes = (
  episodes: SpotifySavedEpisode[],
  filter: EpisodeFilter
): SpotifySavedEpisode[] => {
  if (filter === "all") {
    return episodes;
  }
  return episodes.filter((saved) => {
    const resume = saved.episode.resume_point;
    const played = resume?.fully_played ?? false;
    const started = (resume?.resume_position_ms ?? 0) > 0;
    if (filter === "unplayed") {
      return !(played || started);
    }
    return !played && started;
  });
};

export default function YourEpisodesScreen() {
  const { accessToken, user, isLoading: isAuthLoading } = useAuth();
  const { playTrackWithContext } = usePlayback();
  const savedEpisodes = useSavedEpisodesStore((s) => s.savedEpisodes);
  const nextUrl = useSavedEpisodesStore((s) => s.nextUrl);
  const isRefreshing = useSavedEpisodesStore((s) => s.isRefreshing);
  const isLoadingMore = useSavedEpisodesStore((s) => s.isLoadingMore);
  const isRateLimited = useSavedEpisodesStore((s) => s.isRateLimited);
  const rateLimitRetryAt = useSavedEpisodesStore((s) => s.rateLimitRetryAt);
  const fetchEpisodes = useSavedEpisodesStore((s) => s.fetch);
  const fetchMoreEpisodes = useSavedEpisodesStore((s) => s.fetchMore);
  const router = useRouter();
  const { isOnline } = useNetworkState();
  const { invertColors } = useSettings();
  const [episodeFilter, setEpisodeFilter] = useState<EpisodeFilter>("all");
  const rateLimitMessage = useMemo(
    () => getRateLimitMessage("your episodes", rateLimitRetryAt),
    [rateLimitRetryAt]
  );
  const filteredEpisodes = useMemo(
    () => filterEpisodes(savedEpisodes ?? [], episodeFilter),
    [savedEpisodes, episodeFilter]
  );
  const displayEpisodes: EpisodeListItem[] = prependRateLimitItem(
    filteredEpisodes,
    isRateLimited,
    rateLimitMessage
  );
  const shouldAttachRefreshControl = savedEpisodes !== null || isRateLimited;

  // Fetches on the initial mount and again on every subsequent focus, so
  // resume points (and the "time left" they drive) are always current
  // without a second, redundant request racing the first one.
  useFocusEffect(
    useCallback(() => {
      if (accessToken && user && !isAuthLoading && isOnline && !isRefreshing) {
        fetchEpisodes({ showRefreshing: false });
      }
    }, [
      accessToken,
      user,
      isAuthLoading,
      isOnline,
      isRefreshing,
      fetchEpisodes,
    ])
  );

  const handleRefresh = useCallback(() => {
    if (isRefreshing) {
      return;
    }
    if (isOnline) {
      fetchEpisodes();
    }
  }, [fetchEpisodes, isRefreshing, isOnline]);

  const handleEpisodePress = usePreventDoubleTap(
    async (savedEpisode: SpotifySavedEpisode) => {
      const episode = savedEpisode.episode;
      const albumArtUrl =
        getLargestImage(episode.images) ??
        getLargestImage(episode.show?.images) ??
        "";
      const resumePoint = episode.resume_point;
      const resumeMs =
        resumePoint && !resumePoint.fully_played
          ? (resumePoint.resume_position_ms ?? 0)
          : 0;

      await playTrackWithContext(episode.uri);
      router.push({
        pathname: "/playing",
        params: {
          trackName: episode.name ?? "",
          artistName: episode.show?.name ?? "",
          albumArtUrl,
          durationMs: episode.duration_ms?.toString() ?? "0",
          mediaType: "episode",
          positionMs: resumeMs ? Math.floor(resumeMs).toString() : "0",
          episodeId: episode.id,
        },
      });
    }
  );

  const handleEpisodeInfo = (savedEpisode: SpotifySavedEpisode) => {
    const episode = savedEpisode.episode;
    router.push({
      pathname: "/episode/[id]",
      params: {
        id: episode.id,
        episodeString: JSON.stringify(episode),
        episodeName: episode.name,
        showName: episode.show?.name ?? "",
      },
    });
  };

  const formatReleaseDate = (dateString: string): string => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleDateString();
  };

  const renderEpisodeItem = ({ item }: { item: EpisodeListItem }) => {
    if (isRateLimitItem(item)) {
      return <RateLimitListMessage message={item.message} />;
    }

    const episode = item.episode;
    const resumePoint = episode.resume_point;
    const remainingMs =
      resumePoint && !resumePoint.fully_played
        ? Math.max(
            episode.duration_ms - (resumePoint.resume_position_ms ?? 0),
            0
          )
        : 0;

    const releaseDate = formatReleaseDate(episode.release_date);
    const metaParts = [
      ...(releaseDate ? [releaseDate] : []),
      formatDuration(episode.duration_ms, true),
    ];

    if (resumePoint?.fully_played) {
      metaParts.push("Played");
    } else if (resumePoint && resumePoint.resume_position_ms > 0) {
      metaParts.push(`${formatDuration(remainingMs, true)} left`);
    }

    const imageUri =
      getThumbnailImage(episode.images) ??
      getThumbnailImage(episode.show?.images);
    const isDisabled = !isOnline;

    return (
      <MediaListItem
        disabled={isDisabled}
        imageUri={imageUri}
        onLongPress={() => handleEpisodeInfo(item)}
        onPress={() => handleEpisodePress(item)}
        placeholderIcon="mic"
        primaryLines={2}
        primaryText={episode.name}
        secondaryText={metaParts.join(" · ")}
      />
    );
  };

  const renderFooter = () => {
    return <ListFooter isLoading={isLoadingMore} />;
  };

  const hasSavedEpisodes = (savedEpisodes?.length ?? 0) > 0;
  const emptyMessage =
    hasSavedEpisodes && episodeFilter !== "all"
      ? "No episodes match this filter."
      : "No saved episodes yet.";

  return (
    <ContentContainer
      headerTitle="Your Episodes"
      style={{ paddingHorizontal: n(20), paddingBottom: n(20), gap: 0 }}
    >
      <View style={filterStyles.row}>
        {EPISODE_FILTERS.map((option) => (
          <HapticPressable
            key={option.id}
            onPress={() => setEpisodeFilter(option.id)}
            style={filterStyles.button}
          >
            <StyledText
              style={[
                filterStyles.label,
                episodeFilter !== option.id && {
                  color: getSecondaryContentColor(invertColors),
                },
              ]}
            >
              {option.label}
            </StyledText>
          </HapticPressable>
        ))}
      </View>
      <CustomScrollView
        contentContainerStyle={{ ...styles.listContentContainer }}
        data={displayEpisodes}
        ItemSeparatorComponent={ItemSeparator}
        keyExtractor={(item) =>
          isRateLimitItem(item) ? item.id : item.episode.id
        }
        ListEmptyComponent={
          isRefreshing || isRateLimited ? null : (
            <StyledText style={styles.emptyText}>{emptyMessage}</StyledText>
          )
        }
        ListFooterComponent={renderFooter}
        onEndReached={() => {
          if (nextUrl && !isLoadingMore && isOnline) {
            fetchMoreEpisodes();
          }
        }}
        onEndReachedThreshold={2}
        overScrollMode="never"
        refreshControl={
          shouldAttachRefreshControl ? (
            <RefreshControl
              colors={["white"]}
              onRefresh={handleRefresh}
              progressBackgroundColor={"black"}
              refreshing={isRefreshing}
              size={"large" as unknown as number}
            />
          ) : undefined
        }
        renderItem={renderEpisodeItem}
        style={styles.list}
      />
    </ContentContainer>
  );
}

const filterStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: n(20),
    marginBottom: n(12),
  },
  button: {
    paddingVertical: n(4),
  },
  label: {
    fontSize: n(20),
  },
});
