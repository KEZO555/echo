import React from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { HapticPressable } from "./HapticPressable";
import { StyledText } from "./StyledText";
import { useRouter } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useInvertColors } from "@/features/settings/contexts/InvertColorsContext";
import { useNetworkState } from "@/shared/hooks/useNetworkState";
import { usePlayback } from "@/features/playback/contexts/PlaybackContext";
import { useTabPreferences } from "@/features/settings/contexts/TabPreferencesContext";

export interface TabConfigItem {
    name: string;
    screenName: string;
    iconName: keyof typeof MaterialIcons.glyphMap; // For the icon
}

interface NavbarProps {
    tabsConfig: ReadonlyArray<TabConfigItem>;
    currentScreenName: string;
    navigation: BottomTabBarProps["navigation"];
    showPlayingButton?: boolean;
}

export function Navbar({
    tabsConfig,
    currentScreenName,
    navigation,
    showPlayingButton = false,
}: NavbarProps) {
    const router = useRouter();
    const { invertColors } = useInvertColors();
    const { isOnline } = useNetworkState();
    const { isConnectedToAppRemote } = usePlayback();
    const { preferences } = useTabPreferences();

    const handlePlayingPress = () => {
        router.push("/playing");
    };

    const getStatusText = () => {
        const parts = [];
        
        if (!isOnline) {
            parts.push("Device offline");
        }
        
        // Show remote connection status based on preference
        if (!isOnline || preferences.showRemoteStatusWhenOnline) {
            parts.push(`Remote ${isConnectedToAppRemote ? "connected" : "not connected"}`);
        }
        
        return parts.length > 0 ? parts.join(" • ") : null;
    };

    const statusText = getStatusText();

    return (
        <>
            <View style={[styles.navbar, { backgroundColor: invertColors ? "white" : "black" }]}>
                {showPlayingButton && (
                    <HapticPressable onPress={handlePlayingPress}>
                        <MaterialIcons
                            name="multitrack-audio"
                            size={48}
                            color={invertColors ? "#C1C1C1" : "#6E6E6E"}
                        />
                    </HapticPressable>
                )}
                {tabsConfig.map((tab) => (
                    <HapticPressable
                        key={tab.screenName}
                        onPress={() => navigation.navigate(tab.screenName)}
                    >
                        <MaterialIcons
                            name={tab.iconName}
                            size={48}
                            color={
                                tab.screenName === currentScreenName
                                    ? invertColors ? "black" : "white"
                                    : invertColors ? "#C1C1C1" : "#6E6E6E"
                            }
                        />
                    </HapticPressable>
                ))}
            </View>
            {statusText && (
                <View style={[styles.offlineStrip, { backgroundColor: invertColors ? "black" : "white" }]}>
                    <StyledText style={[styles.offlineText, { color: invertColors ? "white" : "black" }]}>{statusText}</StyledText>
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
        paddingVertical: 11,
        paddingHorizontal: 20,
    },
    offlineStrip: {
        height: 18,
        justifyContent: "center",
        alignItems: "center",
    },
    offlineText: {
        fontSize: 12,
    },
});
