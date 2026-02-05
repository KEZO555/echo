import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, View } from "react-native";
import { PLAYLIST_DETAIL_KEY_PREFIX } from "@/constants/spotify";
import { useAuth } from "@/features/auth";
import {
  refreshPlaylistsFromCache,
  useSpotifyLibrary,
} from "@/features/library";
import { useSettings } from "@/features/settings";
import {
  ContentContainer,
  CustomScrollView,
  MediaListItem,
} from "@/shared/components";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import { tabScreenStyles as styles } from "@/shared/styles/detailScreen";
import type { SpotifyPlaylist } from "@/shared/types/spotify";
import { n } from "@/shared/utils";
import { log, logError } from "@/shared/utils/logger";

const CREATE_NEW_PLAYLIST_ID = "CREATE_NEW_PLAYLIST_ID";

export default function PlaylistsScreen() {
  const { isLoading, accessToken, user } = useAuth();
  const {
    playlists,
    fetchPlaylists,
    isRefreshingPlaylists,
    fetchMorePlaylists,
    isLoadingMorePlaylists,
    playlistsNextUrl,
  } = useSpotifyLibrary();
  const router = useRouter();

  const { isOnline } = useNetworkState();
  const { hideCreatePlaylist } = useSettings();
  const [offlinePlaylists, setOfflinePlaylists] = useState<
    SpotifyPlaylist[] | null
  >(null);
  const [cachedPlaylistIds, setCachedPlaylistIds] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (
      accessToken &&
      user &&
      !playlists &&
      !isLoading &&
      !isRefreshingPlaylists
    ) {
      fetchPlaylists();
    }
  }, [
    accessToken,
    user,
    playlists,
    fetchPlaylists,
    isLoading,
    isRefreshingPlaylists,
  ]);

  const playlistSource = playlists ?? offlinePlaylists;
  const sortedPlaylists = useMemo(
    () =>
      playlistSource
        ? [...playlistSource].sort((a, b) => {
            const ownerCmp = (
              a.owner.display_name ??
              a.owner.id ??
              ""
            ).localeCompare(b.owner.display_name ?? b.owner.id ?? "");
            if (ownerCmp !== 0) return ownerCmp;
            return a.name.localeCompare(b.name);
          })
        : null,
    [playlistSource]
  );

  const checkCachedPlaylists = useCallback(async () => {
    if (!sortedPlaylists) return;
    const keys = sortedPlaylists.map(
      (p) => `${PLAYLIST_DETAIL_KEY_PREFIX}${p.id}`
    );
    const results = await AsyncStorage.multiGet(keys);
    const cachedIds = new Set<string>();
    results.forEach(([, value], index) => {
      if (value !== null) cachedIds.add(sortedPlaylists[index].id);
    });
    setCachedPlaylistIds(cachedIds);
  }, [sortedPlaylists]);

  useFocusEffect(
    useCallback(() => {
      checkCachedPlaylists();
    }, [checkCachedPlaylists])
  );

  const handleRefresh = useCallback(async () => {
    if (isRefreshingPlaylists) return;

    if (isOnline) {
      fetchPlaylists();
    } else {
      log("Playlists: Device is offline, loading cached playlists");
      try {
        const cachedPlaylists = await refreshPlaylistsFromCache();
        if (cachedPlaylists && cachedPlaylists.length > 0) {
          setOfflinePlaylists(cachedPlaylists);
          log(`Playlists: Loaded ${cachedPlaylists.length} cached playlists`);
        } else {
          log("Playlists: No cached playlists found");
        }
      } catch (error) {
        logError("Playlists: Error loading cached playlists:", error);
      }
    }
  }, [fetchPlaylists, isRefreshingPlaylists, isOnline]);

  const handleCreatePlaylistPress = usePreventDoubleTap(() => {
    router.push("/create-playlist");
  });

  const handlePlaylistPress = usePreventDoubleTap(
    (item: SpotifyPlaylist, isUncached: boolean) => {
      if (isUncached) return;

      router.push({
        pathname: `/playlist/${item.id}`,
        params: {
          playlistName: item.name as string,
          playlistString: JSON.stringify(item),
        },
      } as any);
    }
  );

  const renderPlaylistItem = ({ item }: { item: SpotifyPlaylist }) => {
    if (item.id === CREATE_NEW_PLAYLIST_ID) {
      if (hideCreatePlaylist) return null;
      const isDisabled = !isOnline;

      return (
        <MediaListItem
          disabled={isDisabled}
          onPress={() => {
            if (isDisabled) return;
            handleCreatePlaylistPress();
          }}
          placeholderIcon="add"
          primaryText={item.name}
        />
      );
    }

    const isOffline = !isOnline;
    const isUncached = isOffline && !cachedPlaylistIds.has(item.id);

    return (
      <MediaListItem
        disabled={isUncached}
        imageUri={
          item.images && item.images.length > 0 ? item.images[0].url : undefined
        }
        onPress={() => handlePlaylistPress(item, isUncached)}
        placeholderIcon="music-note"
        primaryText={item.name}
        secondaryText={item.owner.display_name || item.owner.id}
      />
    );
  };

  // Show global loading indicator if initial data is loading and no playlists are yet available
  if (isLoading && !sortedPlaylists) {
    return <View style={styles.centeredMessageContainer} />;
  }

  // Show specific refresh indicator if only manual refresh is happening
  // This is a bit redundant if the TabHeader also shows an indicator, but can be a fallback
  // or primary if header doesn't have space/icon for it.
  // For now, let's assume the header icon is the primary indicator and this is for safety.
  if (isRefreshingPlaylists && !sortedPlaylists) {
    // Or perhaps (isRefreshingPlaylists && playlists) if we want to show stale data UNDER the spinner
    return <View style={styles.centeredMessageContainer} />;
  }

  const createNewPlaylistItem: SpotifyPlaylist = {
    id: CREATE_NEW_PLAYLIST_ID,
    name: "Create new playlist",
    images: [], // No image for this item
    owner: { display_name: "", id: "" }, // No owner
    description: "", // Default value
    tracks: { href: "", total: 0 }, // Default value
    public: false, // Default value
    collaborative: false, // Default value
    uri: "", // Default value
    href: "", // Default value
  };

  const displayPlaylists = sortedPlaylists
    ? hideCreatePlaylist
      ? sortedPlaylists
      : [createNewPlaylistItem, ...sortedPlaylists]
    : hideCreatePlaylist
      ? []
      : [createNewPlaylistItem];

  const handlePlayingPress = usePreventDoubleTap(() => {
    router.push("/playing");
  });

  const handleLoadMore = () => {
    if (isOnline && playlistsNextUrl && !isLoadingMorePlaylists) {
      fetchMorePlaylists();
    }
  };

  const renderFooter = () => {
    if (!isLoadingMorePlaylists) return null;
    return <View style={{ paddingVertical: n(20) }} />;
  };

  if (!sortedPlaylists || sortedPlaylists.length === 0) {
    const emptyData = hideCreatePlaylist ? [] : [createNewPlaylistItem];
    return (
      <ContentContainer
        headerIcon="multitrack-audio"
        headerIconPress={handlePlayingPress}
        headerIconShowLength={1}
        headerTitle="Playlists"
        hideBackButton={true}
        style={{ paddingHorizontal: n(20) }}
      >
        <CustomScrollView
          contentContainerStyle={styles.listContentContainer}
          data={emptyData}
          ItemSeparatorComponent={() => <View style={{ height: n(8) }} />}
          keyExtractor={(item) => item.id}
          overScrollMode={"never"}
          refreshControl={
            <RefreshControl
              colors={["white"]}
              onRefresh={handleRefresh}
              progressBackgroundColor={"black"}
              refreshing={isRefreshingPlaylists}
              size={"large" as any}
            />
          }
          renderItem={renderPlaylistItem}
          style={styles.list}
        />
      </ContentContainer>
    );
  }

  return (
    <ContentContainer
      headerIcon="multitrack-audio"
      headerIconPress={handlePlayingPress}
      headerIconShowLength={1}
      headerTitle="Playlists"
      hideBackButton={true}
      style={{ paddingHorizontal: n(20) }}
    >
      <CustomScrollView
        contentContainerStyle={styles.listContentContainer}
        data={displayPlaylists}
        ItemSeparatorComponent={() => <View style={{ height: n(8) }} />}
        keyExtractor={(item) => item.id}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={2}
        overScrollMode={"never"}
        refreshControl={
          <RefreshControl
            colors={["white"]}
            onRefresh={handleRefresh}
            progressBackgroundColor={"black"}
            refreshing={isRefreshingPlaylists}
            size={"large" as any}
          />
        }
        renderItem={renderPlaylistItem}
        style={styles.list}
      />
    </ContentContainer>
  );
}
