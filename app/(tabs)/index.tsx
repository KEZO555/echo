import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { View } from "react-native";
import { useAuth } from "@/features/auth";
import { useSavedTracksStore } from "@/features/library/stores";
import { usePlayback } from "@/features/playback";
import { ListScreen, MediaListItem } from "@/shared/components";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import { tabScreenStyles as styles } from "@/shared/styles/detailScreen";
import type { SavedTrackObject } from "@/shared/types/spotify";
import { getArtistNames, log, logError, logWarn } from "@/shared/utils";

export default function LikedSongsScreen() {
  const { isLoading } = useAuth();
  const savedTracks = useSavedTracksStore((s) => s.savedTracks);
  const fetchSavedTracks = useSavedTracksStore((s) => s.fetch);
  const isRefreshing = useSavedTracksStore((s) => s.isRefreshing);
  const fetchMore = useSavedTracksStore((s) => s.fetchMore);
  const isLoadingMore = useSavedTracksStore((s) => s.isLoadingMore);
  const nextUrl = useSavedTracksStore((s) => s.nextUrl);
  const { playTrackWithContext, getPlaybackState, toggleShuffle } =
    usePlayback();
  const router = useRouter();
  const { isLoading: isNetworkLoading, isOnline } = useNetworkState();

  const handleRefresh = useCallback(() => {
    log("LikedSongs: Manual refresh triggered", {
      isRefreshing,
    });
    if (!isRefreshing) {
      fetchSavedTracks();
    }
  }, [fetchSavedTracks, isRefreshing]);

  const filteredTracks = useMemo(
    () => savedTracks?.filter((item) => item.track !== null) ?? [],
    [savedTracks]
  );

  const handleTrackPress = usePreventDoubleTap(
    async (item: SavedTrackObject, index: number, isDisabled: boolean) => {
      if (isDisabled) return;

      if (!savedTracks) return;

      const collectionUri = "spotify:collection:tracks";

      try {
        const track = item.track;
        const artistName = getArtistNames(track.artists ?? []);
        const albumArtUrl = track.album?.images?.[0]?.url ?? "";

        let wasShuffling = false;
        try {
          const playbackState = await getPlaybackState();
          wasShuffling = !!playbackState?.shuffle_state;
        } catch {
          logWarn(
            "Could not get playback state, proceeding without shuffle workaround"
          );
        }
        if (wasShuffling) {
          await toggleShuffle(false);
        }
        await playTrackWithContext(item.track.uri, {
          type: "liked",
          uri: collectionUri,
          tracks: savedTracks,
          currentIndex: index,
        });
        if (wasShuffling) {
          await toggleShuffle(true);
        }
        router.push({
          pathname: "/playing",
          params: {
            trackName: track.name ?? "",
            artistName,
            albumArtUrl,
            durationMs: track.duration_ms?.toString() ?? "0",
          },
        });
      } catch (error) {
        logError("Error playing track:", error);
        router.push("/playing");
      }
    }
  );

  const renderTrackItem = ({
    item,
    index,
  }: {
    item: SavedTrackObject;
    index: number;
  }) => {
    if (!item.track) {
      logWarn("Track is null for item:", item);
      return null;
    }

    const isDisabled = !isOnline;

    return (
      <MediaListItem
        disabled={isDisabled}
        imageUri={
          item.track.album?.images && item.track.album.images.length > 0
            ? item.track.album.images[0].url
            : undefined
        }
        onPress={() => handleTrackPress(item, index, isDisabled)}
        placeholderIcon="music-note"
        primaryText={item.track.name}
        secondaryText={getArtistNames(item.track.artists)}
      />
    );
  };

  const handlePlayingPress = usePreventDoubleTap(() => {
    router.push("/playing");
  });

  if (isNetworkLoading || (isLoading && !savedTracks)) {
    return <View style={styles.centeredMessageContainer} />;
  }

  if (isRefreshing && !savedTracks) {
    return <View style={styles.centeredMessageContainer} />;
  }

  const handleLoadMore = () => {
    if (isOnline && nextUrl && !isLoadingMore) {
      fetchMore();
    }
  };

  return (
    <ListScreen
      data={filteredTracks.length > 0 ? filteredTracks : savedTracks}
      emptyMessage="No saved tracks found."
      headerIconPress={handlePlayingPress}
      isLoadingMore={isLoadingMore}
      isOnline={isOnline}
      isRefreshing={isRefreshing}
      keyExtractor={(item: SavedTrackObject) =>
        `${item.added_at}-${item.track?.id || "unknown"}`
      }
      onLoadMore={handleLoadMore}
      onRefresh={handleRefresh}
      refreshEnabled={isOnline === true}
      renderItem={renderTrackItem}
      title="Liked Songs"
    />
  );
}
