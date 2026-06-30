import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useLivePlaybackState, usePlayback } from "@/features/playback";
import { useSettings } from "@/features/settings";
import type {
  SpotifyEpisode,
  SpotifyTrackSimple,
} from "@/shared/types/spotify";
import { getArtistNames, n } from "@/shared/utils";
import { HapticPressable } from "./HapticPressable";
import { StyledText } from "./StyledText";

export function NowPlayingBar() {
  const { snapshot } = useLivePlaybackState();
  const { startPlayback, pausePlayback } = usePlayback();
  const { invertColors } = useSettings();

  const track = snapshot?.track;
  if (!track) {
    return null;
  }

  const isEpisode =
    snapshot.currentlyPlayingType === "episode" || track.type === "episode";
  const title = track.name ?? "";
  const subtitle = isEpisode
    ? ((track as SpotifyEpisode).show?.name ?? "")
    : getArtistNames((track as SpotifyTrackSimple).artists ?? []);

  const foreground = invertColors ? "black" : "white";

  const handleOpen = () => {
    router.push("/playing");
  };

  const handlePlayPause = () => {
    if (snapshot.isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  };

  return (
    <HapticPressable
      onPress={handleOpen}
      style={[
        styles.bar,
        {
          backgroundColor: invertColors ? "white" : "black",
          borderTopColor: invertColors ? "#C1C1C1" : "#2A2A2A",
        },
      ]}
    >
      <View style={styles.textContainer}>
        <StyledText numberOfLines={1} style={styles.title}>
          {title}
        </StyledText>
        {subtitle ? (
          <StyledText numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </StyledText>
        ) : null}
      </View>
      <HapticPressable
        hitSlop={n(12)}
        onPress={handlePlayPause}
        style={styles.button}
      >
        <MaterialIcons
          color={foreground}
          name={snapshot.isPlaying ? "pause" : "play-arrow"}
          size={n(34)}
        />
      </HapticPressable>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: n(20),
    paddingVertical: n(8),
    borderTopWidth: n(1),
  },
  textContainer: {
    flex: 1,
    paddingRight: n(12),
  },
  title: {
    fontSize: n(16),
    lineHeight: n(18),
  },
  subtitle: {
    fontSize: n(12),
    lineHeight: n(14),
    opacity: 0.6,
  },
  button: {
    justifyContent: "center",
    alignItems: "center",
  },
});
