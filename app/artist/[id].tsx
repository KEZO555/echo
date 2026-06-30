import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePlayback } from "@/features/playback";
import { useSettings } from "@/features/settings";
import { ContextMenu, DetailScreen, TrackListItem } from "@/shared/components";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import type { SpotifyImage, SpotifyTrackSimple } from "@/shared/types/spotify";
import { getArtistNames, getLargestImage, logError } from "@/shared/utils";
import { apiGet } from "@/shared/utils/api-client";

interface SpotifyArtistFull {
  id: string;
  name: string;
  images: SpotifyImage[];
}

export default function ArtistDetailScreen() {
  const { id, artistName } = useLocalSearchParams<{
    id: string;
    artistName?: string;
  }>();

  const { playTracksWithWebApi, addToQueue } = usePlayback();
  const { triggerHaptic } = useSettings();
  const router = useRouter();
  const { isOnline } = useNetworkState();

  const [artist, setArtist] = useState<SpotifyArtistFull | null>(null);
  const [topTracks, setTopTracks] = useState<SpotifyTrackSimple[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [menuTrack, setMenuTrack] = useState<{
    track: SpotifyTrackSimple;
    index: number;
  } | null>(null);

  useEffect(() => {
    if (!id) {
      setError("Artist ID is missing.");
      setIsInitialLoading(false);
      return;
    }
    if (!isOnline) {
      setError("Connect to the internet to load this artist.");
      setIsInitialLoading(false);
      return;
    }

    let cancelled = false;
    const fetchArtist = async () => {
      try {
        const [artistData, topTracksData] = await Promise.all([
          apiGet<SpotifyArtistFull>(`https://api.spotify.com/v1/artists/${id}`),
          apiGet<{ tracks: SpotifyTrackSimple[] }>(
            `https://api.spotify.com/v1/artists/${id}/top-tracks?market=from_token`
          ),
        ]);
        if (cancelled) {
          return;
        }
        if (artistData) {
          setArtist(artistData);
        }
        setTopTracks(topTracksData?.tracks ?? []);
      } catch (e: unknown) {
        if (!cancelled) {
          logError("Error fetching artist:", e);
          setError("Failed to load this artist.");
        }
      } finally {
        if (!cancelled) {
          setIsInitialLoading(false);
        }
      }
    };

    fetchArtist();
    return () => {
      cancelled = true;
    };
  }, [id, isOnline]);

  const displayName = artist?.name ?? artistName ?? "Artist";
  const imageUrl = getLargestImage(artist?.images);

  const handleTrackPress = usePreventDoubleTap(async (index: number) => {
    const tracks = topTracks ?? [];
    const track = tracks[index];
    if (!track) {
      return;
    }
    const orderedUris = tracks
      .slice(index)
      .map((item) => item.uri)
      .filter((uri): uri is string => Boolean(uri))
      .slice(0, 50);

    try {
      await playTracksWithWebApi(orderedUris);
    } catch (playError) {
      logError("Error playing artist track:", playError);
    }
    router.push({
      pathname: "/playing",
      params: {
        trackName: track.name ?? "",
        artistName: getArtistNames(track.artists),
        albumArtUrl: track.album?.images?.[0]?.url ?? "",
        durationMs: track.duration_ms?.toString() ?? "0",
      },
    });
  });

  const handleAddToQueue = useCallback(
    async (track: SpotifyTrackSimple) => {
      if (!track.uri) {
        return;
      }
      triggerHaptic();
      try {
        await addToQueue(track.uri);
      } catch (queueError) {
        logError("Error adding track to queue:", queueError);
      }
    },
    [addToQueue, triggerHaptic]
  );

  const handleGoToAlbum = useCallback(
    (track: SpotifyTrackSimple) => {
      const album = track.album;
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

  const handleAddToPlaylist = useCallback(
    (track: SpotifyTrackSimple) => {
      if (!track.uri) {
        return;
      }
      router.push({
        pathname: "/add-to-playlist",
        params: { trackUri: track.uri },
      });
    },
    [router]
  );

  const menuActions = useMemo(() => {
    if (!menuTrack) {
      return [];
    }
    const { track, index } = menuTrack;
    const close = () => setMenuTrack(null);
    const actions = [
      {
        label: "Play",
        onPress: () => {
          close();
          handleTrackPress(index);
        },
      },
      {
        label: "Add to queue",
        onPress: () => {
          close();
          handleAddToQueue(track);
        },
      },
      {
        label: "Add to playlist",
        onPress: () => {
          close();
          handleAddToPlaylist(track);
        },
      },
    ];
    if (track.album?.id) {
      actions.push({
        label: "Go to album",
        onPress: () => {
          close();
          handleGoToAlbum(track);
        },
      });
    }
    return actions;
  }, [
    menuTrack,
    handleTrackPress,
    handleAddToQueue,
    handleAddToPlaylist,
    handleGoToAlbum,
  ]);

  const renderTrackItem = ({
    item: track,
    index,
  }: {
    item: SpotifyTrackSimple;
    index: number;
  }) => (
    <TrackListItem
      artists={track.artists}
      durationMs={track.duration_ms}
      imageUri={track.album?.images?.[0]?.url}
      name={track.name}
      onLongPress={() => setMenuTrack({ track, index })}
      onPress={() => handleTrackPress(index)}
      showImage
      trackNumber={index + 1}
    />
  );

  return (
    <DetailScreen
      data={topTracks ?? []}
      emptyMessage="No popular tracks found for this artist."
      error={error}
      imageUrl={imageUrl}
      isInitialLoading={isInitialLoading}
      keyExtractor={(item, index) => item.id || index.toString()}
      placeholderIcon="person"
      renderItem={renderTrackItem}
      title={displayName}
    >
      <ContextMenu
        actions={menuActions}
        onClose={() => setMenuTrack(null)}
        title={menuTrack?.track.name}
        visible={menuTrack !== null}
      />
    </DetailScreen>
  );
}
