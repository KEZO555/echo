import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { useAuth } from "@/features/auth";
import { useAlbumsStore, useSavedTracksStore } from "@/features/library/stores";
import { getSavedTrackIdentity } from "@/features/library/utils/savedTracks";
import { usePlayback } from "@/features/playback";
import { useSettings } from "@/features/settings";
import {
  ContextMenu,
  ListScreen,
  MediaListItem,
  RateLimitListMessage,
} from "@/shared/components";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import { tabScreenStyles as styles } from "@/shared/styles/detailScreen";
import type { SavedTrackObject } from "@/shared/types/spotify";
import type { WithRateLimitItem } from "@/shared/utils";
import {
  getArtistNames,
  getRateLimitMessage,
  getThumbnailImage,
  isRateLimitItem,
  log,
  logError,
  logWarn,
  prependRateLimitItem,
} from "@/shared/utils";

type LikedSongsListItem = WithRateLimitItem<SavedTrackObject>;

export default function LikedSongsScreen() {
  const { isLoading } = useAuth();
  const savedTracks = useSavedTracksStore((s) => s.savedTracks);
  const fetchSavedTracks = useSavedTracksStore((s) => s.fetch);
  const isRefreshing = useSavedTracksStore((s) => s.isRefreshing);
  const isFetching = useSavedTracksStore((s) => s.isFetching);
  const fetchMore = useSavedTracksStore((s) => s.fetchMore);
  const hasMoreCachedPages = useSavedTracksStore((s) => s.hasMoreCachedPages);
  const isLoadingMore = useSavedTracksStore((s) => s.isLoadingMore);
  const isRateLimited = useSavedTracksStore((s) => s.isRateLimited);
  const rateLimitRetryAt = useSavedTracksStore((s) => s.rateLimitRetryAt);
  const nextUrl = useSavedTracksStore((s) => s.nextUrl);
  const { playUriWithSkipToUri, playTracksWithWebApi, addToQueue } =
    usePlayback();
  const { triggerHaptic } = useSettings();
  const saveAlbum = useAlbumsStore((s) => s.saveAlbum);
  const router = useRouter();
  const { isLoading: isNetworkLoading, isOnline } = useNetworkState();
  const [menuTrack, setMenuTrack] = useState<SavedTrackObject | null>(null);

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
  const baseTracks = useMemo(
    () => (filteredTracks.length > 0 ? filteredTracks : (savedTracks ?? [])),
    [filteredTracks, savedTracks]
  );
  const rateLimitMessage = useMemo(
    () => getRateLimitMessage("liked songs", rateLimitRetryAt),
    [rateLimitRetryAt]
  );

  const handleTrackPress = usePreventDoubleTap(
    async (item: SavedTrackObject) => {
      const likedSongsUri = "spotify:collection:tracks";
      const track = item.track;
      const artistName = getArtistNames(track.artists ?? []);
      const albumArtUrl = track.album?.images?.[0]?.url ?? "";
      const playingParams = {
        trackName: track.name ?? "",
        artistName,
        albumArtUrl,
        durationMs: track.duration_ms?.toString() ?? "0",
        sourceContext: "liked",
      };

      const startIndex = baseTracks.findIndex(
        (saved) => saved.track?.uri === track.uri
      );
      const orderedUris = (startIndex >= 0 ? baseTracks.slice(startIndex) : [])
        .map((saved) => saved.track?.uri)
        .filter((uri): uri is string => Boolean(uri))
        .slice(0, 50);

      try {
        if (orderedUris.length > 0) {
          await playTracksWithWebApi(orderedUris);
        } else {
          await playUriWithSkipToUri(likedSongsUri, track.uri);
        }
      } catch (error) {
        logError("Error playing track via Web API, trying App Remote:", error);
        try {
          await playUriWithSkipToUri(likedSongsUri, track.uri);
        } catch (fallbackError) {
          logError("Error playing liked track:", fallbackError);
        }
      }

      router.push({ pathname: "/playing", params: playingParams });
    }
  );

  const handleAddTrackToQueue = useCallback(
    async (item: SavedTrackObject) => {
      if (!item.track?.uri) {
        return;
      }
      triggerHaptic();
      try {
        await addToQueue(item.track.uri);
      } catch (error) {
        logError("Error adding track to queue:", error);
      }
    },
    [addToQueue, triggerHaptic]
  );

  const handleAddToPlaylist = useCallback(
    (item: SavedTrackObject) => {
      if (!item.track?.uri) {
        return;
      }
      router.push({
        pathname: "/add-to-playlist",
        params: { trackUri: item.track.uri },
      });
    },
    [router]
  );

  const handleGoToAlbum = useCallback(
    (item: SavedTrackObject) => {
      const album = item.track?.album;
      if (!album?.id) {
        return;
      }
      router.push({
        pathname: "/album/[id]",
        params: {
          id: album.id,
          albumName: album.name,
          albumString: JSON.stringify({
            id: album.id,
            name: album.name,
            images: album.images,
            artists: album.artists,
            uri: album.uri,
          }),
        },
      });
    },
    [router]
  );

  const handleSaveAlbum = useCallback(
    (item: SavedTrackObject) => {
      const albumId = item.track?.album?.id;
      if (albumId) {
        saveAlbum(albumId);
      }
    },
    [saveAlbum]
  );

  const menuActions = useMemo(() => {
    if (!menuTrack) {
      return [];
    }
    const track = menuTrack;
    const run = (action: (item: SavedTrackObject) => void) => () => {
      setMenuTrack(null);
      action(track);
    };
    const actions = [
      { label: "Play", onPress: run(handleTrackPress) },
      { label: "Play later", onPress: run(handleAddTrackToQueue) },
      { label: "Add to playlist", onPress: run(handleAddToPlaylist) },
    ];
    if (track.track?.album?.id) {
      actions.push({ label: "Go to album", onPress: run(handleGoToAlbum) });
      actions.push({ label: "Save album", onPress: run(handleSaveAlbum) });
    }
    return actions;
  }, [
    menuTrack,
    handleTrackPress,
    handleAddTrackToQueue,
    handleAddToPlaylist,
    handleGoToAlbum,
    handleSaveAlbum,
  ]);

  const renderTrackItem = ({ item }: { item: LikedSongsListItem }) => {
    if (isRateLimitItem(item)) {
      return <RateLimitListMessage message={item.message} />;
    }

    if (!item.track) {
      logWarn("Track is null for item:", item);
      return null;
    }

    return (
      <MediaListItem
        imageUri={getThumbnailImage(item.track.album?.images)}
        onLongPress={() => setMenuTrack(item)}
        onPress={() => handleTrackPress(item)}
        placeholderIcon="music-note"
        primaryText={item.track.name}
        secondaryText={getArtistNames(item.track.artists)}
      />
    );
  };

  if (!savedTracks && (isLoading || isFetching || isNetworkLoading)) {
    return <View style={styles.centeredMessageContainer} />;
  }

  const handleLoadMore = () => {
    if (
      !isLoadingMore &&
      ((isOnline && nextUrl) || (!isOnline && hasMoreCachedPages))
    ) {
      fetchMore({ isOnline });
    }
  };

  const displayTracks: LikedSongsListItem[] = prependRateLimitItem(
    baseTracks,
    isRateLimited,
    rateLimitMessage
  );

  return (
    <ListScreen
      data={displayTracks}
      emptyMessage="No saved tracks found."
      isLoadingMore={isLoadingMore}
      isOnline={isOnline}
      isRefreshing={isRefreshing}
      keyExtractor={(item: LikedSongsListItem) =>
        isRateLimitItem(item) ? item.id : getSavedTrackIdentity(item)
      }
      onLoadMore={handleLoadMore}
      onRefresh={handleRefresh}
      refreshEnabled={isOnline === true}
      renderItem={renderTrackItem}
      showLoadMoreFooter={false}
      title="Liked Songs"
    >
      <ContextMenu
        actions={menuActions}
        onClose={() => setMenuTrack(null)}
        title={menuTrack?.track?.name}
        visible={menuTrack !== null}
      />
    </ListScreen>
  );
}
