import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { usePlayback } from "@/features/playback";
import { useSettings } from "@/features/settings";
import {
  ContentContainer,
  CustomScrollView,
  HapticPressable,
  MediaListItem,
  StyledText,
} from "@/shared/components";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import { tabScreenStyles as styles } from "@/shared/styles/detailScreen";
import { getSecondaryContentColor } from "@/shared/styles/lightTokens";
import type { SpotifyTrack } from "@/shared/types/spotify";
import { getArtistNames, getThumbnailImage, logError, n } from "@/shared/utils";
import { apiGet } from "@/shared/utils/api-client";

const ItemSeparator = () => <View style={{ height: n(8) }} />;

type TimeRange = "short_term" | "medium_term" | "long_term";

const TIME_RANGES: { id: TimeRange; label: string }[] = [
  { id: "short_term", label: "4 weeks" },
  { id: "medium_term", label: "6 months" },
  { id: "long_term", label: "All time" },
];

export default function TopTracksScreen() {
  const { playTracksWithWebApi } = usePlayback();
  const { invertColors } = useSettings();
  const { isOnline } = useNetworkState();
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<TimeRange>("medium_term");
  const [tracks, setTracks] = useState<SpotifyTrack[] | null>(null);

  const fetchTopTracks = useCallback(async (range: TimeRange) => {
    const data = await apiGet<{ items: SpotifyTrack[] }>(
      `https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=${range}`
    );
    setTracks(data?.items ?? []);
  }, []);

  useEffect(() => {
    if (!isOnline) {
      return;
    }
    setTracks(null);
    fetchTopTracks(timeRange).catch((error) =>
      logError("TopTracks: failed to load", error)
    );
  }, [timeRange, isOnline, fetchTopTracks]);

  const handleTrackPress = usePreventDoubleTap(
    async (track: SpotifyTrack, index: number) => {
      try {
        const uris = (tracks ?? []).slice(index).map((entry) => entry.uri);
        await playTracksWithWebApi(uris.length > 0 ? uris : [track.uri]);
      } catch (error) {
        logError("TopTracks: failed to play", error);
      }
      router.push({
        pathname: "/playing",
        params: {
          trackName: track.name ?? "",
          artistName: getArtistNames(track.artists ?? []),
          albumArtUrl: getThumbnailImage(track.album?.images) ?? "",
          durationMs: track.duration_ms?.toString() ?? "0",
        },
      });
    }
  );

  const renderRangeSelector = () => (
    <View style={topStyles.rangeRow}>
      {TIME_RANGES.map((range) => (
        <HapticPressable
          key={range.id}
          onPress={() => setTimeRange(range.id)}
          style={topStyles.rangeButton}
        >
          <StyledText
            style={[
              topStyles.rangeLabel,
              timeRange !== range.id && {
                color: getSecondaryContentColor(invertColors),
              },
            ]}
          >
            {range.label}
          </StyledText>
        </HapticPressable>
      ))}
    </View>
  );

  return (
    <ContentContainer
      headerTitle="Top Tracks"
      style={{ paddingHorizontal: n(20), paddingBottom: n(20), gap: 0 }}
    >
      {renderRangeSelector()}
      <CustomScrollView
        contentContainerStyle={{ ...styles.listContentContainer }}
        data={tracks ?? []}
        ItemSeparatorComponent={ItemSeparator}
        keyExtractor={(item: SpotifyTrack, index: number) =>
          `${item.id}-${index}`
        }
        ListEmptyComponent={
          tracks !== null ? (
            <StyledText style={styles.emptyText}>
              No listening history for this period yet.
            </StyledText>
          ) : null
        }
        overScrollMode="never"
        renderItem={({
          item,
          index,
        }: {
          item: SpotifyTrack;
          index: number;
        }) => (
          <MediaListItem
            disabled={!isOnline}
            imageUri={getThumbnailImage(item.album?.images)}
            onPress={() => handleTrackPress(item, index)}
            placeholderIcon="music-note"
            primaryText={`${index + 1}. ${item.name}`}
            secondaryText={getArtistNames(item.artists ?? [])}
          />
        )}
        style={styles.list}
      />
    </ContentContainer>
  );
}

const topStyles = StyleSheet.create({
  rangeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: n(24),
    marginBottom: n(14),
  },
  rangeButton: {
    paddingVertical: n(4),
  },
  rangeLabel: {
    fontSize: n(20),
  },
});
