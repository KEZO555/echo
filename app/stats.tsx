import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  type AggregatedItem,
  filterByRange,
  formatListenTime,
  listeningStreak,
  type StatsRange,
  topShows,
  topTracks,
  totalMinutes,
  usePlayHistoryStore,
} from "@/features/listening";
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
import { logError, n } from "@/shared/utils";

const ItemSeparator = () => <View style={{ height: n(8) }} />;

const RANGES: { id: StatsRange; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "all", label: "All time" },
];

type StatRow =
  | { kind: "header"; key: string; label: string }
  | {
      kind: "item";
      key: string;
      item: AggregatedItem;
      rank: number;
      isShow: boolean;
    };

export default function StatsScreen() {
  const events = usePlayHistoryStore((s) => s.events);
  const hydrate = usePlayHistoryStore((s) => s.hydrate);
  const { playTracksWithWebApi } = usePlayback();
  const { invertColors } = useSettings();
  const { isOnline } = useNetworkState();
  const router = useRouter();
  const [range, setRange] = useState<StatsRange>("week");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const { minutes, streak, rows } = useMemo(() => {
    const scoped = filterByRange(events, range);
    const tracks = topTracks(scoped, 10);
    const shows = topShows(scoped, 10);
    const built: StatRow[] = [];
    if (tracks.length > 0) {
      built.push({ kind: "header", key: "h-tracks", label: "Top tracks" });
      tracks.forEach((item, index) => {
        built.push({
          kind: "item",
          key: `t-${item.key}`,
          item,
          rank: index + 1,
          isShow: false,
        });
      });
    }
    if (shows.length > 0) {
      built.push({ kind: "header", key: "h-shows", label: "Top shows" });
      shows.forEach((item, index) => {
        built.push({
          kind: "item",
          key: `s-${item.key}`,
          item,
          rank: index + 1,
          isShow: true,
        });
      });
    }
    return {
      minutes: totalMinutes(scoped),
      streak: listeningStreak(events),
      rows: built,
    };
  }, [events, range]);

  const handlePlayTrack = usePreventDoubleTap(async (item: AggregatedItem) => {
    if (!item.key.startsWith("spotify:track:")) {
      return;
    }
    try {
      await playTracksWithWebApi([item.key]);
    } catch (error) {
      logError("Stats: failed to play track", error);
    }
    router.push({
      pathname: "/playing",
      params: { trackName: item.name, artistName: item.subtitle },
    });
  });

  const handleOpenShow = usePreventDoubleTap((item: AggregatedItem) => {
    if (!item.key.startsWith("spotify:show:")) {
      return;
    }
    const showId = item.key.split(":").pop();
    if (!showId) {
      return;
    }
    router.push({
      pathname: "/podcast/[id]",
      params: { id: showId, showName: item.name },
    } as never);
  });

  const renderRangeSelector = () => (
    <View style={local.rangeRow}>
      {RANGES.map((option) => (
        <HapticPressable
          key={option.id}
          onPress={() => setRange(option.id)}
          style={local.rangeButton}
        >
          <StyledText
            style={[
              local.rangeLabel,
              range !== option.id && {
                color: getSecondaryContentColor(invertColors),
              },
            ]}
          >
            {option.label}
          </StyledText>
        </HapticPressable>
      ))}
    </View>
  );

  const secondary = getSecondaryContentColor(invertColors);

  return (
    <ContentContainer
      headerTitle="Your Listening"
      style={{ paddingHorizontal: n(20), paddingBottom: n(20) }}
    >
      {renderRangeSelector()}
      <View style={local.summaryRow}>
        <View style={local.summaryCell}>
          <StyledText style={local.summaryValue}>{minutes}</StyledText>
          <StyledText style={[local.summaryLabel, { color: secondary }]}>
            minutes
          </StyledText>
        </View>
        <View style={local.summaryCell}>
          <StyledText style={local.summaryValue}>{streak}</StyledText>
          <StyledText style={[local.summaryLabel, { color: secondary }]}>
            day streak
          </StyledText>
        </View>
      </View>
      <CustomScrollView
        contentContainerStyle={{ ...styles.listContentContainer }}
        data={rows}
        ItemSeparatorComponent={ItemSeparator}
        keyExtractor={(item: StatRow) => item.key}
        ListEmptyComponent={
          <StyledText style={styles.emptyText}>
            Nothing here yet — play something and your stats will build up.
          </StyledText>
        }
        overScrollMode="never"
        renderItem={({ item }: { item: StatRow }) => {
          if (item.kind === "header") {
            return (
              <StyledText style={[local.sectionHeader, { color: secondary }]}>
                {item.label}
              </StyledText>
            );
          }
          return (
            <MediaListItem
              disabled={item.isShow ? !isOnline : false}
              onPress={() =>
                item.isShow
                  ? handleOpenShow(item.item)
                  : handlePlayTrack(item.item)
              }
              placeholderIcon={item.isShow ? "mic" : "music-note"}
              primaryText={`${item.rank}. ${item.item.name}`}
              secondaryText={[
                item.item.subtitle,
                formatListenTime(item.item.seconds),
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          );
        }}
        style={styles.list}
      />
    </ContentContainer>
  );
}

const local = StyleSheet.create({
  rangeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: n(24),
    marginBottom: n(12),
  },
  rangeButton: {
    paddingVertical: n(4),
  },
  rangeLabel: {
    fontSize: n(20),
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: n(18),
  },
  summaryCell: {
    alignItems: "center",
  },
  summaryValue: {
    fontSize: n(40),
  },
  summaryLabel: {
    fontSize: n(16),
  },
  sectionHeader: {
    fontSize: n(18),
    paddingTop: n(12),
    paddingBottom: n(4),
  },
});
