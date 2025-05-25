import React from "react";
import { View, StyleSheet } from "react-native";
import { Header } from "@/components/Header";
import { StyledText } from "@/components/StyledText";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useTabPreferences } from "@/contexts/TabPreferencesContext";

export default function CustomiseTabsScreen() {
	const { preferences, updatePreference, isLoading } = useTabPreferences();

	if (isLoading) {
		return (
			<View style={styles.container}>
				<Header headerTitle="Customise Tabs" />
				<View style={styles.loadingContainer}>
					<StyledText style={styles.loadingText}>
						Loading...
					</StyledText>
				</View>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<Header headerTitle="Customise Tabs" />
			<View style={styles.content}>
				<ToggleSwitch
					label="Liked Songs"
					value={preferences.showLikedSongs}
					onValueChange={(value) =>
						updatePreference("showLikedSongs", value)
					}
				/>
				<ToggleSwitch
					label="Albums"
					value={preferences.showAlbums}
					onValueChange={(value) =>
						updatePreference("showAlbums", value)
					}
				/>
				<ToggleSwitch
					label="Playlists"
					value={preferences.showPlaylists}
					onValueChange={(value) =>
						updatePreference("showPlaylists", value)
					}
				/>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "black",
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	loadingText: {
		color: "white",
		fontSize: 18,
	},
	content: {
		flex: 1,
		paddingHorizontal: 20,
		gap: 20,
		paddingTop: 14,
	},
});
