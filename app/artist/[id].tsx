import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { useAuth } from "@/features/auth";
import {
  checkIfFollowingArtist,
  followArtist,
  unfollowArtist,
} from "@/features/library";
import { usePlayback } from "@/features/playback";
import { useSettings } from "@/features/settings";
import {
  ContextMenu,
  DetailScreen,
  MediaListItem,
  StyledText,
  TrackListItem,
} from "@/shared/components";
import {
  useNetworkState,
  usePreventDoubleTap,
  useSaveStatus,
} from "@/shared/hooks";
import type {
  SpotifyAlbum,
  SpotifyImage,
  SpotifyTrackSimple,
} from "@/shared/types/spotify";
import { getArtistNames, getLargestImage, logError, n } from "@/shared/utils";
import { apiGet } from "@/shared/utils/api-client";

interface SpotifyArtistFull {
  id: string;
  name: string;
  images: SpotifyImage[];
}

type ArtistRow =
  | { kind: "header"; id: string; title: string }
  | { kind: "track"; id: string; track: SpotifyTrackSimple; index: number }
  | { kind: "album"; id: string; album: SpotifyAlbum };

const dedupeAlbums = (albums: SpotifyAlbum[]): SpotifyAlbum[] => {
  const seen = new Set<string>();
  const result: SpotifyAlbum[] = [];
  for (const album of albums) {
    const key = album.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(album);
    }
  }
  return result.sort((a, b) =>
    (b.release_date ?? "").localeCompare(a.release_date ?? "")
  );
};

export default function ArtistDetailScreen() {
  const { id, artistName } = useLocalSearchParams<{
    id: string;
    artistName?: string;
  }>();

  const { user, accessToken } = useAuth();
  const { playTracksWithWebApi, addToQueue } = usePlayback();
  const { triggerHaptic } = useSettings();
  const router = useRouter();
  const { isOnline } = useNetworkState();

  const [artist, setArtist] = useState<SpotifyArtistFull | null>(null);
  const [topTracks, setTopTracks] = useState<SpotifyTrackSimple[]>([]);
  const [albums, setAlbums] = useState<SpotifyAlbum[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [menuTrack, setMenuTrack] = useState<{
    track: SpotifyTrackSimple;
    index: number;
  } | null>(null);

  const market = user?.country ?? "US";

  const {
    isSaved: isFollowing,
    isChecking: isCheckingFollow,
    toggle: toggleFollow,
  } = useSaveStatus({
    id,
    checkFn: checkIfFollowingArtist,
    saveFn: followArtist,
    removeFn: unfollowArtist,
    accessToken,
  });

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
        const [artistData, topTracksData, albumsData] = await Promise.all([
          apiGet<SpotifyArtistFull>(`https://api.spotify.com/v1/artists/${id}`),
          apiGet<{ tracks: SpotifyTrackSimple[] }>(
            `https://api.spotify.com/v1/artists/${id}/top-tracks?market=${market}`
          ),
          apiGet<{ items: SpotifyAlbum[] }>(
            `https://api.spotify.com/v1/artists/${id}/albums?include_groups=album,single&limit=50`
          ),
        ]);
        if (cancelled) {
          return;
        }
        if (artistData) {
          setArtist(artistData);
        }
        setTopTracks(topTracksData?.tracks ?? []);
        setAlbums(dedupeAlbums(albumsData?.items ?? []));
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
  }, [id, isOnline, market]);

  const displayName = artist?.name ?? artistName ?? "Artist";
  const imageUrl = getLargestImage(artist?.images);

  const rows = useMemo<ArtistRow[]>(() => {
    const result: ArtistRow[] = [];
    if (topTracks.length > 0) {
      result.push({ kind: "header", id: "h-top", title: "Top tracks" });
      topTracks.forEach((track, index) => {
        result.push({ kind: "track", id: `t-${track.id}`, track, index });
      });
    }
    if (albums.length > 0) {
      result.push({ kind: "header", id: "h-disc", title: "Discography" });
      for (const album of albums) {
        result.push({ kind: "album", id: `a-${album.id}`, album });
      }
    }
    return result;
  }, [topTracks, albums]);

  const handleTrackPress = usePreventDoubleTap(async (index: number) => {
    const track = topTracks[index];
    if (!track) {
      return;
    }
    const orderedUris = topTracks
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

  const handleAlbumPress = usePreventDoubleTap((album: SpotifyAlbum) => {
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
          handleAlbumPress(track.album as SpotifyAlbum);
        },
      });
    }
    return actions;
  }, [
    menuTrack,
    handleTrackPress,
    handleAddToQueue,
    handleAddToPlaylist,
    handleAlbumPress,
  ]);

  const renderRow = ({ item }: { item: ArtistRow }) => {
    if (item.kind === "header") {
      return <StyledText style={styles.sectionHeader}>{item.title}</StyledText>;
    }
    if (item.kind === "track") {
      return (
        <TrackListItem
          artists={item.track.artists}
          durationMs={item.track.duration_ms}
          imageUri={item.track.album?.images?.[0]?.url}
          name={item.track.name}
          onLongPress={() =>
            setMenuTrack({ track: item.track, index: item.index })
          }
          onPress={() => handleTrackPress(item.index)}
          showImage
          trackNumber={item.index + 1}
        />
      );
    }
    return (
      <MediaListItem
        forceShowImage
        imageUri={item.album.images?.[0]?.url}
        onPress={() => handleAlbumPress(item.album)}
        placeholderIcon="album"
        primaryText={item.album.name}
        secondaryText={[
          item.album.album_type === "single" ? "Single" : "Album",
          item.album.release_date?.slice(0, 4),
        ]
          .filter(Boolean)
          .join(" · ")}
      />
    );
  };

  return (
    <DetailScreen
      data={rows}
      emptyMessage="Nothing to show for this artist."
      error={error}
      headerIcon={isFollowing ? "remove" : "add"}
      headerIconPress={toggleFollow}
      headerIconShowLength={isCheckingFollow ? 0 : 1}
      imageUrl={imageUrl}
      isInitialLoading={isInitialLoading}
      keyExtractor={(item) => item.id}
      placeholderIcon="person"
      renderItem={renderRow}
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

const styles = StyleSheet.create({
  sectionHeader: {
    fontSize: n(18),
    opacity: 0.6,
    paddingTop: n(12),
    paddingBottom: n(4),
  },
});
