import React, { useEffect } from "react";
import { Stack, SplashScreen, useRouter } from "expo-router";
import { HapticProvider } from "../contexts/HapticContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext"; // Adjust path as needed
import { useFonts } from "expo-font"; // Import useFonts

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function RootNavigation() {
	const { accessToken, isLoading: authLoading } = useAuth();
	const router = useRouter();

	// Font loading state
	const [fontsLoaded, fontError] = useFonts({
		"AkkuratLL-Regular": require("../assets/fonts/AkkuratLL-Regular.otf"),
		// Add other global fonts here if needed
	});

	const isLoading = authLoading || (!fontsLoaded && !fontError);

	useEffect(() => {
		if (!isLoading) {
			SplashScreen.hideAsync(); // Hide splash screen once auth state is determined
			if (accessToken) {
				router.replace("/(tabs)");
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
			<Stack.Screen name="login" options={{ headerShown: false }} />
			<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
		</Stack>
	);
}

export default function RootLayout() {
	return (
		<HapticProvider>
			<AuthProvider>
				<RootNavigation />
			</AuthProvider>
		</HapticProvider>
	);
}
