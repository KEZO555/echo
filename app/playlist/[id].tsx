import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  getCachedPlaylistDetail,
  saveCachedPlaylistDetail,
} from "@/features/library";
import { usePlayback } from "@/features/playback";
import { DetailScreen, TrackListItem } from "@/shared/components";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import type {
  SpotifyPlaylist,
  SpotifyTrackSimple,
} from "@/shared/types/spotify";
import { log, logError } from "@/shared/utils";
import { apiGet } from "@/shared/utils/api-client";

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
  const router = useRouter();
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

  const fetchPlaylistDetails = useCallback(async () => {
    if (!id) {
      setError("Playlist ID is missing.");
      return;
    }

    const hasInitialData = !!(initialPlaylist as SpotifyPlaylistFull)?.tracks
      ?.items;

    if (!hasInitialData) {
      try {
        const cachedPlaylist = await getCachedPlaylistDetail(id);
        if (cachedPlaylist?.tracks?.items) {
          log("Playlist details: Displaying cached data");
          setPlaylist(cachedPlaylist);
        }
      } catch (cacheError) {
        logError("Error retrieving cached playlist:", cacheError);
      }
    }

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
      const data = await apiGet<SpotifyPlaylistFull>(
        `https://api.spotify.com/v1/playlists/${id}`
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
  }, [id, initialPlaylist, isOnline]);

  useFocusEffect(
    useCallback(() => {
      fetchPlaylistDetails();
    }, [fetchPlaylistDetails])
  );

  const loadMoreTracks = useCallback(async () => {
    if (!playlist?.tracks?.next || isLoadingMoreTracks) return;
    setIsLoadingMoreTracks(true);
    try {
      const data = await apiGet<{
        items: PlaylistTrack[];
        next: string | null;
      }>(playlist.tracks.next);
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
    } catch (e: unknown) {
      logError("Error fetching more playlist tracks:", e);
    } finally {
      setIsLoadingMoreTracks(false);
    }
  }, [playlist, isLoadingMoreTracks]);

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
    } catch (playError) {
      logError("Error playing track:", playError);
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
    <DetailScreen
      data={playlist?.tracks?.items || []}
      emptyMessage="No tracks found in this playlist."
      error={error}
      imageUrl={displayImageUrl}
      isLoadingMore={isLoadingMoreTracks}
      keyExtractor={(item, index) =>
        `${item.track?.id || "unknown-track"}-${index}`
      }
      onLoadMore={loadMoreTracks}
      onTitlePress={handleTitlePress}
      placeholderIcon="music-note"
      renderItem={renderTrackItem}
      title={displayName}
    />
  );
}
