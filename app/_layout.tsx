import React, { useEffect, useRef } from "react";
import { Stack, useRouter } from "expo-router";
import { View } from "react-native";
import { HapticProvider, TabPreferencesProvider, useTabPreferences, InvertColorsProvider, useInvertColors } from "@/features/settings";
import { AuthProvider, useAuth } from "@/features/auth";
import { LibraryProvider } from "@/features/library";
import { PlaybackProvider } from "@/features/playback";
import { useFonts } from "expo-font";
import { setStatusBarHidden } from "expo-status-bar";
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from "expo-system-ui";
import { StyledText } from "@/shared/components/StyledText";
import "@/shared/utils/logger";

function RootNavigation() {
    const router = useRouter();
    const { accessToken, isLoading: authLoading } = useAuth();
    const { preferences, isLoading: preferencesLoading } = useTabPreferences();
    const [fontsLoaded, fontError] = useFonts({
        "PublicSans-Regular": require("../assets/fonts/PublicSans-Regular.ttf"),
    });
    const isLoading =
        authLoading || preferencesLoading || (!fontsLoaded && !fontError);
    const hasDoneInitialRouting = useRef(false);

    const getFirstAvailableTab = () => {
        if (preferences.showLikedSongs) return "/(tabs)";
        if (preferences.showArtists) return "/(tabs)/artists";
        if (preferences.showAlbums) return "/(tabs)/albums";
        if (preferences.showPodcasts) return "/(tabs)/podcasts";
        if (preferences.showPlaylists) return "/(tabs)/playlists";
        if (preferences.showSearch) return "/(tabs)/search";
        return "/(tabs)/settings";
    };

    const { invertColors } = useInvertColors();

    useEffect(() => {
        setStatusBarHidden(true, "none");
        NavigationBar.setVisibilityAsync("hidden");
        const newColor = invertColors ? "#FFFFFF" : "#000000";
        SystemUI.setBackgroundColorAsync(newColor);
    }, [invertColors]);

    useEffect(() => {
        if (!isLoading && !hasDoneInitialRouting.current) {
            if (accessToken) {
                const firstAvailableTab = getFirstAvailableTab();
                router.replace(firstAvailableTab as any);
            } else {
                router.replace("/login");
            }
            hasDoneInitialRouting.current = true;
        }
    }, [accessToken, isLoading, router]);

    if (isLoading) {
        return (
            <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
                <StyledText>Loading data...</StyledText>
            </View>
        );
    }

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: "none",
            }}
        ></Stack>
    );
}

export default function RootLayout() {
    return (
        <HapticProvider>
            <InvertColorsProvider>
                <TabPreferencesProvider>
                    <AuthProvider>
                        <LibraryProvider>
                            <PlaybackProvider>
                                <RootNavigation />
                            </PlaybackProvider>
                        </LibraryProvider>
                    </AuthProvider>
                </TabPreferencesProvider>
            </InvertColorsProvider>
        </HapticProvider>
    );
}
