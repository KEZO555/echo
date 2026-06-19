import React from "react";
import { StyleSheet, View } from "react-native";
import { formatDuration, getArtistNames, n } from "@/shared/utils";
import { FallbackImage } from "./FallbackImage";
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
  imageUri?: string;
  showImage?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

export const TrackListItem = React.memo(function TrackListItem({
  trackNumber,
  name,
  artists,
  durationMs,
  imageUri,
  showImage = false,
  onPress,
  onLongPress,
}: TrackListItemProps) {
  const subtitle = durationMs
    ? `${getArtistNames(artists)} · ${formatDuration(durationMs)}`
    : getArtistNames(artists);

  return (
    <HapticPressable
      onLongPress={onLongPress}
      onPress={onPress}
      style={styles.container}
    >
      {showImage ? (
        <FallbackImage
          containerStyle={styles.imageContainer}
          placeholderIcon="album"
          placeholderIconSize={n(24)}
          style={styles.image}
          uri={imageUri}
        />
      ) : (
        <StyledText style={styles.trackNumber}>{trackNumber}.</StyledText>
      )}
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
  imageContainer: {
    width: n(50),
    height: n(50),
    marginRight: n(15),
    position: "relative",
  },
  image: {
    width: n(50),
    height: n(50),
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
