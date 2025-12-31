import React, { useEffect, useRef } from "react";
import { Stack, useRouter } from "expo-router";
import { View } from "react-native";
import { CredentialsProvider, useCredentials } from "@/features/credentials";
import { SettingsProvider, useSettings } from "@/features/settings";
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
    const { tabPreferences, isLoading: preferencesLoading, invertColors } = useSettings();
    const { isLoading: credentialsLoading } = useCredentials();
    const [fontsLoaded, fontError] = useFonts({
        "PublicSans-Regular": require("../assets/fonts/PublicSans-Regular.ttf"),
    });
    const isLoading =
        authLoading || preferencesLoading || credentialsLoading || (!fontsLoaded && !fontError);
    const hasDoneInitialRouting = useRef(false);
    const previousAccessToken = useRef<string | null>(null);

    const getFirstAvailableTab = () => {
        if (tabPreferences.showLikedSongs) return "/(tabs)";
        if (tabPreferences.showArtists) return "/(tabs)/artists";
        if (tabPreferences.showAlbums) return "/(tabs)/albums";
        if (tabPreferences.showPodcasts) return "/(tabs)/podcasts";
        if (tabPreferences.showPlaylists) return "/(tabs)/playlists";
        if (tabPreferences.showSearch) return "/(tabs)/search";
        return "/(tabs)/settings";
    };

    useEffect(() => {
        setStatusBarHidden(true, "none");
        NavigationBar.setVisibilityAsync("hidden");
        const newColor = invertColors ? "#FFFFFF" : "#000000";
        SystemUI.setBackgroundColorAsync(newColor);
    }, [invertColors]);

    useEffect(() => {
        if (isLoading) return;

        const justLoggedIn = !previousAccessToken.current && accessToken;
        const shouldRoute = !hasDoneInitialRouting.current || justLoggedIn;

        if (shouldRoute) {
            if (accessToken) {
                const firstAvailableTab = getFirstAvailableTab();
                router.replace(firstAvailableTab as any);
            } else {
                router.replace("/login");
            }
            hasDoneInitialRouting.current = true;
        }

        previousAccessToken.current = accessToken;
    }, [accessToken, isLoading, router]);

    if (isLoading) {
        return (
            <View style={{ flex: 1, backgroundColor: invertColors ? 'white' : 'black', justifyContent: 'center', alignItems: 'center' }}>
                {fontsLoaded && <StyledText>Loading data...</StyledText>}
            </View>
        );
    }

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: "none",
                contentStyle: { backgroundColor: invertColors ? "white" : "black" },
                freezeOnBlur: true,
            }}
        >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="album/[id]" />
            <Stack.Screen name="artist/[id]" />
            <Stack.Screen name="playlist/[id]" />
            <Stack.Screen name="podcast/[id]" />
            <Stack.Screen name="search-results" />
            <Stack.Screen name="playing" />
            <Stack.Screen name="login" />
            <Stack.Screen name="select-device" />
            <Stack.Screen name="add-to-playlist" />
            <Stack.Screen name="create-playlist" />
            <Stack.Screen name="customise" />
            <Stack.Screen name="customise-tabs" />
        </Stack>
    );
}

export default function RootLayout() {
    return (
        <CredentialsProvider>
            <SettingsProvider>
                <AuthProvider>
                    <LibraryProvider>
                        <PlaybackProvider>
                            <RootNavigation />
                        </PlaybackProvider>
                    </LibraryProvider>
                </AuthProvider>
            </SettingsProvider>
        </CredentialsProvider>
    );
}
