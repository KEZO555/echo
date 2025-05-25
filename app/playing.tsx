import React, { useEffect, useState, useRef } from "react";
import {
	View,
	StyleSheet,
	Image,
	ActivityIndicator,
	Animated,
	AppState,
} from "react-native";
import { Header } from "@/components/Header";
import { StyledText } from "@/components/StyledText";
import {
	useAuth,
	SpotifyCurrentlyPlaying,
	SpotifyArtistSimple,
} from "@/contexts/AuthContext";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, router } from "expo-router"; // Import router
import { HapticPressable } from "@/components/HapticPressable";
import AsyncStorage from "@react-native-async-storage/async-storage";

const formatTime = (ms: number | null | undefined): string => {
	if (ms === null || ms === undefined) return "0:00";
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

export default function PlayingScreen() {
	const {
		accessToken,
		getPlaybackState,
		startPlayback,
		pausePlayback,
		skipToNext,
		skipToPrevious,
		toggleShuffle,
		toggleRepeat,
		seekToPosition,
		refreshSavedTracksFromCache,
		makeApiRequest,
	} = useAuth();
	const [playbackState, setPlaybackState] =
		useState<SpotifyCurrentlyPlaying | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isCurrentTrackSaved, setIsCurrentTrackSaved] = useState(false);
	const [currentTrackIdChecked, setCurrentTrackIdChecked] = useState<
		string | null
	>(null);

	const progress = useRef(new Animated.Value(0)).current;
	const progressBarWidthRef = useRef<number | null>(null);

	const checkIfTrackIsSaved = async (trackId: string) => {
		if (!trackId) return;

		// First, check cached saved tracks (works offline)
		try {
			const cachedSavedTracks = await AsyncStorage.getItem(
				"spotifySavedTracks"
			);
			if (cachedSavedTracks) {
				const parsedTracks = JSON.parse(cachedSavedTracks);
				const isTrackInCache = parsedTracks.some(
					(savedTrack: any) => savedTrack.track?.id === trackId
				);
				setIsCurrentTrackSaved(isTrackInCache);

				// If found in cache, we're done (works offline)
				if (isTrackInCache) {
					console.log(
						`Track ${trackId} found in offline cache - it's saved`
					);
					return;
				}
			}
		} catch (error) {
			console.error("Error checking cached saved tracks:", error);
		}

		// Only make API call if we have access token and the track wasn't found in cache
		if (!accessToken) {
			// No access token and not in cache - assume not saved
			setIsCurrentTrackSaved(false);
			return;
		}

		try {
			const data = await makeApiRequest(
				`https://api.spotify.com/v1/me/tracks/contains?ids=${trackId}`,
				"Track saved status check"
			);
			if (data && data.length > 0) {
				setIsCurrentTrackSaved(data[0]);
				console.log(`Track ${trackId} API check - saved: ${data[0]}`);
			} else {
				setIsCurrentTrackSaved(false);
			}
		} catch (error) {
			// Network error (likely offline) - gracefully handle
			console.log(
				"Error checking if track is saved (likely offline):",
				error
			);
			setIsCurrentTrackSaved(false); // Assume not saved on network error
		}
	};

	const fetchAndUpdatePlaybackState = async () => {
		// console.log("Fetching playback state for PlayingScreen...");
		const state = await getPlaybackState();
		setPlaybackState(state);

		if (state && state.item && state.item.id) {
			if (state.progress_ms !== null) {
				const progressRatio =
					state.progress_ms / state.item.duration_ms;
				progress.setValue(progressRatio > 0 ? progressRatio : 0);
			} else {
				progress.setValue(0);
			}
		} else {
			progress.setValue(0);
		}
		setIsLoading(false);
	};

	// Separate function to check if track is saved - only called when track changes
	const checkCurrentTrackSavedStatus = async (trackId: string) => {
		if (trackId !== currentTrackIdChecked) {
			await checkIfTrackIsSaved(trackId);
			setCurrentTrackIdChecked(trackId);
		}
	};

	// Effect to watch for track changes and check saved status
	useEffect(() => {
		if (playbackState && playbackState.item && playbackState.item.id) {
			checkCurrentTrackSavedStatus(playbackState.item.id);
		} else {
			setIsCurrentTrackSaved(false);
			setCurrentTrackIdChecked(null);
		}
	}, [playbackState?.item?.id]); // Only run when track ID changes

	const handlePlayPause = async () => {
		if (!playbackState) return;

		try {
			if (playbackState.is_playing) {
				await pausePlayback();
			} else {
				await startPlayback();
			}
			// Fetch updated state immediately after the action
			await fetchAndUpdatePlaybackState();
		} catch (error) {
			console.error("Error toggling playback:", error);
		}
	};

	const handleSkipToNext = async () => {
		try {
			await skipToNext();
			// Fetch updated state immediately after the action
			await fetchAndUpdatePlaybackState();
		} catch (error) {
			console.error("Error skipping to next track:", error);
		}
	};

	const handleSkipToPrevious = async () => {
		try {
			await skipToPrevious();
			// Fetch updated state immediately after the action
			await fetchAndUpdatePlaybackState();
		} catch (error) {
			console.error("Error skipping to previous track:", error);
		}
	};

	const handleShuffleToggle = async () => {
		if (!playbackState) return;

		try {
			await toggleShuffle(!playbackState.shuffle_state);
			// Fetch updated state immediately after the action
			await fetchAndUpdatePlaybackState();
		} catch (error) {
			console.error("Error toggling shuffle:", error);
		}
	};

	const handleRepeatToggle = async () => {
		if (!playbackState) return;

		try {
			// Cycle through three states: off -> context -> track -> off
			let newState: "off" | "context" | "track";
			if (playbackState.repeat_state === "off") {
				newState = "context";
			} else if (playbackState.repeat_state === "context") {
				newState = "track";
			} else {
				newState = "off";
			}
			await toggleRepeat(newState);
			// Fetch updated state immediately after the action
			await fetchAndUpdatePlaybackState();
		} catch (error) {
			console.error("Error toggling repeat:", error);
		}
	};

	const handleProgressBarSeek = async (event: any) => {
		if (
			!playbackState ||
			!playbackState.item ||
			!progressBarWidthRef.current
		)
			return;

		const tapPositionX = event.nativeEvent.locationX;
		const totalDurationMs = playbackState.item.duration_ms;
		const seekPositionMs =
			(tapPositionX / progressBarWidthRef.current) * totalDurationMs;

		try {
			await seekToPosition(seekPositionMs);
			// Optimistically update progress bar, or wait for fetchAndUpdatePlaybackState
			const progressRatio = seekPositionMs / totalDurationMs;
			progress.setValue(progressRatio > 0 ? progressRatio : 0);
			// Fetch updated state to confirm
			await fetchAndUpdatePlaybackState();
		} catch (error) {
			console.error("Error seeking track:", error);
		}
	};

	// Add these functions to handle saving/removing tracks
	const handleToggleSaveTrack = async () => {
		if (!playbackState || !playbackState.item || !playbackState.item.id)
			return;

		const trackId = playbackState.item.id;
		const currentlySaved = isCurrentTrackSaved;

		// Check if we're offline by testing access token availability
		if (!accessToken) {
			console.warn(
				"Cannot save/unsave track - no access token (likely offline)"
			);
			return;
		}

		const method = currentlySaved ? "DELETE" : "PUT";
		const url = `https://api.spotify.com/v1/me/tracks?ids=${trackId}`;

		try {
			// Use makeApiRequest with custom method
			const response = await fetch(url, {
				method,
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
			});

			if (response.ok) {
				setIsCurrentTrackSaved(!currentlySaved);
				console.log(
					`Track ${
						currentlySaved ? "unsaved" : "saved"
					} successfully.`
				);

				// Update local cache to reflect the change
				try {
					const cachedSavedTracks = await AsyncStorage.getItem(
						"spotifySavedTracks"
					);
					if (cachedSavedTracks) {
						let parsedTracks = JSON.parse(cachedSavedTracks);

						if (currentlySaved) {
							// Remove track from cache
							parsedTracks = parsedTracks.filter(
								(savedTrack: any) =>
									savedTrack.track?.id !== trackId
							);
						} else {
							// Add track to cache (create a SavedTrackObject-like structure)
							const newSavedTrack = {
								added_at: new Date().toISOString(),
								track: playbackState.item,
							};
							parsedTracks.unshift(newSavedTrack); // Add to beginning
						}

						await AsyncStorage.setItem(
							"spotifySavedTracks",
							JSON.stringify(parsedTracks)
						);
						console.log(
							`Updated local saved tracks cache: ${
								currentlySaved ? "removed" : "added"
							} track ${trackId}`
						);

						// Refresh the saved tracks state to update the UI
						await refreshSavedTracksFromCache();
					}
				} catch (cacheError) {
					console.error(
						"Error updating saved tracks cache:",
						cacheError
					);
				}
			} else {
				const errorData = await response.json();
				console.error(
					`Failed to ${currentlySaved ? "unsave" : "save"} track:`,
					errorData
				);
			}
		} catch (error) {
			// Network error (likely offline)
			console.log(
				`Error ${
					currentlySaved ? "unsaving" : "saving"
				} track (likely offline):`,
				error
			);
		}
	};

	const handleNavigateToAddToPlaylist = () => {
		if (playbackState && playbackState.item && playbackState.item.uri) {
			console.log(
				"Navigating to add-to-playlist with trackUri:",
				playbackState.item.uri
			); // Added log
			router.push({
				pathname: "/add-to-playlist",
				params: { trackUri: playbackState.item.uri },
			});
		} else {
			console.warn(
				"Cannot navigate to add to playlist: No track playing or track URI is missing."
			);
		}
	};

	useFocusEffect(
		React.useCallback(() => {
			setIsLoading(true);
			fetchAndUpdatePlaybackState(); // Initial fetch when screen comes into focus

			// Set up an interval to refresh playback state every second
			const intervalId = setInterval(() => {
				// Only fetch if the app is currently active
				if (AppState.currentState === "active") {
					fetchAndUpdatePlaybackState();
				}
			}, 1000); // Refresh every second

			return () => {
				clearInterval(intervalId);
				console.log("PlayingScreen unfocused, cleared interval.");
			};
		}, [getPlaybackState]) // Assuming getPlaybackState is stable or correctly memoized
	);

	const getArtistNames = (artists: SpotifyArtistSimple[]) => {
		return artists.map((artist) => artist.name).join(", ");
	};

	if (isLoading) {
		return <View style={[styles.container, styles.centered]}></View>;
	}

	if (!playbackState || !playbackState.item) {
		return (
			<View style={styles.container}>
				<Header />
				<View style={styles.content}>
					<View style={styles.placeholderImageContainer}></View>
					<View style={styles.trackInfoContainer}>
						<StyledText style={styles.trackName} numberOfLines={1}>
							No song playing
						</StyledText>
						<StyledText style={styles.artistName} numberOfLines={1}>
							Go back and play something!
						</StyledText>
					</View>
				</View>
			</View>
		);
	}

	const { item } = playbackState;

	const animatedWidth = progress.interpolate({
		inputRange: [0, 1],
		outputRange: ["0%", "100%"],
	});

	return (
		<View style={styles.container}>
			<Header />
			<View style={styles.content}>
				{item.album?.images && item.album.images.length > 0 ? (
					<Image
						source={{ uri: item.album.images[0].url }}
						style={styles.albumArt}
					/>
				) : (
					<View style={styles.placeholderImageContainer}>
						<MaterialIcons
							name="music-note"
							size={100}
							color="white"
						/>
					</View>
				)}
				<View style={styles.trackInfoContainer}>
					<StyledText style={styles.trackName} numberOfLines={1}>
						{item.name}
					</StyledText>
					<StyledText style={styles.artistName} numberOfLines={1}>
						{getArtistNames(item.artists)}
					</StyledText>
				</View>

				<View style={styles.timeIndicatorContainer}>
					<HapticPressable
						onPress={handleProgressBarSeek}
						style={styles.progressBarPressable}
					>
						<View
							style={styles.progressBarBackground}
							onLayout={(event) => {
								progressBarWidthRef.current =
									event.nativeEvent.layout.width;
							}}
						>
							<Animated.View
								style={[
									styles.progressBarForeground,
									{ width: animatedWidth },
								]}
							/>
						</View>
					</HapticPressable>
					<View style={styles.progressBarInfo}>
						<StyledText style={styles.timeText}>
							{formatTime(playbackState.progress_ms)}
						</StyledText>
						<StyledText style={styles.timeText}>
							{formatTime(item.duration_ms)}
						</StyledText>
					</View>
				</View>
				<View style={styles.musicControls}>
					<HapticPressable onPress={handleShuffleToggle}>
						<MaterialIcons
							name={"shuffle"}
							size={30}
							color={"white"}
						/>
						<View
							style={[
								styles.shuffleIndicator,
								playbackState?.shuffle_state &&
									styles.activeShuffleIndicator,
							]}
						></View>
					</HapticPressable>
					<HapticPressable onPress={handleSkipToPrevious}>
						<MaterialIcons
							name={"skip-previous"}
							size={52}
							color={"white"}
						/>
					</HapticPressable>
					<HapticPressable onPress={handlePlayPause}>
						<MaterialIcons
							name={
								playbackState.is_playing
									? "pause"
									: "play-arrow"
							}
							size={52}
							color={"white"}
						/>
					</HapticPressable>
					<HapticPressable onPress={handleSkipToNext}>
						<MaterialIcons
							name={"skip-next"}
							size={52}
							color={"white"}
						/>
					</HapticPressable>
					<HapticPressable onPress={handleRepeatToggle}>
						<MaterialIcons
							name={
								playbackState?.repeat_state === "track"
									? "repeat-one"
									: "repeat"
							}
							size={30}
							color={"white"}
						/>
						<View
							style={[
								styles.shuffleIndicator,
								(playbackState?.repeat_state === "context" ||
									playbackState?.repeat_state === "track") &&
									styles.activeShuffleIndicator,
							]}
						></View>
					</HapticPressable>
				</View>
				<View style={styles.musicControlsExtra}>
					<HapticPressable onPress={handleToggleSaveTrack}>
						<MaterialIcons
							name={
								isCurrentTrackSaved
									? "favorite"
									: "favorite-outline"
							}
							size={30}
							color={"white"}
						/>
					</HapticPressable>
					<HapticPressable onPress={handleNavigateToAddToPlaylist}>
						<MaterialIcons name={"add"} size={30} color={"white"} />
					</HapticPressable>
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "black",
	},
	centered: {
		justifyContent: "center",
		alignItems: "center",
	},
	content: {
		flex: 1,
		justifyContent: "flex-start",
		alignItems: "center",
	},
	albumArt: {
		width: 200,
		height: 200,
		marginBottom: 20,
	},
	placeholderImageContainer: {
		width: 200,
		height: 200,
		backgroundColor: "#282828",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 20,
	},
	trackInfoContainer: {
		alignItems: "center",
		width: "100%",
		marginBottom: 20,
	},
	trackName: {
		fontSize: 22,
		lineHeight: 24,
		color: "white",
		textAlign: "center",
	},
	artistName: {
		fontSize: 14,
		lineHeight: 16,
		textAlign: "center",
	},
	emptyText: {
		fontSize: 18,
		textAlign: "center",
		marginTop: 20,
	},
	timeIndicatorContainer: {
		width: "100%",
		alignItems: "center",
	},
	progressBarPressable: {
		// Added style for the pressable area
		width: "90%", // Match progressBarBackground width
		// backgroundColor: 'rgba(255,0,0,0.1)', // For debugging touch area
	},
	progressBarBackground: {
		height: 2,
		width: "100%", // Changed from 90% to 100% as parent pressable handles width
		backgroundColor: "white",
		overflow: "visible",
		marginBottom: 3,
	},
	progressBarForeground: {
		height: 6,
		backgroundColor: "white",
		position: "absolute",
		top: -2,
	},
	progressBarInfo: {
		flexDirection: "row",
		width: "90%",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 6,
	},
	musicControls: {
		flexDirection: "row",
		width: "92%",
		alignItems: "center",
		justifyContent: "space-between",
		paddingBottom: 20,
	},
	musicControlsExtra: {
		flexDirection: "row",
		width: "92%",
		alignItems: "center",
		justifyContent: "space-between",
	},
	shuffleIndicator: {
		height: 1,
		width: "100%",
		backgroundColor: "black",
		overflow: "visible",
	},
	activeShuffleIndicator: {
		height: 1,
		width: "100%",
		backgroundColor: "white",
		overflow: "visible",
	},
	timeText: {
		fontSize: 12,
	},
});
