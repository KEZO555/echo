import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useSettings } from "@/features/settings";
import { getSecondaryContentColor } from "@/shared/styles/lightTokens";
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
  isPlaying?: boolean;
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
  isPlaying = false,
  onPress,
  onLongPress,
}: TrackListItemProps) {
  const { invertColors } = useSettings();
  const subtitle = durationMs
    ? `${getArtistNames(artists)} · ${formatDuration(durationMs)}`
    : getArtistNames(artists);

  let leadingSlot = (
    <StyledText style={styles.trackNumber}>{trackNumber}.</StyledText>
  );
  if (showImage) {
    leadingSlot = (
      <FallbackImage
        containerStyle={styles.imageContainer}
        placeholderIcon="album"
        placeholderIconSize={n(24)}
        style={styles.image}
        uri={imageUri}
      />
    );
  } else if (isPlaying) {
    leadingSlot = (
      <View style={styles.playingIcon}>
        <MaterialIcons
          color={invertColors ? "black" : "white"}
          name="graphic-eq"
          size={n(24)}
        />
      </View>
    );
  }

  return (
    <HapticPressable
      onLongPress={onLongPress}
      onPress={onPress}
      style={styles.container}
    >
      {leadingSlot}
      <View style={styles.textContainer}>
        <StyledText numberOfLines={1} style={styles.trackName}>
          {name}
        </StyledText>
        <StyledText
          style={[
            styles.subtitle,
            { color: getSecondaryContentColor(invertColors) },
          ]}
        >
          {subtitle}
        </StyledText>
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
  playingIcon: {
    width: n(56),
    paddingRight: n(8),
    alignItems: "center",
    paddingTop: n(4),
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
    fontSize: n(20),
    lineHeight: n(23),
    paddingBottom: n(6),
  },
});
