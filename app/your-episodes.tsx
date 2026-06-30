import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, View } from "react-native";
import { useAuth } from "@/features/auth";
import { useSavedEpisodesStore } from "@/features/library/stores";
import { usePlayback } from "@/features/playback";
import {
  ContentContainer,
  ContextMenu,
  CustomScrollView,
  ListFooter,
  MediaListItem,
  RateLimitListMessage,
  StyledText,
} from "@/shared/components";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import { tabScreenStyles as styles } from "@/shared/styles/detailScreen";
import type { SpotifySavedEpisode } from "@/shared/types/spotify";
import type { WithRateLimitItem } from "@/shared/utils";
import {
  formatDuration,
  getLargestImage,
  getRateLimitMessage,
  isRateLimitItem,
  n,
  prependRateLimitItem,
} from "@/shared/utils";

const ItemSeparator = () => <View style={{ height: n(8) }} />;
type EpisodeListItem = WithRateLimitItem<SpotifySavedEpisode>;

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
  const removeEpisode = useSavedEpisodesStore((s) => s.removeEpisode);
  const router = useRouter();
  const { isOnline } = useNetworkState();
  const [menuEpisode, setMenuEpisode] = useState<SpotifySavedEpisode | null>(
    null
  );
  const rateLimitMessage = useMemo(
    () => getRateLimitMessage("your episodes", rateLimitRetryAt),
    [rateLimitRetryAt]
  );
  const displayEpisodes: EpisodeListItem[] = prependRateLimitItem(
    savedEpisodes ?? [],
    isRateLimited,
    rateLimitMessage
  );
  const shouldAttachRefreshControl = savedEpisodes !== null || isRateLimited;

  useEffect(() => {
    if (
      accessToken &&
      user &&
      !savedEpisodes &&
      !isAuthLoading &&
      !isRefreshing
    ) {
      fetchEpisodes({ showRefreshing: false });
    }
  }, [
    accessToken,
    user,
    savedEpisodes,
    isAuthLoading,
    isRefreshing,
    fetchEpisodes,
  ]);

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

  const handleMenuPlay = (savedEpisode: SpotifySavedEpisode) => {
    setMenuEpisode(null);
    handleEpisodePress(savedEpisode);
  };

  const handleMenuInfo = (savedEpisode: SpotifySavedEpisode) => {
    setMenuEpisode(null);
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

  const handleMenuRemove = async (savedEpisode: SpotifySavedEpisode) => {
    setMenuEpisode(null);
    await removeEpisode(savedEpisode.episode.id);
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
      getLargestImage(episode.images) ?? getLargestImage(episode.show?.images);
    const isDisabled = !isOnline;

    return (
      <MediaListItem
        disabled={isDisabled}
        imageUri={imageUri}
        onLongPress={() => setMenuEpisode(item)}
        onPress={() => handleEpisodePress(item)}
        placeholderIcon="mic"
        primaryText={episode.name}
        scrollPrimary
        secondaryText={metaParts.join(" · ")}
      />
    );
  };

  const renderFooter = () => {
    return <ListFooter isLoading={isLoadingMore} />;
  };

  return (
    <ContentContainer
      headerTitle="Your Episodes"
      style={{ paddingHorizontal: n(20), paddingBottom: n(20) }}
    >
      <CustomScrollView
        contentContainerStyle={{ ...styles.listContentContainer }}
        data={displayEpisodes}
        ItemSeparatorComponent={ItemSeparator}
        keyExtractor={(item) =>
          isRateLimitItem(item) ? item.id : item.episode.id
        }
        ListEmptyComponent={
          !(isRefreshing || isRateLimited) &&
          (!savedEpisodes || savedEpisodes.length === 0) ? (
            <StyledText style={styles.emptyText}>
              No saved episodes yet.
            </StyledText>
          ) : null
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
      <ContextMenu
        actions={
          menuEpisode
            ? [
                { label: "Play", onPress: () => handleMenuPlay(menuEpisode) },
                { label: "Info", onPress: () => handleMenuInfo(menuEpisode) },
                {
                  label: "Remove from my episodes",
                  onPress: () => handleMenuRemove(menuEpisode),
                },
              ]
            : []
        }
        onClose={() => setMenuEpisode(null)}
        title={menuEpisode?.episode.name}
        visible={menuEpisode !== null}
      />
    </ContentContainer>
  );
}
