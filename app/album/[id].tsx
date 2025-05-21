import React, { useEffect, useState, useCallback } from "react";
import {
	View,
	StyleSheet,
	Image,
	ActivityIndicator,
	FlatList,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
	useAuth,
	SpotifyAlbum,
	SpotifyTrackSimple,
} from "@/contexts/AuthContext";
import { ItemHeader } from "@/components/ItemHeader";
import { StyledText } from "@/components/StyledText";
import { MaterialIcons } from "@expo/vector-icons";
import { HapticPressable } from "@/components/HapticPressable";

export default function AlbumDetailScreen() {
	const { id, albumString } = useLocalSearchParams<{
		id: string;
		albumString?: string;
	}>();
	const { accessToken, playTrack } = useAuth();
	const router = useRouter();

	// Try to parse the passed album string for initial state
	const initialAlbum = albumString
		? (JSON.parse(albumString) as SpotifyAlbum)
		: null;

	const [album, setAlbum] = useState<SpotifyAlbum | null>(initialAlbum);
	//isLoading is true only if we don't have an initialAlbum, or if we are fetching more details
	const [isLoading, setIsLoading] = useState(!initialAlbum);
	const [error, setError] = useState<string | null>(null);
	const [isLoadingMoreTracks, setIsLoadingMoreTracks] = useState(false);

	// Helper function to format milliseconds to MM:SS
	const formatDuration = (ms: number) => {
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
	};

	useEffect(() => {
		if (!id || !accessToken) {
			setIsLoading(false);
			if (!id) setError("Album ID is missing.");
			if (!accessToken) setError("Access token is missing."); // Should not happen if routed from authenticated state
			return;
		}

		const fetchAlbumDetails = async () => {
			// If we already have initial data, we don't need to set main loading to true,
			// as the main content is already visible. A subtle background refresh is fine.
			if (!initialAlbum) {
				setIsLoading(true);
			}
			setError(null);
			try {
				const response = await fetch(
					`https://api.spotify.com/v1/albums/${id}`,
					{
						headers: {
							Authorization: `Bearer ${accessToken}`,
						},
					}
				);
				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(
						`Failed to fetch album details: ${response.status} ${
							errorData?.error?.message || ""
						}`
					);
				}
				const data: SpotifyAlbum = await response.json();
				setAlbum(data);
			} catch (e: any) {
				console.error(e);
				setError(e.message || "An unexpected error occurred.");
			} finally {
				setIsLoading(false);
			}
		};

		fetchAlbumDetails();
	}, [id, accessToken]);

	const loadMoreTracks = useCallback(async () => {
		if (!album?.tracks?.next || isLoadingMoreTracks || !accessToken) {
			return;
		}
		setIsLoadingMoreTracks(true);
		try {
			const response = await fetch(album.tracks.next, {
				headers: { Authorization: `Bearer ${accessToken}` },
			});
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(
					`Failed to fetch more tracks: ${response.status} ${
						errorData?.error?.message || ""
					}`
				);
			}
			const data = await response.json(); // Should be of type SpotifyAlbumTracks
			setAlbum((prevAlbum) => {
				if (!prevAlbum || !prevAlbum.tracks) return prevAlbum;
				return {
					...prevAlbum,
					tracks: {
						...prevAlbum.tracks,
						items: [...prevAlbum.tracks.items, ...data.items],
						next: data.next,
					},
				};
			});
		} catch (e: any) {
			console.error("Error fetching more album tracks:", e);
			// Optionally set an error state for more tracks loading
		} finally {
			setIsLoadingMoreTracks(false);
		}
	}, [album, isLoadingMoreTracks, accessToken]);

	if (isLoading && !album) {
		return <View style={styles.centeredMessageContainer}></View>;
	}

	if (error) {
		return (
			<View style={styles.centeredMessageContainer}>
				<StyledText style={styles.errorText}>Error: {error}</StyledText>
			</View>
		);
	}

	if (!album) {
		return (
			<View style={styles.centeredMessageContainer}>
				<StyledText style={styles.emptyText}>
					Album data is unavailable.
				</StyledText>
			</View>
		);
	}

	const albumImageUrl = album.images?.[0]?.url;
	const artistNames = album.artists.map((artist) => artist.name).join(", ");

	const renderTrackItem = ({
		item: track,
		index,
	}: {
		item: SpotifyTrackSimple;
		index: number;
	}) => (
		<HapticPressable
			key={track.id || index.toString()}
			style={styles.trackItemContainer}
			onPress={() => {
				playTrack(track.uri, undefined, `spotify:album:${id}`);
				router.push("/playing");
			}}
		>
			<StyledText style={styles.trackNumber}>
				{track.track_number}.
			</StyledText>

			<View style={styles.trackNameContainer}>
				<StyledText style={styles.trackName} numberOfLines={1}>
					{track.name}
				</StyledText>
				<StyledText style={styles.trackArtistDuration}>
					{track.artists.map((artist) => artist.name).join(", ") +
						" · " +
						formatDuration(track.duration_ms)}
				</StyledText>
			</View>
		</HapticPressable>
	);

	const renderFooter = () => {
		if (!isLoadingMoreTracks) return null;
		return (
			<ActivityIndicator
				style={{ marginVertical: 20 }}
				size="large"
				color="white"
			/>
		);
	};

	return (
		<View style={styles.container}>
			<ItemHeader headerTitle={album.name} artist={artistNames} />
			<FlatList
				ListHeaderComponent={
					<>
						<View style={styles.albumArtContainer}>
							<Image
								source={{ uri: albumImageUrl }}
								style={styles.albumImage}
							/>
						</View>
					</>
				}
				data={album.tracks?.items || []}
				renderItem={renderTrackItem}
				keyExtractor={(item, index) => item.id || index.toString()}
				contentContainerStyle={styles.listContentContainer}
				overScrollMode="never"
				onEndReached={loadMoreTracks}
				onEndReachedThreshold={6}
				ListFooterComponent={renderFooter}
				ListEmptyComponent={
					isLoading ? null : album.tracks?.items?.length === 0 ? (
						<StyledText style={styles.emptyText}>
							No tracks found in this album.
						</StyledText>
					) : null
				}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "black",
	},
	albumArtContainer: {
		alignItems: "center",
		paddingVertical: 20,
	},
	albumImage: {
		width: 200,
		height: 200,
		marginBottom: 10,
	},
	scrollContentContainer: {
		alignItems: "center",
		paddingHorizontal: 20,
		paddingBottom: 20,
	},
	centeredMessageContainer: {
		flex: 1,
		backgroundColor: "black",
		justifyContent: "center",
		alignItems: "center",
		padding: 20,
	},
	errorText: {
		color: "red",
		fontSize: 16,
		textAlign: "center",
	},
	emptyText: {
		color: "white",
		fontSize: 16,
		textAlign: "center",
		marginTop: 20,
	},
	placeholderImageContainer: {
		width: 250,
		height: 250,
		borderRadius: 8,
		marginBottom: 20,
		backgroundColor: "#282828",
		justifyContent: "center",
		alignItems: "center",
	},
	albumName: {
		fontSize: 24,
		fontWeight: "bold",
		color: "white",
		textAlign: "center",
		marginBottom: 8,
	},
	artistName: {
		fontSize: 18,
		color: "white",
		textAlign: "center",
		marginBottom: 12,
	},
	albumInfo: {
		fontSize: 14,
		color: "white",
		textAlign: "center",
		marginBottom: 20,
	},
	sectionTitle: {
		fontSize: 20,
		fontWeight: "bold",
		color: "white",
		marginTop: 20,
		marginBottom: 10,
		alignSelf: "flex-start",
	},
	trackItemContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		width: "100%",
	},
	trackNumber: {
		fontSize: 26,
		paddingRight: 8,
		textAlign: "center",
		width: 56,
	},
	trackNameContainer: {
		flex: 1,
		alignItems: "flex-start",
	},
	trackName: {
		flex: 1,
		color: "white",
		fontSize: 26,
	},
	trackArtistDuration: {
		fontSize: 16,
		lineHeight: 18,
		paddingBottom: 6,
	},
	listContentContainer: {
		paddingHorizontal: 20,
		paddingBottom: 20,
	},
});
