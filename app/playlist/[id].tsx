import React, { useEffect, useState } from "react";
import {
	View,
	StyleSheet,
	Image,
	ActivityIndicator,
	ScrollView,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
	useAuth,
	SpotifyPlaylist,
	SpotifyTrackSimple, // Assuming this can be reused or adapted
	SpotifyArtistSimple,
} from "@/contexts/AuthContext";
import { ItemHeader } from "@/components/ItemHeader";
import { StyledText } from "@/components/StyledText";
import { MaterialIcons } from "@expo/vector-icons";
import { HapticPressable } from "@/components/HapticPressable";

// Interface for the structure of a track item within a playlist from Spotify API
interface PlaylistTrack {
	added_at: string;
	added_by: {
		external_urls: { spotify: string };
		href: string;
		id: string;
		type: string;
		uri: string;
	} | null;
	is_local: boolean;
	track: SpotifyTrackSimple | null; // Track can be null if unavailable
}

// Interface for the full playlist object with tracks
interface SpotifyPlaylistFull extends SpotifyPlaylist {
	tracks: {
		href: string;
		items: PlaylistTrack[];
		limit: number;
		next: string | null;
		offset: number;
		previous: string | null;
		total: number;
	};
}

export default function PlaylistDetailScreen() {
	const { id, playlistString } = useLocalSearchParams<{
		id: string;
		playlistString?: string;
	}>();
	const { accessToken, playTrack } = useAuth();
	const router = useRouter();

	const initialPlaylist = playlistString
		? (JSON.parse(playlistString) as SpotifyPlaylistFull)
		: null;

	const [playlist, setPlaylist] = useState<SpotifyPlaylistFull | null>(
		initialPlaylist
	);
	const [isLoading, setIsLoading] = useState(!initialPlaylist);
	const [error, setError] = useState<string | null>(null);

	const formatDuration = (ms: number) => {
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
	};

	useEffect(() => {
		if (!id || !accessToken) {
			setIsLoading(false);
			if (!id) setError("Playlist ID is missing.");
			if (!accessToken) setError("Access token is missing.");
			return;
		}

		const fetchPlaylistDetails = async () => {
			if (!initialPlaylist) {
				setIsLoading(true);
			}
			setError(null);
			try {
				const response = await fetch(
					`https://api.spotify.com/v1/playlists/${id}`,
					{
						headers: {
							Authorization: `Bearer ${accessToken}`,
						},
					}
				);
				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(
						`Failed to fetch playlist details: ${response.status} ${
							errorData?.error?.message || ""
						}`
					);
				}
				const data: SpotifyPlaylistFull = await response.json();
				setPlaylist(data);
			} catch (e: any) {
				console.error(e);
				setError(e.message || "An unexpected error occurred.");
			} finally {
				setIsLoading(false);
			}
		};

		fetchPlaylistDetails();
	}, [id, accessToken]);

	if (isLoading && !playlist) {
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
			</View>
		);
	}

	if (!playlist) {
		return (
			<View style={styles.centeredMessageContainer}>
				<StyledText style={styles.emptyText}>
					Playlist data is unavailable.
				</StyledText>
			</View>
		);
	}

	const playlistImageUrl = playlist.images?.[0]?.url;
	const ownerName = playlist.owner.display_name || playlist.owner.id;

	return (
		<View style={styles.container}>
			<ItemHeader
				headerTitle={playlist.name}
				artist={`By ${ownerName}`}
				iconName="more-horiz" // Or another relevant icon
			/>
			<ScrollView
				contentContainerStyle={styles.scrollContentContainer}
				overScrollMode="never"
			>
				{playlistImageUrl ? (
					<Image
						source={{ uri: playlistImageUrl }}
						style={styles.playlistImage}
					/>
				) : (
					<View style={styles.placeholderImageContainer}>
						<MaterialIcons
							name="playlist-play"
							size={80}
							color="#535353"
						/>
					</View>
				)}

				{playlist.tracks &&
					playlist.tracks.items &&
					Array.isArray(playlist.tracks.items) &&
					playlist.tracks.items.map((item, index) => {
						const track = item.track;
						if (!track) return null; // Skip if track is null (e.g., unavailable)
						return (
							<HapticPressable
								key={track.id || `${index}-${id}`}
								style={styles.trackItemContainer}
								onPress={() =>
									playTrack(
										track.uri,
										undefined,
										`spotify:playlist:${id}`
									)
								}
							>
								<StyledText style={styles.trackNumber}>
									{index + 1}.
								</StyledText>
								<View style={styles.trackNameContainer}>
									<StyledText
										style={styles.trackName}
										numberOfLines={1}
									>
										{track.name}
									</StyledText>
									<StyledText
										style={styles.trackArtistDuration}
									>
										{track.artists
											.map((artist) => artist.name)
											.join(", ") +
											(track.duration_ms
												? ` · ${formatDuration(
														track.duration_ms
												  )}`
												: "")}
									</StyledText>
								</View>
							</HapticPressable>
						);
					})}
				{(!playlist.tracks ||
					!playlist.tracks.items ||
					!Array.isArray(playlist.tracks.items) ||
					playlist.tracks.items.filter((item) => item.track)
						.length === 0) && (
					<StyledText style={styles.emptyText}>
						No tracks found in this playlist.
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
	playlistImage: {
		width: 200,
		height: 200,
		marginBottom: 10,
	},
	placeholderImageContainer: {
		width: 200,
		height: 200,
		marginBottom: 10,
		backgroundColor: "#282828",
		justifyContent: "center",
		alignItems: "center",
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
