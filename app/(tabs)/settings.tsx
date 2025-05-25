import React from "react";
import {
	View,
	StyleSheet,
	Text,
	Button,
	ActivityIndicator,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { StyledButton } from "@/components/StyledButton";
import { refreshAccessToken } from "@/services/tokenExchange";
import * as SecureStore from "expo-secure-store";
import {
	REFRESH_TOKEN_KEY,
	AUTH_TOKEN_KEY,
	TOKEN_EXPIRY_KEY,
} from "@/constants/spotify";

export default function SettingsScreen() {
	const { logout, isLoading, user } = useAuth();

	const handleLogout = async () => {
		await logout();
	};

	const testTokenRefresh = async () => {
		try {
			console.log("Testing token refresh...");

			// Get current tokens
			const currentAccessToken = await SecureStore.getItemAsync(
				AUTH_TOKEN_KEY
			);
			const refreshToken = await SecureStore.getItemAsync(
				REFRESH_TOKEN_KEY
			);
			const currentExpiry = await SecureStore.getItemAsync(
				TOKEN_EXPIRY_KEY
			);

			console.log("Current token info:");
			console.log("- Access token exists:", !!currentAccessToken);
			console.log(
				"- Access token preview:",
				currentAccessToken?.substring(0, 20) + "..."
			);
			console.log("- Refresh token exists:", !!refreshToken);
			console.log(
				"- Refresh token preview:",
				refreshToken?.substring(0, 30) + "..."
			);
			console.log(
				"- Current expiry:",
				currentExpiry
					? new Date(parseInt(currentExpiry)).toISOString()
					: "None"
			);

			if (!refreshToken) {
				console.error("No refresh token found");
				return;
			}

			console.log("Calling refresh endpoint...");
			const newTokens = await refreshAccessToken(refreshToken);

			console.log("Token refresh successful");
			console.log("New token info:");
			console.log(
				"- New access token preview:",
				newTokens.access_token?.substring(0, 20) + "..."
			);
			console.log(
				"- New refresh token preview:",
				newTokens.refresh_token?.substring(0, 30) + "..."
			);
			console.log("- Expires in:", newTokens.expires_in, "seconds");

			// Update stored tokens
			await SecureStore.setItemAsync(
				AUTH_TOKEN_KEY,
				newTokens.access_token
			);

			// Only update refresh token if a new one was provided
			if (newTokens.refresh_token) {
				await SecureStore.setItemAsync(
					REFRESH_TOKEN_KEY,
					newTokens.refresh_token
				);
				console.log("Updated refresh token in storage");
			} else {
				console.log(
					"Keeping existing refresh token (no new one provided)"
				);
			}

			const newExpiryTime =
				Date.now() + (newTokens.expires_in - 600) * 1000; // 10 minutes buffer
			await SecureStore.setItemAsync(
				TOKEN_EXPIRY_KEY,
				newExpiryTime.toString()
			);

			console.log("Tokens updated in secure storage");
			console.log("- New expiry:", new Date(newExpiryTime).toISOString());
		} catch (error) {
			console.error("Token refresh test failed:", error);
		}
	};

	return (
		<View style={styles.container}>
			<View style={styles.content}>
				<StyledButton
					text="Test Token Refresh"
					onPress={testTokenRefresh}
				/>
				<StyledButton text="Logout" onPress={handleLogout} />
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "black",
	},
	content: {
		flex: 1,
		justifyContent: "flex-start",
		alignItems: "flex-start",
		paddingHorizontal: 20,
		gap: 18,
	},
	button: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	buttonText: {
		fontSize: 30,
		color: "white",
	},
});
