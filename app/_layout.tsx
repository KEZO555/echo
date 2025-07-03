import React, { useEffect } from "react";
import { Stack, SplashScreen, useRouter } from "expo-router";
import { HapticProvider } from "../contexts/HapticContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import {
	TabPreferencesProvider,
	useTabPreferences,
} from "@/contexts/TabPreferencesContext";
import { useFonts } from "expo-font";
import { setStatusBarHidden } from "expo-status-bar";
import * as NavigationBar from 'expo-navigation-bar';
import "../utils/logger";

SplashScreen.preventAutoHideAsync();

function RootNavigation() {
	const { accessToken, isLoading: authLoading } = useAuth();
	const { preferences, isLoading: preferencesLoading } = useTabPreferences();
	const router = useRouter();

	const [fontsLoaded, fontError] = useFonts({
		"PubeicSans-Regular": require("../assets/fonts/PublicSans-Regular.ttf"),
	});

	useEffect(() => {
		setStatusBarHidden(true, "none");
        NavigationBar.setVisibilityAsync("hidden");
	}, []);

	const isLoading =
		authLoading || preferencesLoading || (!fontsLoaded && !fontError);

	const getFirstAvailableTab = () => {
		if (preferences.showLikedSongs) return "/(tabs)";
		if (preferences.showAlbums) return "/(tabs)/albums";
		if (preferences.showPlaylists) return "/(tabs)/playlists";
		if (preferences.showSearch) return "/(tabs)/search";
		return "/(tabs)/settings";
	};

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
	}, [accessToken, isLoading, router, fontsLoaded, fontError]);

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
			<TabPreferencesProvider>
				<AuthProvider>
					<RootNavigation />
				</AuthProvider>
			</TabPreferencesProvider>
		</HapticProvider>
	);
}
