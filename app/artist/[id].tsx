import React, { useEffect, useState, useCallback } from "react";
import {
	View,
	StyleSheet,
	Image,
	ActivityIndicator,
} from "react-native";
import {useLocalSearchParams, useRouter } from "expo-router";
import {
	useAuth,
	SpotifyArtist,
	SpotifyTrackSimple,
} from "@/contexts/AuthContext";
import { StyledText } from "@/components/StyledText";
import { HapticPressable } from "@/components/HapticPressable";
import ContentContainer from "@/components/ContentContainer";
import CustomScrollView from "@/components/CustomScrollView";
import { log, logError } from "@/utils/logger";

export default function ArtistDetailScreen() {
	const { id, artistString } = useLocalSearchParams<{
		id: string;
		artistString?: string;
	}>();
	const {
		accessToken,
		playTrackWithContext,
        followArtist,
        unfollowArtist,
        checkIfFollowingArtist,
		makeApiRequest,
	} = useAuth();

	const router = useRouter();

	const initialArtist = artistString
		? (JSON.parse(artistString) as SpotifyArtist)
		: null;

	const [artist, setArtist] = useState<SpotifyArtist | null>(initialArtist);
	const [isLoading, setIsLoading] = useState(!initialArtist);
	const [error, setError] = useState<string | null>(null);
	const [isFollowingArtist, setIsFollowingArtist] = useState(false);
	const [isCheckingFollowingArtist, setIsCheckingFollowingArtist] = useState(false);

	const formatDuration = (ms: number) => {
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
	};

	const checkArtistFollowingStatus = useCallback(async () => {
		if (!id) return;

		setIsCheckingFollowingArtist(true);
		try {
			const isFollowing = await checkIfFollowingArtist(id);
			setIsFollowingArtist(isFollowing);
		} catch (error) {
			logError("Error checking if artist is saved:", error);
			setIsFollowingArtist(false);
		} finally {
			setIsCheckingFollowingArtist(false);
		}
	}, [id, checkIfFollowingArtist]);

	const handleToggleFollowArtist = useCallback(async () => {
		if (!id) return;

		try {
			if (isFollowingArtist) {
				const success = await unfollowArtist(id);
				if (success) {
					setIsFollowingArtist(false);
				}
			} else {
				const success = await followArtist(id);
				if (success) {
					setIsFollowingArtist(true);
				}
			}
		} catch (error) {
			logError("Error toggling artist save status:", error);
		}
	}, [id, isFollowingArtist, followArtist, unfollowArtist]);

	useEffect(() => {
		if (!id) {
			setIsLoading(false);
			setError("Artist ID is missing.");
			return;
		}

		const fetchArtistDetails = async () => {
			if (
				initialArtist
			) {
				log(
					"Artist details: Using pre-loaded complete artist data"
				);
				setIsLoading(false);
				return;
			}

			if (!initialArtist) {
				setIsLoading(true);
			}
			setError(null);
			try {
				const data = await makeApiRequest(
					`https://api.spotify.com/v1/artists/${id}`,
					"Artist details"
				);
				if (data) {
					setArtist(data);
				} else {
					throw new Error("Failed to fetch artist details");
				}
			} catch (e: any) {
				logError("Error fetching artist details:", e);
				setError(e.message || "An unexpected error occurred.");
			} finally {
				setIsLoading(false);
			}
		};

		fetchArtistDetails();
	}, [id, makeApiRequest]);

	useEffect(() => {
		if (id && accessToken) {
			checkArtistFollowingStatus();
		}
	}, [id, accessToken, checkArtistFollowingStatus]);

	// const loadMoreTracks = useCallback(async () => {
	// 	if (!artist?.tracks?.next || isLoadingMoreTracks) {
	// 		return;
	// 	}
	// 	setIsLoadingMoreTracks(true);
	// 	try {
	// 		const data = await makeApiRequest(
	// 			artist.tracks.next,
	// 			"More artist tracks"
	// 		);
	// 		if (data) {
	// 			setArtist((prevAlbum) => {
	// 				if (!prevAlbum || !prevAlbum.tracks) return prevAlbum;
	// 				return {
	// 					...prevAlbum,
	// 					tracks: {
	// 						...prevAlbum.tracks,
	// 						items: [...prevAlbum.tracks.items, ...data.items],
	// 						next: data.next,
	// 					},
	// 				};
	// 			});
	// 		}
	// 	} catch (e: any) {
	// 		logError("Error fetching more artist tracks:", e);
	// 	} finally {
	// 		setIsLoadingMoreTracks(false);
	// 	}
	// }, [artist, isLoadingMoreTracks, makeApiRequest]);

	if (isLoading && !artist) {
		return <View style={styles.centeredMessageContainer}></View>;
	}

	if (error) {
		return (
			<View style={styles.centeredMessageContainer}>
				<StyledText style={styles.errorText}>Error: {error}</StyledText>
			</View>
		);
	}

	if (!artist) {
		return (
			<View style={styles.centeredMessageContainer}>
				<StyledText style={styles.emptyText}>
					Artist data is unavailable.
				</StyledText>
			</View>
		);
	}

	const artistImageUrl = artist.images?.[0]?.url;

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
			onPress={async () => {
				try {
					await playTrackWithContext(track.uri, {
						type: "artist",
						uri: `spotify:artist:${id}`,
					});
					router.push("/playing");
				} catch (error) {
					logError("Error playing track:", error);
					// Still navigate to playing screen even if playback fails
					router.push("/playing");
				}
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

	// const renderFooter = () => {
	// 	if (!isLoadingMoreTracks) return null;
	// 	return (
	// 		<ActivityIndicator
	// 			style={{ marginVertical: 20 }}
	// 			size="large"
	// 			color="white"
	// 		/>
	// 	);
	// };

	return (
		<ContentContainer 
            headerTitle={artist.name} 
            style={{ paddingHorizontal: 20 }}
            headerIcon={isFollowingArtist ? "remove" : "add"}
            headerIconPress={handleToggleFollowArtist}
            headerIconShowLength={isCheckingFollowingArtist ? 0 : 1}
        >
        </ContentContainer>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "black",
	},
	albumArtContainer: {
		alignItems: "center",
		paddingBottom: 20,
	},
	albumImage: {
		width: 200,
		height: 200,
		marginBottom: 10,
	},
	scrollContentContainer: {
		alignItems: "center",
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
		paddingBottom: 0,
	},
});
