import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { RefreshControl, View } from "react-native";
import { useAuth } from "@/features/auth";
import { useSpotifyLibrary } from "@/features/library";
import {
  ContentContainer,
  CustomScrollView,
  MediaListItem,
  StyledText,
} from "@/shared/components";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import { tabScreenStyles as styles } from "@/shared/styles/detailScreen";
import type { SpotifyArtist } from "@/shared/types/spotify";
import { n } from "@/shared/utils";

export default function ArtistsScreen() {
  const { isLoading } = useAuth();
  const {
    artists,
    fetchArtists,
    isRefreshingArtists,
    fetchMoreArtists,
    isLoadingMoreArtists,
    artistsNextUrl,
  } = useSpotifyLibrary();
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
    if (!isRefreshingArtists) {
      fetchArtists();
    }
  }, [fetchArtists, isRefreshingArtists]);

  const handleArtistPress = usePreventDoubleTap(
    (item: SpotifyArtist, isDisabled: boolean) => {
      if (isDisabled) return;

      router.push({
        pathname: `/artist/${item.id}`,
        params: {
          artistName: item.name as string,
          artistString: JSON.stringify(item),
        },
      } as any);
    }
  );

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

  const handlePlayingPress = usePreventDoubleTap(() => {
    router.push("/playing");
  });

  if (isLoading && !sortedArtists) {
    return <View style={styles.centeredMessageContainer} />;
  }

  if (isRefreshingArtists && !sortedArtists) {
    return <View style={styles.centeredMessageContainer} />;
  }

  const handleLoadMore = () => {
    if (isOnline && artistsNextUrl && !isLoadingMoreArtists) {
      fetchMoreArtists();
    }
  };

  const renderFooter = () => {
    if (!isLoadingMoreArtists) return null;
    return;
  };

  if (!sortedArtists || sortedArtists.length === 0) {
    return (
      <ContentContainer
        headerIcon="multitrack-audio"
        headerIconPress={handlePlayingPress}
        headerIconShowLength={1}
        headerTitle="Artists"
        hideBackButton={true}
        style={{ paddingHorizontal: n(20) }}
      >
        <CustomScrollView
          data={[]}
          ListHeaderComponent={
            <StyledText style={styles.emptyText}>
              No saved artists found.
            </StyledText>
          }
          overScrollMode={"never"}
          refreshControl={
            <RefreshControl
              colors={["white"]}
              enabled={isOnline === true}
              onRefresh={handleRefresh}
              progressBackgroundColor={"black"}
              refreshing={isRefreshingArtists}
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
      headerTitle="Artists"
      hideBackButton={true}
      style={{ paddingHorizontal: n(20) }}
    >
      <CustomScrollView
        contentContainerStyle={styles.listContentContainer}
        data={sortedArtists}
        ItemSeparatorComponent={() => <View style={{ height: n(8) }} />}
        keyExtractor={(item) => item.id}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={2}
        overScrollMode={"never"}
        refreshControl={
          <RefreshControl
            colors={["white"]}
            enabled={isOnline === true}
            onRefresh={handleRefresh}
            progressBackgroundColor={"black"}
            refreshing={isRefreshingArtists}
            size={"large" as any}
          />
        }
        renderItem={renderArtistItem}
        style={styles.list}
      />
    </ContentContainer>
  );
}
