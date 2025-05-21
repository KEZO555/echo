import React, { useEffect, useState } from "react";
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
		fetchMoreAlbums, // Function to fetch next page
		isLoadingMoreAlbums, // State for loading more indicator
		albumsNextUrl, // URL for the next page
	} = useAuth();
	const router = useRouter();
	const [sortedAlbums, setSortedAlbums] = useState<
		SpotifySavedAlbum[] | null
	>(null);

	useEffect(() => {
		// Fetch albums when the component mounts if not already loaded and user is logged in
		// and global loading is finished.
		if (
			accessToken &&
			user &&
			!albums &&
			!isLoading &&
			!isRefreshingAlbums
		) {
			fetchAlbums();
		}
	}, [accessToken, user, albums, isLoading, isRefreshingAlbums]);

	useEffect(() => {
		if (albums) {
			const newSortedAlbums = [...albums].sort((a, b) => {
				const artistA = a.album.artists[0]?.name.toLowerCase() || "";
				const artistB = b.album.artists[0]?.name.toLowerCase() || "";
				if (artistA < artistB) return -1;
				if (artistA > artistB) return 1;
				return 0;
			});
			setSortedAlbums(newSortedAlbums);
		}
	}, [albums]);

	const getArtistNames = (artists: SpotifyArtistSimple[]) => {
		return artists.map((artist) => artist.name).join(", ");
	};

	const renderAlbumItem = ({ item }: { item: SpotifySavedAlbum }) => (
		<HapticPressable
			style={styles.itemContainer}
			onPress={() =>
				router.push({
					pathname: `/album/${item.album.id}`,
					params: { albumString: JSON.stringify(item.album) }, // Pass album data as a string
				} as any)
			}
		>
			{item.album.images && item.album.images.length > 0 ? (
				<Image
					source={{ uri: item.album.images[0].url }}
					style={styles.albumImage}
				/>
			) : (
				<View style={styles.placeholderImageContainer}>
					<MaterialIcons name="album" size={24} color="white" />
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
	if (isLoading && !sortedAlbums) {
		return <View style={styles.centeredMessageContainer}></View>;
	}

	// Show specific refresh indicator if only manual refresh is happening for albums
	if (isRefreshingAlbums && !sortedAlbums) {
		return <View style={styles.centeredMessageContainer}></View>;
	}

	if (!sortedAlbums || sortedAlbums.length === 0) {
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

	const handleLoadMore = () => {
		if (albumsNextUrl && !isLoadingMoreAlbums) {
			fetchMoreAlbums();
		}
	};

	const renderFooter = () => {
		if (!isLoadingMoreAlbums) return null;
		return;
	};

	return (
		<FlatList
			data={sortedAlbums}
			renderItem={renderAlbumItem}
			keyExtractor={(item) => item.album.id} // Use album id as key
			style={styles.list}
			contentContainerStyle={styles.listContentContainer}
			ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
			overScrollMode={"never"}
			onEndReached={handleLoadMore} // Added onEndReached
			onEndReachedThreshold={6}
			ListFooterComponent={renderFooter} // Added ListFooterComponent
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
		lineHeight: 24,
		color: "white",
	},
	albumArtist: {
		fontSize: 16,
		lineHeight: 18,
	},
});
