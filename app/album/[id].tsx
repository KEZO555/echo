import React, { useEffect, useState } from "react";
import {
	View,
	StyleSheet,
	Image,
	ActivityIndicator,
	ScrollView,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth, SpotifyAlbum } from "@/contexts/AuthContext";
import { ItemHeader } from "@/components/ItemHeader";
import { StyledText } from "@/components/StyledText";
import { MaterialIcons } from "@expo/vector-icons";

export default function AlbumDetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { accessToken } = useAuth();
	const router = useRouter();

	const [album, setAlbum] = useState<SpotifyAlbum | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

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
			setIsLoading(true);
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

	if (isLoading) {
		return (
			<View style={styles.centeredMessageContainer}>
				<ActivityIndicator size="large" color="#1DB954" />
			</View>
		);
	}

	if (error) {
		return (
			<View style={styles.centeredMessageContainer}>
				<StyledText style={styles.errorText}>Error: {error}</StyledText>
				{/* Optionally add a retry button */}
			</View>
		);
	}

	if (!album) {
		return (
			<View style={styles.centeredMessageContainer}>
				<StyledText style={styles.emptyText}>
					Album not found.
				</StyledText>
			</View>
		);
	}

	const albumImageUrl = album.images?.[0]?.url;
	const artistNames = album.artists.map((artist) => artist.name).join(", ");

	return (
		<View style={styles.container}>
			<ItemHeader
				headerTitle={album.name}
				artist={artistNames}
				iconName="more-horiz"
			/>
			<ScrollView
				contentContainerStyle={styles.scrollContentContainer}
				overScrollMode="never"
			>
				<Image
					source={{ uri: albumImageUrl }}
					style={styles.albumImage}
				/>

				{album.tracks &&
					album.tracks.items.map((track, index) => (
						<View
							key={track.id || index.toString()}
							style={styles.trackItemContainer}
						>
							<StyledText style={styles.trackNumber}>
								{track.track_number}.
							</StyledText>

							<View style={styles.trackNameContainer}>
								<StyledText
									style={styles.trackName}
									numberOfLines={1}
								>
									{track.name}
								</StyledText>
								<StyledText style={styles.trackArtistDuration}>
									{track.artists
										.map((artist) => artist.name)
										.join(", ") +
										" · " +
										formatDuration(track.duration_ms)}
								</StyledText>
							</View>
						</View>
					))}
				{(!album.tracks || album.tracks.items.length === 0) && (
					<StyledText style={styles.emptyText}>
						No tracks found for this album.
					</StyledText>
				)}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "black",
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
		color: "#b3b3b3",
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
		color: "#b3b3b3",
		textAlign: "center",
		marginBottom: 12,
	},
	albumInfo: {
		fontSize: 14,
		color: "#b3b3b3",
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
		width: 36,
		textAlign: "center",
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
		lineHeight: 15,
		paddingBottom: 6,
	},
});
