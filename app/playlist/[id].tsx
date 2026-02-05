import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import {
  getCachedPlaylistDetail,
  saveCachedPlaylistDetail,
  useSpotifyLibrary,
} from "@/features/library";
import { usePlayback } from "@/features/playback";
import { useSettings } from "@/features/settings";
import {
  ContentContainer,
  CustomScrollView,
  FallbackImage,
  ListFooter,
  StyledText,
  TrackListItem,
} from "@/shared/components";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import { detailScreenStyles } from "@/shared/styles/detailScreen";
import type {
  SpotifyPlaylist,
  SpotifyTrackSimple,
} from "@/shared/types/spotify";
import { log, logError, n } from "@/shared/utils";

interface PlaylistTrack {
  added_at: string;
  added_by: {
    external_urls: { spotify: string };
    href: string;
    id: string;
    type: string;
    uri: string;
  } | null;
  is_local: boolean;
  track: SpotifyTrackSimple | null;
}

interface SpotifyPlaylistFull extends SpotifyPlaylist {
  id: string;
  name: string;
  images: { url: string }[];
  tracks: {
    href: string;
    items: PlaylistTrack[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
  };
}

export default function PlaylistDetailScreen() {
  const { id, playlistString, playlistName } = useLocalSearchParams<{
    id: string;
    playlistString?: string;
    playlistName?: string;
  }>();
  const { skipToIndex } = usePlayback();
  const { makeApiRequest } = useSpotifyLibrary();
  const router = useRouter();
  const { hideDetailCovers } = useSettings();
  const { isOnline } = useNetworkState();

  const initialPlaylist = useMemo(() => {
    if (!playlistString) return null;
    try {
      return JSON.parse(playlistString) as SpotifyPlaylistFull;
    } catch {
      return null;
    }
  }, [playlistString]);

  const [fetchedPlaylist, setPlaylist] = useState<SpotifyPlaylistFull | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMoreTracks, setIsLoadingMoreTracks] = useState(false);

  const playlist = fetchedPlaylist ?? initialPlaylist;
  const displayName = playlist?.name ?? playlistName ?? "Playlist";
  const displayImageUrl = playlist?.images?.[0]?.url;

  const handleTitlePress = useCallback(() => {
    if (id) {
      router.push({
        pathname: "/rename-playlist",
        params: {
          playlistId: id,
          currentName: displayName,
        },
      });
    }
  }, [id, displayName, router]);

  useEffect(() => {
    const hasInitialTrackItems = !!(initialPlaylist as SpotifyPlaylistFull)
      ?.tracks?.items;
    if (hasInitialTrackItems || !id) return;

    const loadCache = async () => {
      try {
        const cachedPlaylist = await getCachedPlaylistDetail(id);
        if (cachedPlaylist?.tracks?.items) {
          log("Playlist details: Displaying cached data");
          setPlaylist(cachedPlaylist);
        }
      } catch (error) {
        logError("Error retrieving cached playlist:", error);
      }
    };
    loadCache();
  }, [id, initialPlaylist]);

  const fetchPlaylistDetails = useCallback(async () => {
    if (!id) {
      setError("Playlist ID is missing.");
      return;
    }

    const hasInitialData = !!(initialPlaylist as SpotifyPlaylistFull)?.tracks
      ?.items;

    if (!isOnline) {
      setPlaylist((current) => {
        if (!(hasInitialData || current)) {
          setError(
            "No cached data available. Connect to the internet to load this playlist."
          );
        }
        return current;
      });
      return;
    }

    try {
      const data = await makeApiRequest(
        `https://api.spotify.com/v1/playlists/${id}`,
        "Playlist details"
      );
      if (data) {
        log("Playlist details: Fetched fresh data from API");
        setPlaylist(data);
        await saveCachedPlaylistDetail(data);
      } else if (!hasInitialData) {
        throw new Error("Failed to fetch playlist details");
      }
    } catch (e: unknown) {
      const errorMessage =
        e instanceof Error ? e.message : "An unexpected error occurred.";
      logError("Error fetching playlist details:", e);
      if (!hasInitialData) {
        setError(errorMessage);
      }
    }
  }, [id, makeApiRequest, initialPlaylist, isOnline]);

  useFocusEffect(
    useCallback(() => {
      fetchPlaylistDetails();
    }, [fetchPlaylistDetails])
  );

  const loadMoreTracks = useCallback(async () => {
    if (!playlist?.tracks?.next || isLoadingMoreTracks) {
      return;
    }
    setIsLoadingMoreTracks(true);
    try {
      const data = await makeApiRequest(
        playlist.tracks.next,
        "More playlist tracks"
      );
      if (data) {
        setPlaylist((prevPlaylist) => {
          if (!(prevPlaylist && prevPlaylist.tracks)) return prevPlaylist;
          return {
            ...prevPlaylist,
            tracks: {
              ...prevPlaylist.tracks,
              items: [...prevPlaylist.tracks.items, ...data.items],
              next: data.next,
            },
          };
        });
      }
    } catch (e: any) {
      logError("Error fetching more playlist tracks:", e);
    } finally {
      setIsLoadingMoreTracks(false);
    }
  }, [playlist, isLoadingMoreTracks, makeApiRequest]);

  const handleTrackPress = usePreventDoubleTap(async (trackIndex: number) => {
    const playlistTrack = playlist?.tracks?.items[trackIndex];
    const track = playlistTrack?.track;
    const artistName =
      track?.artists
        ?.map((a: SpotifyTrackSimple["artists"][0]) => a.name)
        .join(", ") ?? "";
    const albumArtUrl =
      track?.album?.images?.[0]?.url ?? playlist?.images?.[0]?.url ?? "";

    try {
      await skipToIndex({
        type: "playlist",
        uri: `spotify:playlist:${id}`,
        currentIndex: trackIndex,
      });
      router.push({
        pathname: "/playing",
        params: {
          trackName: track?.name ?? "",
          artistName,
          albumArtUrl,
          durationMs: track?.duration_ms?.toString() ?? "0",
        },
      });
    } catch (error) {
      logError("Error playing track:", error);
      router.push({
        pathname: "/playing",
        params: {
          trackName: track?.name ?? "",
          artistName,
          albumArtUrl,
          durationMs: track?.duration_ms?.toString() ?? "0",
        },
      });
    }
  });

  const renderTrackItem = ({
    item,
    index,
  }: {
    item: PlaylistTrack;
    index: number;
  }) => {
    const track = item.track;
    if (!track) return null;

    return (
      <TrackListItem
        artists={track.artists}
        durationMs={track.duration_ms}
        key={`${track.id || "unknown"}-${index}`}
        name={track.name}
        onPress={() => handleTrackPress(index)}
        trackNumber={(playlist?.tracks?.offset || 0) + index + 1}
      />
    );
  };

  return (
    <ContentContainer
      headerTitle={displayName}
      onTitlePress={handleTitlePress}
      style={{ paddingHorizontal: n(20) }}
    >
      <View style={{ paddingBottom: n(20) }}>
        <CustomScrollView
          contentContainerStyle={detailScreenStyles.listContentContainer}
          data={playlist?.tracks?.items || []}
          keyExtractor={(item, index) =>
            `${item.track?.id || "unknown-track"}-${index}`
          }
          ListEmptyComponent={
            error ? (
              <StyledText style={detailScreenStyles.errorText}>
                {error}
              </StyledText>
            ) : playlist?.tracks?.items?.length === 0 ? (
              <StyledText style={detailScreenStyles.emptyText}>
                No tracks found in this playlist.
              </StyledText>
            ) : null
          }
          ListFooterComponent={<ListFooter isLoading={isLoadingMoreTracks} />}
          ListHeaderComponent={
            hideDetailCovers ? null : (
              <View style={detailScreenStyles.imageContainer}>
                <FallbackImage
                  placeholderIcon="music-note"
                  style={detailScreenStyles.image}
                  uri={displayImageUrl}
                />
              </View>
            )
          }
          onEndReached={loadMoreTracks}
          onEndReachedThreshold={2}
          overScrollMode="never"
          renderItem={renderTrackItem}
        />
      </View>
    </ContentContainer>
  );
}
