import { StyleSheet, View } from "react-native";
import {
  SKIP_INTERVAL_OPTIONS,
  useSkipIntervalStore,
} from "@/features/playback";
import { useSettings } from "@/features/settings";
import ContentContainer from "@/shared/components/ContentContainer";
import CustomScrollView from "@/shared/components/CustomScrollView";
import { HapticPressable } from "@/shared/components/HapticPressable";
import { StyledText } from "@/shared/components/StyledText";
import { ToggleSwitch } from "@/shared/components/ToggleSwitch";
import { getSecondaryContentColor } from "@/shared/styles/lightTokens";
import { n } from "@/shared/utils";

type SettingsItem =
  | {
      type: "toggle";
      label: string;
      value: boolean;
      onValueChange: (value: boolean) => void;
    }
  | { type: "skipInterval" };

export default function CustomisePlayingScreen() {
  const {
    hideLikeButton,
    setHideLikeButton,
    hideDevicesButton,
    setHideDevicesButton,
    hideAddToPlaylistButton,
    setHideAddToPlaylistButton,
    hideLyricsButton,
    setHideLyricsButton,
    hideQueueButton,
    setHideQueueButton,
    hidePlayingCover,
    setHidePlayingCover,
    stopEpisodesAtEnd,
    setStopEpisodesAtEnd,
    invertColors,
  } = useSettings();
  const skipSeconds = useSkipIntervalStore((s) => s.seconds);
  const setSkipSeconds = useSkipIntervalStore((s) => s.setSeconds);

  const settingsItems: SettingsItem[] = [
    {
      type: "toggle",
      label: "Hide Cover Image",
      value: hidePlayingCover,
      onValueChange: setHidePlayingCover,
    },
    {
      type: "toggle",
      label: "Hide Like Button",
      value: hideLikeButton,
      onValueChange: setHideLikeButton,
    },
    {
      type: "toggle",
      label: "Hide Devices Button",
      value: hideDevicesButton,
      onValueChange: setHideDevicesButton,
    },
    {
      type: "toggle",
      label: "Hide Add to Playlist",
      value: hideAddToPlaylistButton,
      onValueChange: setHideAddToPlaylistButton,
    },
    {
      type: "toggle",
      label: "Hide Lyrics Button",
      value: hideLyricsButton,
      onValueChange: setHideLyricsButton,
    },
    {
      type: "toggle",
      label: "Hide Queue Button",
      value: hideQueueButton,
      onValueChange: setHideQueueButton,
    },
    {
      type: "toggle",
      label: "Stop After Each Episode",
      value: stopEpisodesAtEnd,
      onValueChange: setStopEpisodesAtEnd,
    },
    { type: "skipInterval" },
  ];

  const secondary = getSecondaryContentColor(invertColors);

  const renderItem = ({ item }: { item: SettingsItem }) => {
    if (item.type === "toggle") {
      return (
        <ToggleSwitch
          label={item.label}
          onValueChange={item.onValueChange}
          value={item.value}
        />
      );
    }
    return (
      <View style={styles.skipRow}>
        <StyledText style={styles.skipLabel}>Skip interval</StyledText>
        <View style={styles.skipOptions}>
          {SKIP_INTERVAL_OPTIONS.map((option) => (
            <HapticPressable
              key={option}
              onPress={() => setSkipSeconds(option)}
              style={styles.skipOption}
            >
              <StyledText
                style={[
                  styles.skipOptionLabel,
                  skipSeconds !== option && { color: secondary },
                ]}
              >
                {option}s
              </StyledText>
            </HapticPressable>
          ))}
        </View>
      </View>
    );
  };

  return (
    <ContentContainer
      headerTitle="Now Playing"
      style={{ paddingRight: n(20), paddingBottom: n(20), gap: 0 }}
    >
      <CustomScrollView
        data={settingsItems}
        ItemSeparatorComponent={() => <View style={{ height: n(47) }} />}
        keyExtractor={(_, index) => index.toString()}
        overScrollMode="never"
        renderItem={renderItem}
      />
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  skipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: n(20),
  },
  skipLabel: {
    fontSize: n(25),
  },
  skipOptions: {
    flexDirection: "row",
    gap: n(14),
  },
  skipOption: {
    paddingVertical: n(2),
  },
  skipOptionLabel: {
    fontSize: n(22),
  },
});
