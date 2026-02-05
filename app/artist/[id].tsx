import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useAuth } from "@/features/auth";
import { useSpotifyLibrary } from "@/features/library";
import { usePlayback } from "@/features/playback";
import { useSettings } from "@/features/settings";
import {
  ContentContainer,
  CustomScrollView,
  FallbackImage,
  HapticPressable,
  ListFooter,
  StyledText,
  TrackListItem,
} from "@/shared/components";
import {
  useNetworkState,
  usePreventDoubleTap,
  useSaveStatus,
} from "@/shared/hooks";
import { detailScreenStyles } from "@/shared/styles/detailScreen";
import type {
  SpotifyAlbumSimple,
  SpotifyArtist,
  SpotifyTrack,
} from "@/shared/types/spotify";
import { log, logError, n } from "@/shared/utils";

const AlbumItemSeparator = ({
  leadingItem,
}: {
  leadingItem: { type: string };
}) => {
  if (leadingItem.type === "album") {
    return <View style={{ height: n(8) }} />;
  }
  return null;
};

export default function ArtistDetailScreen() {
  const { id, artistString, artistName } = useLocalSearchParams<{
    id: string;
    artistString?: string;
    artistName?: string;
  }>();

  const { accessToken } = useAuth();
  const { playTracksWithWebApi } = usePlayback();
  const {
    followArtist,
    unfollowArtist,
    fetchArtistTopTracks,
    fetchArtistAlbums,
    fetchMoreArtistAlbums,
    checkIfFollowingArtist,
    makeApiRequest,
  } = useSpotifyLibrary();

  const router = useRouter();
  const { hideDetailCovers, hideAlbumCovers } = useSettings();
  const { isOnline } = useNetworkState();

  const initialArtist = useMemo(() => {
    if (!artistString) return null;
    try {
      return JSON.parse(artistString) as SpotifyArtist;
    } catch {
      return null;
    }
  }, [artistString]);

  const [fetchedArtist, setArtist] = useState<SpotifyArtist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [albums, setAlbums] = useState<SpotifyAlbumSimple[] | null>(null);
  const [albumsNextUrl, setAlbumsNextUrl] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const artist = fetchedArtist ?? initialArtist;
  const displayName = artist?.name ?? artistName ?? "Artist";
  const displayImageUrl = artist?.images?.[0]?.url;

  const {
    isSaved: isFollowingArtist,
    isChecking: isCheckingFollowingArtist,
    toggle: handleToggleFollowArtist,
  } = useSaveStatus({
    id,
    checkFn: checkIfFollowingArtist,
    saveFn: followArtist,
    removeFn: unfollowArtist,
    accessToken,
  });

  const handleLoadMore = async () => {
    if (!albumsNextUrl || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const { albums: newAlbums, nextUrl } = await fetchMoreArtistAlbums(
        albumsNextUrl,
        isLoadingMore
      );
      if (newAlbums) {
        setAlbums((prevAlbums) => [...(prevAlbums || []), ...newAlbums]);
        setAlbumsNextUrl(nextUrl);
      }
    } catch (error) {
      logError("Error fetching more artist albums:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!id) {
      setError("Artist ID is missing.");
      return;
    }

    const fetchArtistDetails = async () => {
      if (initialArtist) {
        log("Artist details: Using pre-loaded artist data");
      }

      if (!isOnline) {
        if (!initialArtist) {
          setError(
            "No cached data available. Connect to the internet to load this artist."
          );
        }
        return;
      }

      try {
        const data = await makeApiRequest(
          `https://api.spotify.com/v1/artists/${id}`,
          "Artist details"
        );
        if (data) {
          log("Artist details: Fetched fresh data from API");
          setArtist(data);
        } else if (!initialArtist) {
          throw new Error("Failed to fetch artist details");
        }
      } catch (e: any) {
        logError("Error fetching artist details:", e);
        if (!initialArtist) {
          setError(e.message || "An unexpected error occurred.");
        }
      }
    };

    const fetchTopTracks = async () => {
      if (!isOnline) return;
      try {
        const data = await fetchArtistTopTracks(id);
        setTopTracks(data);
      } catch (e: any) {
        logError("Error fetching artist top tracks:", e);
      }
    };

    const fetchAlbums = async () => {
      if (!isOnline) return;
      try {
        const data = await fetchArtistAlbums(id);
        setAlbums(data.albums);
        setAlbumsNextUrl(data.nextUrl);
      } catch (e: any) {
        logError("Error fetching artist albums:", e);
      }
    };

    fetchArtistDetails();
    fetchTopTracks();
    fetchAlbums();
  }, [id, makeApiRequest]);

  const artistAlbums = (albums || []).filter(
    (album) => album.album_type === "album"
  );
  const artistSingles = (albums || []).filter(
    (album) => album.album_type === "single"
  );

  const artistDetailList = [
    { type: "header", title: "Top Songs" },
    ...topTracks.slice(0, 10).map((track, idx) => ({
      type: "track",
      data: track,
      index: idx,
    })),
    ...(artistAlbums.length > 0
      ? [
          { type: "header", title: "Albums" },
          ...artistAlbums.map((album, idx) => ({
            type: "album",
            data: album,
            index: idx,
          })),
        ]
      : []),
    ...(artistSingles.length > 0
      ? [
          { type: "header", title: "Singles" },
          ...artistSingles.map((album, idx) => ({
            type: "album",
            data: album,
            index: idx,
          })),
        ]
      : []),
  ];

  const renderSectionHeader = (title: string) => (
    <StyledText style={styles.sectionTitle}>{title}</StyledText>
  );

  const handleTrackPress = usePreventDoubleTap(async (trackIndex: number) => {
    const track = topTracks[trackIndex];
    const artistName =
      track?.artists
        ?.map((a: SpotifyTrack["artists"][0]) => a.name)
        .join(", ") ?? "";
    const albumArtUrl = track?.album?.images?.[0]?.url ?? "";

    try {
      const trackUris = topTracks.map((t) => t.uri);
      const urisToPlay = trackUris.slice(trackIndex);
      await playTracksWithWebApi(urisToPlay);
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
  }: {
    item: { data: SpotifyTrack; index: number };
  }) => {
    const track = item.data;
    const index = item.index;
    return (
      <TrackListItem
        artists={track.artists}
        durationMs={track.duration_ms}
        name={track.name}
        onPress={() => handleTrackPress(index)}
        trackNumber={index + 1}
      />
    );
  };

  const handleAlbumPress = usePreventDoubleTap((albumId: string) => {
    router.push(`/album/${albumId}`);
  });

  const renderAlbumItem = ({ item }: { item: any }) => {
    const album = item.data;
    const hasImage = album.images && album.images.length > 0;
    return (
      <HapticPressable
        onPress={() => handleAlbumPress(album.id)}
        style={styles.itemContainer}
      >
        {!hideAlbumCovers && (
          <FallbackImage
            containerStyle={styles.albumImageContainer}
            placeholderIcon="album"
            placeholderIconSize={24}
            style={styles.albumImage}
            uri={hasImage ? album.images[0].url : undefined}
          />
        )}
        <View style={styles.textContainer}>
          <StyledText numberOfLines={1} style={styles.albumName}>
            {album.name}
          </StyledText>
          <StyledText numberOfLines={1} style={styles.albumArtist}>
            {album.artists
              .map((a: SpotifyAlbumSimple["artists"][0]) => a.name)
              .join(", ")}
          </StyledText>
        </View>
      </HapticPressable>
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    if (item.type === "header") {
      return renderSectionHeader(item.title);
    }
    if (item.type === "track") {
      return renderTrackItem({ item });
    }
    if (item.type === "album") {
      return renderAlbumItem({ item });
    }
    return null;
  };

  const keyExtractor = (item: any, index: number) => {
    if (item.type === "header") return `header-${item.title}-${index}`;
    if (item.type === "track") return `track-${item.data.id}-${index}`;
    if (item.type === "album") return `album-${item.data.id}-${index}`;
    return `item-${index}`;
  };

  return (
    <ContentContainer
      headerIcon={isFollowingArtist ? "remove" : "add"}
      headerIconPress={handleToggleFollowArtist}
      headerIconShowLength={isCheckingFollowingArtist ? 0 : 1}
      headerTitle={displayName}
      style={{ paddingHorizontal: n(20) }}
    >
      <View style={{ paddingBottom: n(20) }}>
        <CustomScrollView
          contentContainerStyle={detailScreenStyles.listContentContainer}
          data={artistDetailList}
          ItemSeparatorComponent={AlbumItemSeparator}
          keyExtractor={keyExtractor}
          ListEmptyComponent={
            error ? (
              <StyledText style={detailScreenStyles.errorText}>
                {error}
              </StyledText>
            ) : artistDetailList.length <= 1 ? (
              <StyledText style={detailScreenStyles.emptyText}>
                No tracks or albums found for this artist.
              </StyledText>
            ) : null
          }
          ListFooterComponent={<ListFooter isLoading={isLoadingMore} />}
          ListHeaderComponent={
            !hideDetailCovers && displayImageUrl ? (
              <View style={detailScreenStyles.imageContainer}>
                <FallbackImage
                  placeholderIcon="person"
                  style={detailScreenStyles.image}
                  uri={displayImageUrl}
                />
              </View>
            ) : null
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={2}
          overScrollMode="never"
          renderItem={renderItem}
        />
      </View>
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  itemContainer: {
    minHeight: n(50),
    flexDirection: "row",
    alignItems: "center",
  },
  albumImageContainer: {
    width: n(50),
    height: n(50),
    marginRight: n(15),
    position: "relative",
  },
  albumImage: {
    width: n(50),
    height: n(50),
  },
  placeholderImageContainer: {
    width: n(50),
    height: n(50),
    marginRight: n(15),
    backgroundColor: "#282828",
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
  },
  albumName: {
    fontSize: n(22),
    lineHeight: n(24),
  },
  albumArtist: {
    fontSize: n(16),
    lineHeight: n(18),
  },
  sectionTitle: {
    fontSize: n(20),
    marginTop: n(10),
    marginBottom: n(10),
    alignSelf: "flex-start",
  },
});
