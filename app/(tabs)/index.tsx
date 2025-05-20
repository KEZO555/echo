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
	SavedTrackObject,
	SpotifyArtistSimple,
} from "@/contexts/AuthContext";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

export default function LikedSongsScreen() {
	const {
		savedTracks,
		isLoading,
		accessToken,
		fetchSavedTracks,
		user,
		isRefreshingSavedTracks,
		fetchMoreSavedTracks,
		isLoadingMoreSavedTracks,
		savedTracksNextUrl,
		playTrack,
	} = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (accessToken && user && !savedTracks && !isLoading) {
			fetchSavedTracks();
		}
	}, [accessToken, user, savedTracks, fetchSavedTracks, isLoading]);

	useFocusEffect(
		React.useCallback(() => {
			if (accessToken && user) {
				console.log("Liked Songs tab focused, refreshing tracks...");
				fetchSavedTracks();
			}
		}, [accessToken, user, fetchSavedTracks])
	);

	const getArtistNames = (artists: SpotifyArtistSimple[]) => {
		return artists.map((artist) => artist.name).join(", ");
	};

	const renderTrackItem = ({ item }: { item: SavedTrackObject }) => (
		<HapticPressable
			style={styles.itemContainer}
			onPress={() =>
				playTrack(
					item.track.uri,
					undefined,
					`spotify:user:${user.id}:collection`
				)
			}
		>
			{item.track.album?.images && item.track.album.images.length > 0 ? (
				<Image
					source={{ uri: item.track.album.images[0].url }}
					style={styles.trackImage}
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
				<StyledText style={styles.trackName} numberOfLines={1}>
					{item.track.name}
				</StyledText>
				<StyledText style={styles.trackArtist} numberOfLines={1}>
					{getArtistNames(item.track.artists)}
				</StyledText>
			</View>
		</HapticPressable>
	);

	// Show global loading indicator if initial data is loading and no tracks are yet available
	if (isLoading && !savedTracks) {
		return (
			<View style={styles.centeredMessageContainer}>
				<ActivityIndicator size="large" color="#1DB954" />
			</View>
		);
	}

	// Show specific refresh indicator if only manual refresh is happening for saved tracks
	if (isRefreshingSavedTracks && !savedTracks) {
		// Or (isRefreshingSavedTracks && savedTracks) if you want to show stale data UNDER the spinner
		return (
			<View style={styles.centeredMessageContainer}>
				<ActivityIndicator size="large" color="#1DB954" />
				<StyledText style={{ color: "white", marginTop: 10 }}>
					Refreshing Liked Songs...
				</StyledText>
			</View>
		);
	}

	if (!savedTracks || savedTracks.length === 0) {
		return (
			<View style={styles.centeredMessageContainer}>
				<StyledText style={styles.emptyText}>
					No liked songs found.
				</StyledText>
				<StyledText style={styles.emptySubText}>
					Like some songs in Spotify to see them here.
				</StyledText>
			</View>
		);
	}

	const handleLoadMore = () => {
		if (savedTracksNextUrl && !isLoadingMoreSavedTracks) {
			fetchMoreSavedTracks();
		}
	};

	const renderFooter = () => {
		if (!isLoadingMoreSavedTracks) return null;
		return (
			<View style={{ paddingVertical: 20 }}>
				<ActivityIndicator size="large" color="#1DB954" />
			</View>
		);
	};

	return (
		<FlatList
			data={savedTracks}
			renderItem={renderTrackItem}
			keyExtractor={(item) => `${item.added_at}-${item.track.id}`}
			style={styles.list}
			contentContainerStyle={styles.listContentContainer}
			ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
			overScrollMode={"never"}
			onEndReached={handleLoadMore}
			onEndReachedThreshold={0.8}
			ListFooterComponent={renderFooter}
		/>
	);
}

const styles = StyleSheet.create({
	list: {
		flex: 1,
		backgroundColor: "black",
	},
	listContentContainer: {
		paddingTop: 0, // Adjusted if TabHeader takes space
		paddingBottom: 0, // Consider Navbar height
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
		color: "#b3b3b3",
	},
	itemContainer: {
		paddingVertical: 0, // Keep compact
		paddingHorizontal: 20,
		flexDirection: "row",
		alignItems: "center",
	},
	trackImage: {
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
	trackName: {
		fontSize: 22,
		lineHeight: 22,
		color: "white",
	},
	trackArtist: {
		fontSize: 16,
		lineHeight: 16,
	},
});
