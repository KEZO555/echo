import React from "react";
import { StyleSheet, View } from "react-native";
import { formatDuration, getArtistNames, n } from "@/shared/utils";
import { HapticPressable } from "./HapticPressable";
import { StyledText } from "./StyledText";

interface Artist {
  name: string;
}

interface TrackListItemProps {
  trackNumber: number;
  name: string;
  artists: Artist[];
  durationMs?: number;
  onPress: () => void;
}

export const TrackListItem = React.memo(function TrackListItem({
  trackNumber,
  name,
  artists,
  durationMs,
  onPress,
}: TrackListItemProps) {
  const subtitle = durationMs
    ? `${getArtistNames(artists)} · ${formatDuration(durationMs)}`
    : getArtistNames(artists);

  return (
    <HapticPressable onPress={onPress} style={styles.container}>
      <StyledText style={styles.trackNumber}>{trackNumber}.</StyledText>
      <View style={styles.textContainer}>
        <StyledText numberOfLines={1} style={styles.trackName}>
          {name}
        </StyledText>
        <StyledText style={styles.subtitle}>{subtitle}</StyledText>
      </View>
    </HapticPressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    width: "100%",
  },
  trackNumber: {
    fontSize: n(26),
    paddingRight: n(8),
    textAlign: "center",
    width: n(56),
  },
  textContainer: {
    flex: 1,
    alignItems: "flex-start",
    paddingRight: n(10),
  },
  trackName: {
    flex: 1,
    fontSize: n(26),
  },
  subtitle: {
    fontSize: n(16),
    lineHeight: n(18),
    paddingBottom: n(6),
  },
});
