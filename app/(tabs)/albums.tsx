import React, { useEffect, useState, useCallback } from "react";
import {
	View,
	StyleSheet,
	FlatList,
	Image,
	ActivityIndicator,
	RefreshControl,
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
		makeApiRequest, // Added for fetching album details before navigation
	} = useAuth();
	const router = useRouter();
	const [sortedAlbums, setSortedAlbums] = useState<
		SpotifySavedAlbum[] | null
	>(null);
	const [loadingAlbumId, setLoadingAlbumId] = useState<string | null>(null);

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

	const handleRefresh = useCallback(() => {
		if (!isRefreshingAlbums) {
			fetchAlbums();
		}
	}, [fetchAlbums, isRefreshingAlbums]);

	const getArtistNames = (artists: SpotifyArtistSimple[]) => {
		return artists.map((artist) => artist.name).join(", ");
	};

	const renderAlbumItem = ({ item }: { item: SpotifySavedAlbum }) => (
		<HapticPressable
			style={styles.itemContainer}
			onPress={async () => {
				if (loadingAlbumId) return; // Prevent multiple simultaneous requests

				setLoadingAlbumId(item.album.id);
				try {
					// Fetch album details first, similar to how liked songs awaits playback
					const albumData = await makeApiRequest(
						`https://api.spotify.com/v1/albums/${item.album.id}`,
						"Album details for navigation"
					);

					if (albumData) {
						// Navigate with the loaded data
						router.push({
							pathname: `/album/${item.album.id}`,
							params: { albumString: JSON.stringify(albumData) },
						} as any);
					} else {
						// Fallback to original navigation if fetch fails
						router.push({
							pathname: `/album/${item.album.id}`,
							params: { albumString: JSON.stringify(item.album) },
						} as any);
					}
				} catch (error) {
					console.error(
						"Error fetching album details for navigation:",
						error
					);
					// Fallback to original navigation on error
					router.push({
						pathname: `/album/${item.album.id}`,
						params: { albumString: JSON.stringify(item.album) },
					} as any);
				} finally {
					setLoadingAlbumId(null);
				}
			}}
		>
			{item.album.images && item.album.images.length > 0 ? (
				<View style={styles.albumImageContainer}>
					<Image
						source={{ uri: item.album.images[0].url }}
						style={styles.albumImage}
					/>
					{loadingAlbumId === item.album.id && (
						<View style={styles.loadingOverlay}>
							<ActivityIndicator size="small" color="white" />
						</View>
					)}
				</View>
			) : (
				<View style={styles.placeholderImageContainer}>
					<MaterialIcons name="album" size={24} color="white" />
					{loadingAlbumId === item.album.id && (
						<View style={styles.loadingOverlay}>
							<ActivityIndicator size="small" color="white" />
						</View>
					)}
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
			refreshControl={
				<RefreshControl
					refreshing={isRefreshingAlbums}
					onRefresh={handleRefresh}
					colors={["white"]}
					progressBackgroundColor={"black"}
					size={"large" as any}
				/>
			}
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
	albumImageContainer: {
		width: 50,
		height: 50,
		marginRight: 15,
		position: "relative",
	},
	albumImage: {
		width: 50,
		height: 50,
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
	loadingOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		width: "100%",
		height: "100%",
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "center",
		alignItems: "center",
	},
});
