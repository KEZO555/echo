import React, { useEffect } from "react";
import { Stack, SplashScreen, useRouter } from "expo-router";
import { HapticProvider } from "../contexts/HapticContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext"; // Adjust path as needed
import {
	TabPreferencesProvider,
	useTabPreferences,
} from "@/contexts/TabPreferencesContext";
import { useFonts } from "expo-font"; // Import useFonts
import "../utils/logger"; // Initialize logger early

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function RootNavigation() {
	const { accessToken, isLoading: authLoading } = useAuth();
	const { preferences, isLoading: preferencesLoading } = useTabPreferences();
	const router = useRouter();

	// Font loading state
	const [fontsLoaded, fontError] = useFonts({
		"PublicSans-Regular": require("../assets/fonts/PublicSans-Regular.ttf"),
		// Add other global fonts here if needed
	});

	const isLoading =
		authLoading || preferencesLoading || (!fontsLoaded && !fontError);

	// Function to get the first available tab based on preferences
	const getFirstAvailableTab = () => {
		if (preferences.showLikedSongs) return "/(tabs)";
		if (preferences.showAlbums) return "/(tabs)/albums";
		if (preferences.showPlaylists) return "/(tabs)/playlists";
		// Search and Settings are always available, default to search
		return "/(tabs)/search";
	};

	useEffect(() => {
		if (!isLoading) {
			SplashScreen.hideAsync(); // Hide splash screen once auth state is determined
			if (accessToken) {
				const firstAvailableTab = getFirstAvailableTab();
				router.replace(firstAvailableTab as any);
			} else {
				router.replace("/login");
			}
		}
	}, [accessToken, isLoading, router, fontsLoaded, fontError]);

	// While loading, we can show a basic Stack or nothing,
	// as the SplashScreen is visible.
	// Or, you can return null if SplashScreen.preventAutoHideAsync() is handled well.
	if (isLoading) {
		return null; // Or a minimal loading component if SplashScreen is not enough
	}

	// This Stack will only be effectively used after the initial redirect decision.
	return (
		<Stack>
			<Stack.Screen
				name="login"
				options={{ headerShown: false, animation: "none" }}
			/>
			<Stack.Screen
				name="(tabs)"
				options={{ headerShown: false, animation: "none" }}
			/>
			<Stack.Screen
				name="playing"
				options={{
					headerShown: false,
					animation: "none",
				}}
			/>
			<Stack.Screen
				name="album/[id]"
				options={{
					headerShown: false,
					animation: "none",
				}}
			/>
			<Stack.Screen
				name="playlist/[id]"
				options={{
					headerShown: false,
					animation: "none",
				}}
			/>
			<Stack.Screen
				name="add-to-playlist"
				options={{
					headerShown: false,
					animation: "none",
				}}
			/>
			<Stack.Screen
				name="create-playlist"
				options={{
					headerShown: false,
					animation: "none",
				}}
			/>
			<Stack.Screen
				name="search-results"
				options={{
					headerShown: false,
					animation: "none",
				}}
			/>
			<Stack.Screen
				name="customise-tabs"
				options={{
					headerShown: false,
					animation: "none",
				}}
			/>
		</Stack>
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
