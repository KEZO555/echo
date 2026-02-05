import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, View } from "react-native";
import { ALBUM_DETAIL_KEY_PREFIX } from "@/constants/spotify";
import { useAuth } from "@/features/auth";
import {
  refreshSavedAlbumsFromCache,
  useSpotifyLibrary,
} from "@/features/library";
import {
  ContentContainer,
  CustomScrollView,
  MediaListItem,
  StyledText,
} from "@/shared/components";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import { tabScreenStyles as styles } from "@/shared/styles/detailScreen";
import type { SpotifySavedAlbum } from "@/shared/types/spotify";
import { getArtistNames, log, logError, n } from "@/shared/utils";

export default function AlbumsScreen() {
  const { isLoading, accessToken, user } = useAuth();
  const {
    albums,
    fetchAlbums,
    isRefreshingAlbums,
    fetchMoreAlbums,
    isLoadingMoreAlbums,
    albumsNextUrl,
  } = useSpotifyLibrary();
  const router = useRouter();

  const { isOnline, isLoading: networkLoading } = useNetworkState();
  const [offlineAlbums, setOfflineAlbums] = useState<
    SpotifySavedAlbum[] | null
  >(null);
  const [cachedAlbumIds, setCachedAlbumIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (accessToken && user && !albums && !isLoading && !isRefreshingAlbums) {
      fetchAlbums();
    }
  }, [accessToken, user, albums, isLoading, isRefreshingAlbums]);

  const albumSource = albums ?? offlineAlbums;
  const sortedAlbums = useMemo(
    () =>
      albumSource
        ? [...albumSource].sort((a, b) =>
            (a.album.artists[0]?.name ?? "").localeCompare(
              b.album.artists[0]?.name ?? ""
            )
          )
        : null,
    [albumSource]
  );

  const checkCachedAlbums = useCallback(async () => {
    if (!sortedAlbums) return;
    const keys = sortedAlbums.map(
      (a) => `${ALBUM_DETAIL_KEY_PREFIX}${a.album.id}`
    );
    const results = await AsyncStorage.multiGet(keys);
    const cachedIds = new Set<string>();
    results.forEach(([, value], index) => {
      if (value !== null) cachedIds.add(sortedAlbums[index].album.id);
    });
    setCachedAlbumIds(cachedIds);
  }, [sortedAlbums]);

  useFocusEffect(
    useCallback(() => {
      checkCachedAlbums();
    }, [checkCachedAlbums])
  );

  const handleRefresh = useCallback(async () => {
    if (isRefreshingAlbums) return;

    if (isOnline) {
      fetchAlbums();
    } else {
      log("Albums: Device is offline, loading cached albums");
      try {
        const cachedAlbums = await refreshSavedAlbumsFromCache();
        if (cachedAlbums && cachedAlbums.length > 0) {
          setOfflineAlbums(cachedAlbums);
          log(`Albums: Loaded ${cachedAlbums.length} cached albums`);
        } else {
          log("Albums: No cached albums found");
        }
      } catch (error) {
        logError("Albums: Error loading cached albums:", error);
      }
    }
  }, [fetchAlbums, isRefreshingAlbums, isOnline]);

  const handleAlbumPress = usePreventDoubleTap(
    (item: SpotifySavedAlbum, isUncached: boolean) => {
      if (isUncached) return;

      const minimalAlbum = {
        id: item.album.id,
        name: item.album.name,
        images: item.album.images,
        artists: item.album.artists,
        album_type: item.album.album_type,
        release_date: item.album.release_date,
        uri: item.album.uri,
      };

      router.push({
        pathname: `/album/${item.album.id}`,
        params: {
          albumName: item.album.name as string,
          albumString: JSON.stringify(minimalAlbum),
        },
      } as any);
    }
  );

  const renderAlbumItem = ({ item }: { item: SpotifySavedAlbum }) => {
    const isOffline = !isOnline;
    const isUncached = isOffline && !cachedAlbumIds.has(item.album.id);

    return (
      <MediaListItem
        disabled={isUncached}
        imageUri={
          item.album.images && item.album.images.length > 0
            ? item.album.images[0].url
            : undefined
        }
        onPress={() => handleAlbumPress(item, isUncached)}
        placeholderIcon="album"
        primaryText={item.album.name}
        secondaryText={getArtistNames(item.album.artists)}
      />
    );
  };

  const handlePlayingPress = usePreventDoubleTap(() => {
    router.push("/playing");
  });

  // Show global loading indicator if initial data is loading and no albums are yet available
  if (isLoading && !sortedAlbums) {
    return <View style={styles.centeredMessageContainer} />;
  }

  // Show specific refresh indicator if only manual refresh is happening for albums
  if (isRefreshingAlbums && !sortedAlbums) {
    return <View style={styles.centeredMessageContainer} />;
  }

  const handleLoadMore = () => {
    if (albumsNextUrl && !isLoadingMoreAlbums) {
      fetchMoreAlbums();
    }
  };

  const renderFooter = () => {
    if (!isLoadingMoreAlbums) return null;
    return;
  };

  if (!sortedAlbums || sortedAlbums.length === 0) {
    return (
      <ContentContainer
        headerIcon="multitrack-audio"
        headerIconPress={handlePlayingPress}
        headerIconShowLength={1}
        headerTitle="Albums"
        hideBackButton={true}
        style={{ paddingHorizontal: n(20) }}
      >
        <CustomScrollView
          data={[]}
          ListHeaderComponent={
            <StyledText style={styles.emptyText}>
              No saved albums found.
            </StyledText>
          }
          overScrollMode={"never"}
          refreshControl={
            <RefreshControl
              colors={["white"]}
              onRefresh={handleRefresh}
              progressBackgroundColor={"black"}
              refreshing={isRefreshingAlbums}
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
      headerTitle="Albums"
      hideBackButton={true}
      style={{ paddingHorizontal: n(20) }}
    >
      <CustomScrollView
        contentContainerStyle={styles.listContentContainer}
        data={sortedAlbums}
        ItemSeparatorComponent={() => <View style={{ height: n(8) }} />} // Use album id as key
        keyExtractor={(item) => item.album.id}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={2}
        overScrollMode={"never"} // Added onEndReached
        refreshControl={
          <RefreshControl
            colors={["white"]}
            onRefresh={handleRefresh}
            progressBackgroundColor={"black"}
            refreshing={isRefreshingAlbums}
            size={"large" as any}
          />
        }
        renderItem={renderAlbumItem} // Added ListFooterComponent
        style={styles.list}
      />
    </ContentContainer>
  );
}
