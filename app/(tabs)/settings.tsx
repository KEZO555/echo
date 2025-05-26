import React from "react";
import {
	View,
	StyleSheet,
	Text,
	Button,
	ActivityIndicator,
	Alert,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { StyledButton } from "@/components/StyledButton";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { logger } from "@/utils/logger";

export default function SettingsScreen() {
	const {
		logout,
		isLoading,
		user,
		ensureValidToken,
		fetchSavedTracks,
		fetchPlaylists,
		fetchAlbums,
		searchItems,
		makeApiRequest,
		playlists,
		albums,
		forceTokenExpiry,
	} = useAuth();
	const router = useRouter();

	const handleLogout = async () => {
		await logout();
	};

	const handleCustomiseTabs = () => {
		router.push("/customise-tabs" as any);
	};

	const handleTestTokenRefresh = async () => {
		try {
			console.log("Testing token refresh logic...");

			// Simply call ensureValidToken to test the refresh logic
			// This will check if token needs refresh and do it if necessary
			console.log("Calling ensureValidToken to test refresh logic...");
			const validToken = await ensureValidToken();

			if (validToken) {
				console.log(
					"SUCCESS: ensureValidToken returned a valid token!"
				);

				// Test with multiple API calls to ensure token works across endpoints
				console.log("Testing with fetchPlaylists...");
				await fetchPlaylists();
				console.log("SUCCESS: fetchPlaylists completed!");

				console.log("Testing with fetchAlbums...");
				await fetchAlbums();
				console.log("SUCCESS: fetchAlbums completed!");

				console.log("Testing with fetchSavedTracks...");
				await fetchSavedTracks();
				console.log("SUCCESS: fetchSavedTracks completed!");

				// Test search functionality
				console.log("Testing with searchItems...");
				const searchResults = await searchItems("test", [
					"track",
					"album",
				]);
				console.log(
					"SUCCESS: searchItems completed!",
					searchResults ? "Got results" : "No results"
				);

				// Test playlist tracklist fetching (if we have playlists)
				if (playlists && playlists.length > 0) {
					const firstPlaylist = playlists[0];
					console.log(
						`Testing playlist tracklist fetch for: ${firstPlaylist.name}`
					);
					const playlistData = await makeApiRequest(
						`https://api.spotify.com/v1/playlists/${firstPlaylist.id}`,
						"Playlist tracklist test"
					);
					console.log(
						"SUCCESS: Playlist tracklist fetch completed!",
						playlistData ? "Got tracks" : "No tracks"
					);
				}

				// Test album tracklist fetching (if we have albums)
				if (albums && albums.length > 0) {
					const firstAlbum = albums[0];
					console.log(
						`Testing album tracklist fetch for: ${firstAlbum.album.name}`
					);
					const albumData = await makeApiRequest(
						`https://api.spotify.com/v1/albums/${firstAlbum.album.id}`,
						"Album tracklist test"
					);
					console.log(
						"SUCCESS: Album tracklist fetch completed!",
						albumData ? "Got tracks" : "No tracks"
					);
				}

				console.log("SUCCESS: All API calls successful!");
			} else {
				console.log(
					"ERROR: ensureValidToken returned null - check your auth state"
				);
			}
		} catch (error) {
			console.error("ERROR: Token refresh test failed:", error);
		}
	};

	const handleForceTokenExpiry = async () => {
		try {
			if (!forceTokenExpiry) {
				console.log(
					"ERROR: forceTokenExpiry method not available (not in dev mode?)"
				);
				return;
			}

			// Force token expiry using the context method
			await forceTokenExpiry();

			console.log(
				"Now testing with multiple API calls to trigger refresh..."
			);

			// Test with multiple API calls that should trigger refresh
			console.log("Testing fetchPlaylists (should trigger refresh)...");
			await fetchPlaylists();
			console.log(
				"SUCCESS: fetchPlaylists with token refresh completed!"
			);

			console.log("Testing fetchAlbums (should use refreshed token)...");
			await fetchAlbums();
			console.log("SUCCESS: fetchAlbums completed!");

			console.log(
				"Testing fetchSavedTracks (should use refreshed token)..."
			);
			await fetchSavedTracks();
			console.log("SUCCESS: fetchSavedTracks completed!");

			console.log("Testing searchItems (should use refreshed token)...");
			const searchResults = await searchItems("test", ["track"]);
			console.log(
				"SUCCESS: searchItems completed!",
				searchResults ? "Got results" : "No results"
			);

			// Test playlist tracklist fetching (should use refreshed token)
			if (playlists && playlists.length > 0) {
				const firstPlaylist = playlists[0];
				console.log(
					`Testing playlist tracklist fetch for: ${firstPlaylist.name} (should use refreshed token)...`
				);
				const playlistData = await makeApiRequest(
					`https://api.spotify.com/v1/playlists/${firstPlaylist.id}`,
					"Playlist tracklist test"
				);
				console.log(
					"SUCCESS: Playlist tracklist fetch completed!",
					playlistData ? "Got tracks" : "No tracks"
				);
			}

			// Test album tracklist fetching (should use refreshed token)
			if (albums && albums.length > 0) {
				const firstAlbum = albums[0];
				console.log(
					`Testing album tracklist fetch for: ${firstAlbum.album.name} (should use refreshed token)...`
				);
				const albumData = await makeApiRequest(
					`https://api.spotify.com/v1/albums/${firstAlbum.album.id}`,
					"Album tracklist test"
				);
				console.log(
					"SUCCESS: Album tracklist fetch completed!",
					albumData ? "Got tracks" : "No tracks"
				);
			}

			console.log(
				"SUCCESS: All token refresh tests completed successfully!"
			);
		} catch (error) {
			console.error("ERROR: Force token expiry test failed:", error);
		}
	};

	const handleShareLogs = async () => {
		try {
			const logFilePath = logger.getLogFilePath();
			const fileInfo = await FileSystem.getInfoAsync(logFilePath);

			if (!fileInfo.exists) {
				Alert.alert(
					"Error",
					"Log file not found. Try using the app first to generate some logs."
				);
				return;
			}

			// Show file info before sharing
			const fileSizeKB = Math.round((fileInfo.size || 0) / 1024);
			console.log(`Log file path: ${logFilePath}`);
			console.log(`Log file size: ${fileSizeKB} KB`);

			const isAvailable = await Sharing.isAvailableAsync();
			if (!isAvailable) {
				Alert.alert(
					"Error",
					"Sharing is not available on this device."
				);
				return;
			}

			Alert.alert(
				"Debug Logs",
				`Log file: ${fileSizeKB} KB\nPath: ${logFilePath}\n\nNote: You can share this file but may not be able to save directly to Files app. Try sharing to Notes, Email, or AirDrop.`,
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Share",
						onPress: async () => {
							await Sharing.shareAsync(logFilePath, {
								mimeType: "text/plain",
								dialogTitle: "Share Debug Logs",
							});
						},
					},
				]
			);
		} catch (error) {
			Alert.alert("Error", "Failed to share logs: " + error);
		}
	};

	return (
		<View style={styles.container}>
			<View style={styles.content}>
				<StyledButton
					text="Customise Tabs"
					onPress={handleCustomiseTabs}
				/>

				{/* Development/Testing buttons - only when logged in */}
				{__DEV__ && user && (
					<>
						<StyledButton
							text="Test Token Refresh"
							onPress={handleTestTokenRefresh}
						/>
						<StyledButton
							text="Force Token Expiry"
							onPress={handleForceTokenExpiry}
						/>
					</>
				)}

				{/* Debug logs - available even when logged out */}
				{__DEV__ && (
					<StyledButton
						text="Share Debug Logs"
						onPress={handleShareLogs}
					/>
				)}

				{/* Only show logout when logged in */}
				{user && <StyledButton text="Logout" onPress={handleLogout} />}
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
		paddingHorizontal: 38,
		paddingTop: 4,
		gap: 46,
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
