import { MaterialIcons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { StyleSheet, View } from "react-native";
import { usePlayback } from "@/features/playback";
import { useSettings } from "@/features/settings";
import { useNetworkState } from "@/shared/hooks/useNetworkState";
import { n } from "@/shared/utils";
import { HapticPressable } from "./HapticPressable";
import { StyledText } from "./StyledText";

export interface TabConfigItem {
  name: string;
  screenName: string;
  iconName: keyof typeof MaterialIcons.glyphMap; // For the icon
}

interface NavbarProps {
  tabsConfig: readonly TabConfigItem[];
  currentScreenName: string;
  navigation: BottomTabBarProps["navigation"];
}

export function Navbar({
  tabsConfig,
  currentScreenName,
  navigation,
}: NavbarProps) {
  const { invertColors } = useSettings();
  const { isOnline, isLoading: networkLoading } = useNetworkState();
  const { isConnectedToAppRemote } = usePlayback();

  const getStatusText = () => {
    if (isOnline) {
      return null;
    }

    if (networkLoading) {
      return "Checking connection...";
    }

    const parts = ["Device offline"];
    parts.push(
      `Remote ${isConnectedToAppRemote ? "connected" : "not connected"}`
    );

    return parts.join(" • ");
  };

  const statusText = getStatusText();

  return (
    <>
      <View
        style={[
          styles.navbar,
          { backgroundColor: invertColors ? "white" : "black" },
        ]}
      >
        {tabsConfig.map((tab) => (
          <HapticPressable
            key={tab.screenName}
            onPress={() => navigation.navigate(tab.screenName)}
          >
            <MaterialIcons
              color={(() => {
                const isActive = tab.screenName === currentScreenName;
                if (isActive) { return invertColors ? "black" : "white"; }
                return invertColors ? "#C1C1C1" : "#6E6E6E";
              })()}
              name={tab.iconName}
              size={n(48)}
            />
          </HapticPressable>
        ))}
      </View>
      {statusText && (
        <View
          style={[
            styles.offlineStrip,
            { backgroundColor: invertColors ? "black" : "white" },
          ]}
        >
          <StyledText
            style={[
              styles.offlineText,
              { color: invertColors ? "white" : "black" },
            ]}
          >
            {statusText}
          </StyledText>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: n(11),
    paddingHorizontal: n(20),
  },
  offlineStrip: {
    height: n(18),
    justifyContent: "center",
    alignItems: "center",
  },
  offlineText: {
    fontSize: n(12),
  },
});
