import { useRouter } from "expo-router";
import { View } from "react-native";
import { useSettings } from "@/features/settings";
import ContentContainer from "@/shared/components/ContentContainer";
import CustomScrollView from "@/shared/components/CustomScrollView";
import { StyledButton } from "@/shared/components/StyledButton";
import { ToggleSwitch } from "@/shared/components/ToggleSwitch";
import { n } from "@/shared/utils";

type SettingsItem =
  | {
      type: "toggle";
      label: string;
      value: boolean;
      onValueChange: (value: boolean) => void;
    }
  | { type: "button"; text: string; onPress: () => void };

export default function CustomiseTabsScreen() {
  const router = useRouter();
  const {
    invertColors,
    setInvertColors,
    hideAlbumCovers,
    setHideAlbumCovers,
    hideDetailCovers,
    setHideDetailCovers,
    hideCreatePlaylist,
    setHideCreatePlaylist,
    hideYourEpisodes,
    setHideYourEpisodes,
  } = useSettings();
  const handleCustomiseTabs = () => {
    router.push("/customise-tabs" as never);
  };
  const handleCustomisePlaying = () => {
    router.push("/customise-playing" as never);
  };

  const settingsItems: SettingsItem[] = [
    { type: "button", text: "Navigation Bar", onPress: handleCustomiseTabs },
    { type: "button", text: "Now Playing", onPress: handleCustomisePlaying },
    {
      type: "toggle",
      label: "Hide Item Images",
      value: hideAlbumCovers,
      onValueChange: setHideAlbumCovers,
    },
    {
      type: "toggle",
      label: "Hide Detail Images",
      value: hideDetailCovers,
      onValueChange: setHideDetailCovers,
    },
    {
      type: "toggle",
      label: "Hide Create Playlist",
      value: hideCreatePlaylist,
      onValueChange: setHideCreatePlaylist,
    },
    {
      type: "toggle",
      label: "Hide Your Episodes",
      value: hideYourEpisodes,
      onValueChange: setHideYourEpisodes,
    },
    {
      type: "toggle",
      label: "Invert Colours",
      value: invertColors,
      onValueChange: setInvertColors,
    },
  ];

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
    return <StyledButton onPress={item.onPress} text={item.text} />;
  };

  return (
    <ContentContainer
      headerTitle="Customise"
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
