import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, View } from "react-native";
import { usePlayback } from "@/features/playback";
import {
  ContentContainer,
  CustomScrollView,
  LoadingScreen,
  MediaListItem,
  StyledText,
} from "@/shared/components";
import { usePreventDoubleTap } from "@/shared/hooks";
import { detailScreenStyles } from "@/shared/styles/detailScreen";
import type { SpotifyTrack } from "@/shared/types/spotify";
import { getArtistNames, getThumbnailImage, logError, n } from "@/shared/utils";
import { apiGet } from "@/shared/utils/api-client";

const ItemSeparator = () => <View style={{ height: n(8) }} />;

interface RecentlyPlayedItem {
  track: SpotifyTrack;
  played_at: string;
}

interface RecentlyPlayedResponse {
  items: RecentlyPlayedItem[];
}

export default function RecentlyPlayedScreen() {
  const router = useRouter();
  const { playTracksWithWebApi } = usePlayback();
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadRecent = useCallback(async () => {
    try {
      const data = await apiGet<RecentlyPlayedResponse>(
        "https://api.spotify.com/v1/me/player/recently-played?limit=50"
      );
      const seen = new Set<string>();
      const deduped: SpotifyTrack[] = [];
      for (const entry of data?.items ?? []) {
        const track = entry.track;
        if (track?.id && !seen.has(track.id)) {
          seen.add(track.id);
          deduped.push(track);
        }
      }
      setTracks(deduped);
    } catch (error) {
      logError("RecentlyPlayed: failed to load", error);
    }
  }, []);

  useEffect(() => {
    loadRecent().finally(() => setIsLoading(false));
  }, [loadRecent]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadRecent();
    setIsRefreshing(false);
  }, [loadRecent]);

  const handlePress = usePreventDoubleTap((track: SpotifyTrack) => {
    // Open Now Playing immediately; start playback in the background.
    router.push({
      pathname: "/playing",
      params: {
        trackName: track.name ?? "",
        artistName: getArtistNames(track.artists ?? []),
        albumArtUrl: track.album?.images?.[0]?.url ?? "",
        durationMs: track.duration_ms?.toString() ?? "0",
      },
    });
    playTracksWithWebApi([track.uri]).catch((error) =>
      logError("RecentlyPlayed: failed to play", error)
    );
  });

  if (isLoading) {
    return (
      <ContentContainer headerTitle="Recently Played">
        <LoadingScreen />
      </ContentContainer>
    );
  }

  return (
    <ContentContainer
      headerTitle="Recently Played"
      style={{ paddingHorizontal: n(20) }}
    >
      <View style={{ flex: 1, paddingBottom: n(20) }}>
        <CustomScrollView
          contentContainerStyle={detailScreenStyles.listContentContainer}
          data={tracks}
          ItemSeparatorComponent={ItemSeparator}
          keyExtractor={(item: SpotifyTrack, index: number) =>
            `${item.id}-${index}`
          }
          ListEmptyComponent={
            <StyledText style={detailScreenStyles.emptyText}>
              Nothing played recently.
            </StyledText>
          }
          overScrollMode="never"
          refreshControl={
            <RefreshControl
              colors={["white"]}
              onRefresh={handleRefresh}
              progressBackgroundColor="black"
              refreshing={isRefreshing}
            />
          }
          renderItem={({ item }: { item: SpotifyTrack }) => (
            <MediaListItem
              imageUri={getThumbnailImage(item.album?.images)}
              onPress={() => handlePress(item)}
              placeholderIcon="music-note"
              primaryText={item.name}
              secondaryText={getArtistNames(item.artists)}
            />
          )}
        />
      </View>
    </ContentContainer>
  );
}
