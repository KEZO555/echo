import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { RefreshControl, View } from "react-native";
import { useAuth } from "@/features/auth";
import { useSpotifyLibrary } from "@/features/library";
import { usePlayback } from "@/features/playback";
import {
  ContentContainer,
  CustomScrollView,
  MediaListItem,
  StyledText,
} from "@/shared/components";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import { tabScreenStyles as styles } from "@/shared/styles/detailScreen";
import type { SavedTrackObject } from "@/shared/types/spotify";
import { getArtistNames, log, logError, logWarn, n } from "@/shared/utils";

export default function LikedSongsScreen() {
  const { isLoading, accessToken, user } = useAuth();
  const {
    savedTracks,
    fetchSavedTracks,
    isRefreshingSavedTracks,
    fetchMoreSavedTracks,
    isLoadingMoreSavedTracks,
    savedTracksNextUrl,
  } = useSpotifyLibrary();
  const { playTrackWithContext, getPlaybackState, toggleShuffle } =
    usePlayback();
  const router = useRouter();
  const { isLoading: isNetworkLoading, isOnline } = useNetworkState();

  useEffect(() => {
    log("LikedSongs: useEffect triggered", {
      hasAccessToken: !!accessToken,
      hasUser: !!user,
      hasSavedTracks: !!savedTracks,
      isLoading,
    });

    if (accessToken && user && !savedTracks && !isLoading) {
      log("LikedSongs: Fetching saved tracks...");
      fetchSavedTracks();
    }
  }, [accessToken, user, savedTracks, fetchSavedTracks, isLoading]);

  const handleRefresh = useCallback(() => {
    log("LikedSongs: Manual refresh triggered", {
      isRefreshingSavedTracks,
    });
    if (!isRefreshingSavedTracks) {
      fetchSavedTracks();
    }
  }, [fetchSavedTracks, isRefreshingSavedTracks]);

  const filteredTracks = useMemo(
    () => savedTracks?.filter((item) => item.track !== null) ?? [],
    [savedTracks]
  );

  const handleTrackPress = usePreventDoubleTap(
    async (item: SavedTrackObject, index: number, isDisabled: boolean) => {
      if (isDisabled) return;

      if (!user?.id) {
        logError("Cannot play track: User not loaded");
        return;
      }

      const collectionUri = "spotify:collection:tracks";

      try {
        const track = item.track;
        const artistName = getArtistNames(track.artists ?? []);
        const albumArtUrl = track.album?.images?.[0]?.url ?? "";

        let wasShuffling = false;
        try {
          const playbackState = await getPlaybackState();
          wasShuffling = !!playbackState?.shuffle_state;
        } catch (e) {
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
          tracks: savedTracks || [],
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
      index;
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

  if (isRefreshingSavedTracks && !savedTracks) {
    return <View style={styles.centeredMessageContainer} />;
  }

  const handleLoadMore = () => {
    if (isOnline && savedTracksNextUrl && !isLoadingMoreSavedTracks) {
      fetchMoreSavedTracks();
    }
  };

  const renderFooter = () => {
    if (!isLoadingMoreSavedTracks) return null;
    return;
  };

  if (!savedTracks || savedTracks.length === 0) {
    return (
      <ContentContainer
        headerIcon="multitrack-audio"
        headerIconPress={handlePlayingPress}
        headerIconShowLength={1}
        headerTitle="Liked Songs"
        hideBackButton={true}
        style={{ paddingHorizontal: n(20) }}
      >
        <CustomScrollView
          data={[]}
          ListHeaderComponent={
            <StyledText style={styles.emptyText}>
              No saved tracks found.
            </StyledText>
          }
          overScrollMode={"never"}
          refreshControl={
            <RefreshControl
              colors={["white"]}
              enabled={isOnline === true}
              onRefresh={handleRefresh}
              progressBackgroundColor={"black"}
              refreshing={isRefreshingSavedTracks}
              size={"large" as any}
            />
          }
          renderItem={null}
        />
      </ContentContainer>
    );
  }

  return (
    <ContentContainer
      headerIcon="multitrack-audio"
      headerIconPress={handlePlayingPress}
      headerIconShowLength={1}
      headerTitle="Liked Songs"
      hideBackButton={true}
      style={{ paddingHorizontal: n(20) }}
    >
      <CustomScrollView
        contentContainerStyle={styles.listContentContainer}
        data={filteredTracks}
        ItemSeparatorComponent={() => <View style={{ height: n(8) }} />}
        keyExtractor={(item: SavedTrackObject) =>
          `${item.added_at}-${item.track?.id || "unknown"}`
        }
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={2}
        overScrollMode={"never"}
        refreshControl={
          <RefreshControl
            colors={["white"]}
            enabled={isOnline === true}
            onRefresh={handleRefresh}
            progressBackgroundColor={"black"}
            refreshing={isRefreshingSavedTracks}
            size={"large" as any}
          />
        }
        renderItem={renderTrackItem}
        style={styles.list}
      />
    </ContentContainer>
  );
}
