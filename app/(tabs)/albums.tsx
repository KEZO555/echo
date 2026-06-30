import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { ALBUM_DETAIL_KEY_PREFIX } from "@/constants/spotify";
import { useAuth } from "@/features/auth";
import {
  followArtist,
  refreshSavedAlbumsFromCache,
  useAlbumsStore,
} from "@/features/library";
import { usePlayback } from "@/features/playback";
import { type LibrarySortOption, useSettings } from "@/features/settings";
import {
  ContextMenu,
  ListScreen,
  MediaListItem,
  RateLimitListMessage,
} from "@/shared/components";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import { tabScreenStyles as styles } from "@/shared/styles/detailScreen";
import type { SpotifySavedAlbum } from "@/shared/types/spotify";
import type { WithRateLimitItem } from "@/shared/utils";
import {
  getAddedAtTimestamp,
  getArtistNames,
  getRateLimitMessage,
  isRateLimitItem,
  log,
  logError,
  prependRateLimitItem,
} from "@/shared/utils";

type AlbumsListItem = WithRateLimitItem<SpotifySavedAlbum>;

const getAlbumCreatorName = (item: SpotifySavedAlbum) =>
  item.album.artists[0]?.name ?? "";

const compareAlbumsAlphabetically = (
  left: SpotifySavedAlbum,
  right: SpotifySavedAlbum
) => {
  const nameDifference = left.album.name.localeCompare(right.album.name);
  if (nameDifference !== 0) {
    return nameDifference;
  }
  return getAlbumCreatorName(left).localeCompare(getAlbumCreatorName(right));
};

const compareAlbumsByCreator = (
  left: SpotifySavedAlbum,
  right: SpotifySavedAlbum
) => {
  const creatorDifference = getAlbumCreatorName(left).localeCompare(
    getAlbumCreatorName(right)
  );
  if (creatorDifference !== 0) {
    return creatorDifference;
  }
  return left.album.name.localeCompare(right.album.name);
};

const compareAlbumsByRecentlyAdded = (
  left: SpotifySavedAlbum,
  right: SpotifySavedAlbum
) => {
  const timeDifference =
    getAddedAtTimestamp(right.added_at) - getAddedAtTimestamp(left.added_at);
  if (timeDifference !== 0) {
    return timeDifference;
  }
  return left.album.name.localeCompare(right.album.name);
};

const compareAlbums = (
  left: SpotifySavedAlbum,
  right: SpotifySavedAlbum,
  sortOrder: LibrarySortOption
) => {
  if (sortOrder === "recentlyAdded") {
    return compareAlbumsByRecentlyAdded(left, right);
  }
  if (sortOrder === "creator") {
    return compareAlbumsByCreator(left, right);
  }
  return compareAlbumsAlphabetically(left, right);
};

export default function AlbumsScreen() {
  const { isLoading } = useAuth();
  const albums = useAlbumsStore((s) => s.albums);
  const fetchAlbums = useAlbumsStore((s) => s.fetch);
  const isRefreshing = useAlbumsStore((s) => s.isRefreshing);
  const isFetching = useAlbumsStore((s) => s.isFetching);
  const fetchMore = useAlbumsStore((s) => s.fetchMore);
  const isLoadingMore = useAlbumsStore((s) => s.isLoadingMore);
  const isRateLimited = useAlbumsStore((s) => s.isRateLimited);
  const rateLimitRetryAt = useAlbumsStore((s) => s.rateLimitRetryAt);
  const nextUrl = useAlbumsStore((s) => s.nextUrl);
  const router = useRouter();
  const { playContext } = usePlayback();

  const { isOnline } = useNetworkState();
  const { albumSortOrder } = useSettings();
  const [offlineAlbums, setOfflineAlbums] = useState<
    SpotifySavedAlbum[] | null
  >(null);
  const [cachedAlbumIds, setCachedAlbumIds] = useState<Set<string>>(new Set());
  const [menuAlbum, setMenuAlbum] = useState<SpotifySavedAlbum | null>(null);

  const albumSource = albums ?? offlineAlbums;
  const sortedAlbums = useMemo(() => {
    if (!albumSource) {
      return null;
    }

    return [...albumSource].sort((a, b) => compareAlbums(a, b, albumSortOrder));
  }, [albumSortOrder, albumSource]);
  const albumRateLimitMessage = useMemo(
    () => getRateLimitMessage("albums", rateLimitRetryAt),
    [rateLimitRetryAt]
  );

  const checkCachedAlbums = useCallback(async () => {
    if (!sortedAlbums) {
      return;
    }
    const keys = sortedAlbums.map(
      (a) => `${ALBUM_DETAIL_KEY_PREFIX}${a.album.id}`
    );
    const results = await AsyncStorage.multiGet(keys);
    const cachedIds = new Set<string>();
    results.forEach(([, value], index) => {
      if (value !== null) {
        cachedIds.add(sortedAlbums[index].album.id);
      }
    });
    setCachedAlbumIds(cachedIds);
  }, [sortedAlbums]);

  useFocusEffect(
    useCallback(() => {
      checkCachedAlbums();
    }, [checkCachedAlbums])
  );

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) {
      return;
    }

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
  }, [fetchAlbums, isRefreshing, isOnline]);

  const handleAlbumPress = usePreventDoubleTap(
    (item: SpotifySavedAlbum, isUncached: boolean) => {
      if (isUncached) {
        return;
      }

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
      } as never);
    }
  );

  const handleSortPress = usePreventDoubleTap(() => {
    router.push("/albums-sort" as never);
  });

  const handlePlayAlbum = useCallback(
    (item: SpotifySavedAlbum) => {
      playContext(`spotify:album:${item.album.id}`).catch((error) =>
        logError("Error playing album:", error)
      );
      router.push({
        pathname: "/playing",
        params: {
          trackName: item.album.name,
          artistName: getArtistNames(item.album.artists),
          albumArtUrl: item.album.images?.[0]?.url ?? "",
        },
      });
    },
    [playContext, router]
  );

  const handleGoToArtist = useCallback(
    (item: SpotifySavedAlbum) => {
      const artist = item.album.artists?.[0];
      if (!artist?.id) {
        return;
      }
      router.push({
        pathname: "/artist/[id]",
        params: { id: artist.id, artistName: artist.name },
      });
    },
    [router]
  );

  const menuActions = useMemo(() => {
    if (!menuAlbum) {
      return [];
    }
    const album = menuAlbum;
    const close = () => setMenuAlbum(null);
    const actions = [
      {
        label: "Play",
        onPress: () => {
          close();
          handlePlayAlbum(album);
        },
      },
    ];
    if (album.album.artists?.[0]?.id) {
      actions.push({
        label: "Go to artist",
        onPress: () => {
          close();
          handleGoToArtist(album);
        },
      });
      actions.push({
        label: "Follow artist",
        onPress: () => {
          close();
          const artistId = album.album.artists?.[0]?.id;
          if (artistId) {
            followArtist(artistId);
          }
        },
      });
    }
    return actions;
  }, [menuAlbum, handlePlayAlbum, handleGoToArtist]);

  const renderAlbumItem = ({ item }: { item: AlbumsListItem }) => {
    if (isRateLimitItem(item)) {
      return <RateLimitListMessage message={item.message} />;
    }

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
        onLongPress={isOnline ? () => setMenuAlbum(item) : undefined}
        onPress={() => handleAlbumPress(item, isUncached)}
        placeholderIcon="album"
        primaryText={item.album.name}
        secondaryText={getArtistNames(item.album.artists)}
      />
    );
  };

  if (isLoading && !sortedAlbums) {
    return <View style={styles.centeredMessageContainer} />;
  }

  if (isFetching && !sortedAlbums) {
    return <View style={styles.centeredMessageContainer} />;
  }

  const handleLoadMore = () => {
    if (nextUrl && !isLoadingMore) {
      fetchMore();
    }
  };

  const displayAlbums: AlbumsListItem[] | null = prependRateLimitItem(
    sortedAlbums,
    isRateLimited,
    albumRateLimitMessage
  );

  return (
    <ListScreen
      data={displayAlbums}
      emptyMessage="No saved albums found."
      headerLeftIcon="sort"
      headerLeftIconPress={handleSortPress}
      isLoadingMore={isLoadingMore}
      isOnline={isOnline}
      isRefreshing={isRefreshing}
      keyExtractor={(item) => (isRateLimitItem(item) ? item.id : item.album.id)}
      onLoadMore={handleLoadMore}
      onRefresh={handleRefresh}
      renderItem={renderAlbumItem}
      title="Albums"
    >
      <ContextMenu
        actions={menuActions}
        onClose={() => setMenuAlbum(null)}
        title={menuAlbum?.album.name}
        visible={menuAlbum !== null}
      />
    </ListScreen>
  );
}
