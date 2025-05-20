import React, { useEffect } from "react";
import {
	View,
	StyleSheet,
	Text,
	FlatList,
	Image,
	ActivityIndicator,
} from "react-native";
import { useAuth, SpotifyPlaylist } from "@/contexts/AuthContext"; // Assuming SpotifyPlaylist is exported from AuthContext
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { MaterialIcons } from "@expo/vector-icons";

export default function PlaylistsScreen() {
	const { playlists, isLoading, accessToken, fetchPlaylists, user } =
		useAuth();

	useEffect(() => {
		// Fetch playlists when the component mounts if not already loaded and user is logged in
		if (accessToken && !playlists && user) {
			fetchPlaylists();
		}
	}, [accessToken, playlists, user, fetchPlaylists]);

	const renderPlaylistItem = ({ item }: { item: SpotifyPlaylist }) => (
		<HapticPressable
			style={styles.itemContainer}
			// onPress={() => router.push(`/playlist/${item.id}`)} // TODO: Implement navigation to playlist details
		>
			{item.images && item.images.length > 0 ? (
				<Image
					source={{ uri: item.images[0].url }}
					style={styles.playlistImage}
				/>
			) : (
				<View style={styles.placeholderImageContainer}>
					<MaterialIcons
						name="music-note"
						size={24}
						color="#535353"
					/>
				</View>
			)}
			<View style={styles.textContainer}>
				<StyledText style={styles.playlistName} numberOfLines={1}>
					{item.name}
				</StyledText>
				<StyledText style={styles.playlistOwner} numberOfLines={1}>
					{item.owner.display_name || item.owner.id}
				</StyledText>
			</View>
		</HapticPressable>
	);

	if (isLoading && !playlists) {
		return (
			<View style={styles.centeredMessageContainer}>
				<ActivityIndicator size="large" color="#1DB954" />
			</View>
		);
	}

	if (!playlists || playlists.length === 0) {
		return (
			<View style={styles.centeredMessageContainer}>
				<StyledText style={styles.emptyText}>
					No playlists found.
				</StyledText>
				<StyledText style={styles.emptySubText}>
					Try creating some in Spotify or pull down to refresh.
				</StyledText>
			</View>
		);
	}

	return (
		<FlatList
			data={playlists}
			renderItem={renderPlaylistItem}
			keyExtractor={(item) => item.id}
			style={styles.list}
			contentContainerStyle={styles.listContentContainer}
			ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
			overScrollMode={"never"}
		/>
	);
}

const styles = StyleSheet.create({
	list: {
		flex: 1,
		backgroundColor: "black",
	},
	listContentContainer: {
		paddingTop: 0, // Adjusted from 36 for a bit less space at the very top
		paddingBottom: 0,
	},
	centeredMessageContainer: {
		flex: 1,
		backgroundColor: "black",
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 20,
	},
	emptyText: {
		fontSize: 22, // Adjusted from 26
		textAlign: "center",
		marginBottom: 10,
		color: "white",
	},
	emptySubText: {
		fontSize: 14, // Adjusted from 16
		textAlign: "center",
		color: "#b3b3b3",
	},
	itemContainer: {
		paddingVertical: 0,
		paddingHorizontal: 20,
		flexDirection: "row",
		alignItems: "center",
	},
	playlistImage: {
		width: 50,
		height: 50,
		marginRight: 15,
	},
	placeholderImageContainer: {
		width: 60,
		height: 60,
		marginRight: 15,
		borderRadius: 4,
		backgroundColor: "#282828",
		justifyContent: "center",
		alignItems: "center",
	},
	textContainer: {
		flex: 1,
		gap: 0,
	},
	playlistName: {
		fontSize: 22,
		lineHeight: 22,
	},
	playlistOwner: {
		fontSize: 16,
		lineHeight: 16,
	},
});
