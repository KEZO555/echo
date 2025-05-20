import React, { useEffect } from "react";
import {
	View,
	StyleSheet,
	FlatList,
	Image,
	ActivityIndicator,
} from "react-native";
import {
	useAuth,
	SpotifySavedAlbum,
	SpotifyArtistSimple,
} from "@/contexts/AuthContext";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function AlbumsScreen() {
	const {
		albums,
		isLoading, // Global loading state
		accessToken,
		fetchAlbums, // Specific fetch function for albums
		user,
		isRefreshingAlbums, // Specific refresh state for albums
	} = useAuth();
	const router = useRouter();

	useEffect(() => {
		// Fetch albums when the component mounts if not already loaded and user is logged in
		// and global loading is finished.
		if (accessToken && user && !albums && !isLoading) {
			fetchAlbums();
		}
	}, [accessToken, user, albums, fetchAlbums, isLoading]);

	const getArtistNames = (artists: SpotifyArtistSimple[]) => {
		return artists.map((artist) => artist.name).join(", ");
	};

	const renderAlbumItem = ({ item }: { item: SpotifySavedAlbum }) => (
		<HapticPressable
			style={styles.itemContainer}
			onPress={() => router.push(`/album/${item.album.id}`)}
		>
			{item.album.images && item.album.images.length > 0 ? (
				<Image
					source={{ uri: item.album.images[0].url }}
					style={styles.albumImage}
				/>
			) : (
				<View style={styles.placeholderImageContainer}>
					<MaterialIcons name="album" size={24} color="#535353" />
				</View>
			)}
			<View style={styles.textContainer}>
				<StyledText style={styles.albumName} numberOfLines={1}>
					{item.album.name}
				</StyledText>
				<StyledText style={styles.albumArtist} numberOfLines={1}>
					{getArtistNames(item.album.artists)}
				</StyledText>
			</View>
		</HapticPressable>
	);

	// Show global loading indicator if initial data is loading and no albums are yet available
	if (isLoading && !albums) {
		return (
			<View style={styles.centeredMessageContainer}>
				<ActivityIndicator size="large" color="#1DB954" />
			</View>
		);
	}

	// Show specific refresh indicator if only manual refresh is happening for albums
	if (isRefreshingAlbums && !albums) {
		return (
			<View style={styles.centeredMessageContainer}>
				<ActivityIndicator size="large" color="#1DB954" />
				<StyledText style={{ color: "white", marginTop: 10 }}>
					Refreshing albums...
				</StyledText>
			</View>
		);
	}

	if (!albums || albums.length === 0) {
		return (
			<View style={styles.centeredMessageContainer}>
				<StyledText style={styles.emptyText}>
					No saved albums found.
				</StyledText>
				<StyledText style={styles.emptySubText}>
					Try saving some albums in Spotify or pull down to refresh.
				</StyledText>
			</View>
		);
	}

	return (
		<FlatList
			data={albums}
			renderItem={renderAlbumItem}
			keyExtractor={(item) => item.album.id} // Use album id as key
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
		paddingTop: 0,
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
		fontSize: 22,
		textAlign: "center",
		marginBottom: 10,
		color: "white",
	},
	emptySubText: {
		fontSize: 14,
		textAlign: "center",
	},
	itemContainer: {
		paddingVertical: 0,
		paddingHorizontal: 20,
		flexDirection: "row",
		alignItems: "center",
	},
	albumImage: {
		width: 50,
		height: 50,
		marginRight: 15,
	},
	placeholderImageContainer: {
		width: 50,
		height: 50,
		marginRight: 15,
		backgroundColor: "#282828",
		justifyContent: "center",
		alignItems: "center",
	},
	textContainer: {
		flex: 1,
		gap: 0,
	},
	albumName: {
		fontSize: 22,
		lineHeight: 22,
		color: "white",
	},
	albumArtist: {
		fontSize: 16,
		lineHeight: 16,
	},
});
