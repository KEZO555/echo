import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, View } from "react-native";
import { SHOW_DETAIL_KEY_PREFIX } from "@/constants/spotify";
import { useAuth } from "@/features/auth";
import {
  refreshFollowedPodcastsFromCache,
  useSpotifyLibrary,
} from "@/features/library";
import { useSettings } from "@/features/settings";
import {
  ContentContainer,
  CustomScrollView,
  MediaListItem,
  StyledText,
} from "@/shared/components";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import { tabScreenStyles as styles } from "@/shared/styles/detailScreen";
import type { SpotifySavedShow } from "@/shared/types/spotify";
import { n } from "@/shared/utils";
import { getLargestImage } from "@/shared/utils/formatters";
import { log, logError } from "@/shared/utils/logger";

const YOUR_EPISODES_ID = "YOUR_EPISODES_ID";

export default function PodcastsScreen() {
  const { isLoading, accessToken, user } = useAuth();
  const {
    podcasts,
    fetchPodcasts,
    isRefreshingPodcasts,
    fetchMorePodcasts,
    isLoadingMorePodcasts,
    podcastsNextUrl,
  } = useSpotifyLibrary();
  const router = useRouter();

  const { isOnline } = useNetworkState();
  const { hideYourEpisodes } = useSettings();
  const [offlinePodcasts, setOfflinePodcasts] = useState<
    SpotifySavedShow[] | null
  >(null);
  const [cachedShowIds, setCachedShowIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (
      accessToken &&
      user &&
      !podcasts &&
      !isLoading &&
      !isRefreshingPodcasts
    ) {
      fetchPodcasts();
    }
  }, [accessToken, user, podcasts, isLoading, isRefreshingPodcasts]);

  const podcastSource = podcasts ?? offlinePodcasts;
  const sortedPodcasts = useMemo(
    () =>
      podcastSource
        ? [...podcastSource].sort((a, b) =>
            a.show.name.localeCompare(b.show.name)
          )
        : null,
    [podcastSource]
  );

  const checkCachedShows = useCallback(async () => {
    if (!sortedPodcasts) return;
    const keys = sortedPodcasts.map(
      (s) => `${SHOW_DETAIL_KEY_PREFIX}${s.show.id}`
    );
    const results = await AsyncStorage.multiGet(keys);
    const cachedIds = new Set<string>();
    results.forEach(([, value], index) => {
      if (value !== null) cachedIds.add(sortedPodcasts[index].show.id);
    });
    setCachedShowIds(cachedIds);
  }, [sortedPodcasts]);

  useFocusEffect(
    useCallback(() => {
      checkCachedShows();
    }, [checkCachedShows])
  );

  const handleRefresh = useCallback(async () => {
    if (isRefreshingPodcasts) return;

    if (isOnline) {
      fetchPodcasts();
    } else {
      log("Podcasts: Device is offline, loading cached shows");
      try {
        const cachedShows = await refreshFollowedPodcastsFromCache();
        if (cachedShows && cachedShows.length > 0) {
          setOfflinePodcasts(cachedShows);
          log(
            `Podcasts: Loaded ${cachedShows.length} cached followed podcasts`
          );
        } else {
          log("Podcasts: No cached podcasts found");
        }
      } catch (error) {
        logError("Podcasts: Error loading cached podcasts:", error);
      }
    }
  }, [fetchPodcasts, isRefreshingPodcasts, isOnline]);

  const handleYourEpisodesPress = usePreventDoubleTap(() => {
    router.push("/your-episodes" as any);
  });

  const handleShowPress = usePreventDoubleTap(
    (item: SpotifySavedShow, isUncached: boolean) => {
      if (isUncached) return;

      router.push({
        pathname: `/podcast/${item.show.id}`,
        params: {
          showName: item.show.name as string,
          showString: JSON.stringify(item.show),
        },
      } as any);
    }
  );

  const yourEpisodesItem: SpotifySavedShow = useMemo(
    () => ({
      added_at: "",
      show: {
        id: YOUR_EPISODES_ID,
        name: "Your Episodes",
        description: "",
        publisher: "",
        images: [],
        total_episodes: 0,
        uri: "",
        href: "",
        media_type: "",
        explicit: false,
        type: "show",
        languages: [],
      },
    }),
    []
  );

  const displayPodcasts = sortedPodcasts
    ? hideYourEpisodes
      ? sortedPodcasts
      : [yourEpisodesItem, ...sortedPodcasts]
    : hideYourEpisodes
      ? []
      : [yourEpisodesItem];

  const renderShowItem = ({ item }: { item: SpotifySavedShow }) => {
    if (item.show.id === YOUR_EPISODES_ID) {
      if (hideYourEpisodes) return null;
      const isDisabled = !isOnline;

      return (
        <MediaListItem
          disabled={isDisabled}
          onPress={handleYourEpisodesPress}
          placeholderIcon="bookmark"
          primaryText={item.show.name}
        />
      );
    }

    const isOffline = !isOnline;
    const isUncached = isOffline && !cachedShowIds.has(item.show.id);

    return (
      <MediaListItem
        disabled={isUncached}
        imageUri={getLargestImage(item.show.images)}
        onPress={() => handleShowPress(item, isUncached)}
        placeholderIcon="mic"
        primaryText={item.show.name}
        secondaryText={item.show.publisher}
      />
    );
  };

  const renderFooter = () => {
    if (!isLoadingMorePodcasts) return null;
    return <View style={{ paddingVertical: n(20) }} />;
  };

  const handlePlayingPress = usePreventDoubleTap(() => {
    router.push("/playing");
  });

  if (!sortedPodcasts || sortedPodcasts.length === 0) {
    const emptyData = hideYourEpisodes ? [] : [yourEpisodesItem];
    return (
      <ContentContainer
        headerIcon="multitrack-audio"
        headerIconPress={handlePlayingPress}
        headerIconShowLength={1}
        headerTitle="Podcasts"
        hideBackButton={true}
        style={{ paddingHorizontal: n(20) }}
      >
        <CustomScrollView
          contentContainerStyle={styles.listContentContainer}
          data={emptyData}
          ItemSeparatorComponent={() => <View style={{ height: n(8) }} />}
          keyExtractor={(item) => item.show.id}
          overScrollMode="never"
          refreshControl={
            <RefreshControl
              colors={["white"]}
              onRefresh={handleRefresh}
              progressBackgroundColor={"black"}
              refreshing={isRefreshingPodcasts}
              size={"large" as any}
            />
          }
          renderItem={renderShowItem}
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
      headerTitle="Podcasts"
      hideBackButton={true}
      style={{ paddingHorizontal: n(20) }}
    >
      <CustomScrollView
        contentContainerStyle={styles.listContentContainer}
        data={displayPodcasts}
        ItemSeparatorComponent={() => <View style={{ height: n(8) }} />}
        keyExtractor={(item) => item.show.id}
        ListEmptyComponent={
          isLoading || isRefreshingPodcasts ? null : (
            <StyledText style={styles.emptyText}>
              No followed podcasts yet.
            </StyledText>
          )
        }
        ListFooterComponent={renderFooter}
        onEndReached={() => {
          if (podcastsNextUrl && !isLoadingMorePodcasts) {
            fetchMorePodcasts();
          }
        }}
        onEndReachedThreshold={2}
        overScrollMode="never"
        refreshControl={
          <RefreshControl
            colors={["white"]}
            onRefresh={handleRefresh}
            progressBackgroundColor={"black"}
            refreshing={isRefreshingPodcasts}
            size={"large" as any}
          />
        }
        renderItem={renderShowItem}
        style={styles.list}
      />
    </ContentContainer>
  );
}
