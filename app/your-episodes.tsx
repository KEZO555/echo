import { useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import { RefreshControl, View } from "react-native";
import { useAuth } from "@/features/auth";
import { useSpotifyLibrary } from "@/features/library";
import { usePlayback } from "@/features/playback";
import {
  ContentContainer,
  CustomScrollView,
  ListFooter,
  MediaListItem,
  StyledText,
} from "@/shared/components";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import { tabScreenStyles as styles } from "@/shared/styles/detailScreen";
import type { SpotifySavedEpisode } from "@/shared/types/spotify";
import { formatDuration, getLargestImage, n } from "@/shared/utils";

const ItemSeparator = () => <View style={{ height: n(8) }} />;

export default function YourEpisodesScreen() {
  const { accessToken, user, isLoading: isAuthLoading } = useAuth();
  const { playTrackWithContext } = usePlayback();
  const {
    savedEpisodes,
    savedEpisodesNextUrl,
    isRefreshingSavedEpisodes,
    isLoadingMoreSavedEpisodes,
    fetchSavedEpisodes,
    fetchMoreSavedEpisodes,
    refreshSavedEpisodesFromCache,
  } = useSpotifyLibrary();
  const router = useRouter();
  const { isOnline } = useNetworkState();

  useEffect(() => {
    if (
      accessToken &&
      user &&
      !savedEpisodes &&
      !isAuthLoading &&
      !isRefreshingSavedEpisodes
    ) {
      fetchSavedEpisodes();
    }
  }, [
    accessToken,
    user,
    savedEpisodes,
    isAuthLoading,
    isRefreshingSavedEpisodes,
    fetchSavedEpisodes,
  ]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshingSavedEpisodes) return;

    if (isOnline) {
      fetchSavedEpisodes();
    } else {
      await refreshSavedEpisodesFromCache();
    }
  }, [
    fetchSavedEpisodes,
    isRefreshingSavedEpisodes,
    isOnline,
    refreshSavedEpisodesFromCache,
  ]);

  const handleEpisodePress = usePreventDoubleTap(
    async (savedEpisode: SpotifySavedEpisode) => {
      const episode = savedEpisode.episode;
      const albumArtUrl =
        getLargestImage(episode.images) ??
        getLargestImage(episode.show?.images) ??
        "";

      await playTrackWithContext(episode.uri);
      router.push({
        pathname: "/playing",
        params: {
          trackName: episode.name ?? "",
          artistName: episode.show?.name ?? "",
          albumArtUrl,
          durationMs: episode.duration_ms?.toString() ?? "0",
        },
      });
    }
  );

  const formatReleaseDate = (dateString: string): string => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString();
  };

  const renderEpisodeItem = ({ item }: { item: SpotifySavedEpisode }) => {
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
      getLargestImage(episode.images) ?? getLargestImage(episode.show?.images);
    const isDisabled = !isOnline;

    return (
      <MediaListItem
        disabled={isDisabled}
        imageUri={imageUri}
        onPress={() => handleEpisodePress(item)}
        placeholderIcon="mic"
        primaryText={episode.name}
        secondaryText={metaParts.join(" · ")}
      />
    );
  };

  const renderFooter = () => {
    return <ListFooter isLoading={isLoadingMoreSavedEpisodes} />;
  };

  return (
    <ContentContainer
      headerTitle="Your Episodes"
      style={{ paddingHorizontal: n(20), paddingBottom: n(20) }}
    >
      <CustomScrollView
        contentContainerStyle={{ ...styles.listContentContainer }}
        data={savedEpisodes ?? []}
        ItemSeparatorComponent={ItemSeparator}
        keyExtractor={(item) => item.episode.id}
        ListEmptyComponent={
          !isRefreshingSavedEpisodes &&
          (!savedEpisodes || savedEpisodes.length === 0) ? (
            <StyledText style={styles.emptyText}>
              No saved episodes yet.
            </StyledText>
          ) : null
        }
        ListFooterComponent={renderFooter}
        onEndReached={() => {
          if (savedEpisodesNextUrl && !isLoadingMoreSavedEpisodes && isOnline) {
            fetchMoreSavedEpisodes();
          }
        }}
        onEndReachedThreshold={2}
        overScrollMode="never"
        refreshControl={
          <RefreshControl
            colors={["white"]}
            onRefresh={handleRefresh}
            progressBackgroundColor={"black"}
            refreshing={isRefreshingSavedEpisodes}
            size={"large" as any}
          />
        }
        renderItem={renderEpisodeItem}
        style={styles.list}
      />
    </ContentContainer>
  );
}
