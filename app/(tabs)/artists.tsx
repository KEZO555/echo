import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { View } from "react-native";
import { useAuth } from "@/features/auth";
import { useArtistsStore } from "@/features/library/stores";
import { ListScreen, MediaListItem } from "@/shared/components";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import { tabScreenStyles as styles } from "@/shared/styles/detailScreen";
import type { SpotifyArtist } from "@/shared/types/spotify";
import { n } from "@/shared/utils";

export default function ArtistsScreen() {
  const { isLoading } = useAuth();
  const artists = useArtistsStore((s) => s.artists);
  const fetchArtists = useArtistsStore((s) => s.fetch);
  const isRefreshing = useArtistsStore((s) => s.isRefreshing);
  const fetchMore = useArtistsStore((s) => s.fetchMore);
  const isLoadingMore = useArtistsStore((s) => s.isLoadingMore);
  const nextUrl = useArtistsStore((s) => s.nextUrl);
  const router = useRouter();

  const { isOnline } = useNetworkState();
  const sortedArtists = useMemo(
    () =>
      artists
        ? [...artists]
            .filter((artist) => artist.id && artist.name)
            .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
        : null,
    [artists]
  );

  const handleRefresh = useCallback(() => {
    if (!isRefreshing) {
      fetchArtists();
    }
  }, [fetchArtists, isRefreshing]);

  const handleArtistPress = usePreventDoubleTap(
    (item: SpotifyArtist, isDisabled: boolean) => {
      if (isDisabled) {
        return;
      }

      router.push({
        pathname: `/artist/${item.id}`,
        params: {
          artistName: item.name as string,
          artistString: JSON.stringify(item),
        },
      } as never);
    }
  );

  const handlePlayingPress = usePreventDoubleTap(() => {
    router.push("/playing");
  });

  const renderArtistItem = ({ item }: { item: SpotifyArtist }) => {
    const isDisabled = !isOnline;

    return (
      <MediaListItem
        disabled={isDisabled}
        imageStyle={{ borderRadius: n(100) }}
        imageUri={
          item.images && item.images.length > 0 ? item.images[0].url : undefined
        }
        onPress={() => handleArtistPress(item, isDisabled)}
        placeholderIcon="person"
        primaryText={item.name}
      />
    );
  };

  if (isLoading && !sortedArtists) {
    return <View style={styles.centeredMessageContainer} />;
  }

  if (isRefreshing && !sortedArtists) {
    return <View style={styles.centeredMessageContainer} />;
  }

  const handleLoadMore = () => {
    if (isOnline && nextUrl && !isLoadingMore) {
      fetchMore();
    }
  };

  return (
    <ListScreen
      data={sortedArtists}
      emptyMessage="No saved artists found."
      headerIconPress={handlePlayingPress}
      isLoadingMore={isLoadingMore}
      isOnline={isOnline}
      isRefreshing={isRefreshing}
      keyExtractor={(item) => item.id}
      onLoadMore={handleLoadMore}
      onRefresh={handleRefresh}
      refreshEnabled={isOnline === true}
      renderItem={renderArtistItem}
      title="Artists"
    />
  );
}
