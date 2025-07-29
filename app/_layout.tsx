import React, { useEffect } from "react";
import { Stack, SplashScreen, useRouter } from "expo-router";
import { HapticProvider } from "../contexts/HapticContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import {
    TabPreferencesProvider,
    useTabPreferences,
} from "@/contexts/TabPreferencesContext";
import {
    InvertColorsProvider,
    useInvertColors,
} from "@/contexts/InvertColorsContext";
import { useFonts } from "expo-font";
import { setStatusBarHidden } from "expo-status-bar";
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from "expo-system-ui";
import "../utils/logger";

SplashScreen.preventAutoHideAsync();

function RootNavigation() {
    const router = useRouter();
    const { accessToken, isLoading: authLoading } = useAuth();
    const { preferences, isLoading: preferencesLoading } = useTabPreferences();
    const [fontsLoaded, fontError] = useFonts({
        "PublicSans-Regular": require("../assets/fonts/PublicSans-Regular.ttf"),
    });
    const isLoading =
        authLoading || preferencesLoading || (!fontsLoaded && !fontError);

    const getFirstAvailableTab = () => {
        if (preferences.showLikedSongs) return "/(tabs)";
        if (preferences.showArtists) return "/(tabs)/artists";
        if (preferences.showAlbums) return "/(tabs)/albums";
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
        if (!isLoading) {
            SplashScreen.hideAsync();
            if (accessToken) {
                const firstAvailableTab = getFirstAvailableTab();
                router.replace(firstAvailableTab as any);
            } else {
                router.replace("/login");
            }
        }
    }, [accessToken, isLoading, router]);

    if (isLoading) {
        return null;
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
                        <RootNavigation />
                    </AuthProvider>
                </TabPreferencesProvider>
            </InvertColorsProvider>
        </HapticProvider>
    );
}
