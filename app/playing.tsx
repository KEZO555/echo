import React, { useEffect, useState, useRef } from "react";
import {
	View,
	StyleSheet,
	Image,
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
import { useFocusEffect, router } from "expo-router";
import { HapticPressable } from "@/components/HapticPressable";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ContentContainer from "@/components/ContentContainer";
import { useInvertColors } from "@/contexts/InvertColorsContext";

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
		startPlayback,
		pausePlayback,
		skipToNext,
		skipToPrevious,
		toggleShuffle,
		toggleRepeat,
		seekToPosition,
		refreshSavedTracksFromCache,
		makeApiRequest,
		ensureValidToken,
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

		if (!accessToken) {
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
			console.log(
				"Error checking if track is saved (likely offline):",
				error
			);
			setIsCurrentTrackSaved(false);
		}
	};

	const fetchAndUpdatePlaybackState = async () => {
		let state: any = null;
		try {
			state = await makeApiRequest(
				"https://api.spotify.com/v1/me/player",
				"Fetch playback state"
			);
		} catch (error) {
			console.error("Error fetching playback state via Web API:", error);
			return;
		}
		setPlaybackState(state as SpotifyCurrentlyPlaying);

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

	const checkCurrentTrackSavedStatus = async (trackId: string) => {
		if (trackId !== currentTrackIdChecked) {
			await checkIfTrackIsSaved(trackId);
			setCurrentTrackIdChecked(trackId);
		}
	};

	useEffect(() => {
		if (playbackState && playbackState.item && playbackState.item.id) {
			checkCurrentTrackSavedStatus(playbackState.item.id);
		} else {
			setIsCurrentTrackSaved(false);
			setCurrentTrackIdChecked(null);
		}
	}, [playbackState?.item?.id]);

	const handlePlayPause = async () => {
		if (!playbackState) return;

		try {
			if (playbackState.is_playing) {
				await pausePlayback();
			} else {
				await startPlayback();
			}
			await fetchAndUpdatePlaybackState();
		} catch (error) {
			console.error("Error toggling playback:", error);
		}
	};

	const handleSkipToNext = async () => {
		try {
			await skipToNext();
			await fetchAndUpdatePlaybackState();
		} catch (error) {
			console.error("Error skipping to next track:", error);
		}
	};

	const handleSkipToPrevious = async () => {
		try {
			await skipToPrevious();
			await fetchAndUpdatePlaybackState();
		} catch (error) {
			console.error("Error skipping to previous track:", error);
		}
	};

	const handleShuffleToggle = async () => {
		if (!playbackState) return;

		try {
			await toggleShuffle(!playbackState.shuffle_state);
			await fetchAndUpdatePlaybackState();
		} catch (error) {
			console.error("Error toggling shuffle:", error);
		}
	};

	const handleRepeatToggle = async () => {
		if (!playbackState) return;

		try {
			let newState: "off" | "context" | "track";
			if (playbackState.repeat_state === "off") {
				newState = "context";
			} else if (playbackState.repeat_state === "context") {
				newState = "track";
			} else {
				newState = "off";
			}
			await toggleRepeat(newState);
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
			const progressRatio = seekPositionMs / totalDurationMs;
			progress.setValue(progressRatio > 0 ? progressRatio : 0);
			await fetchAndUpdatePlaybackState();
		} catch (error) {
			console.error("Error seeking track:", error);
		}
	};

	const handleToggleSaveTrack = async () => {
		if (!playbackState || !playbackState.item || !playbackState.item.id)
			return;

		const trackId = playbackState.item.id;
		const currentlySaved = isCurrentTrackSaved;

		if (!accessToken) {
			console.warn(
				"Cannot save/unsave track - no access token (likely offline)"
			);
			return;
		}

		const method = currentlySaved ? "DELETE" : "PUT";
		const url = `https://api.spotify.com/v1/me/tracks?ids=${trackId}`;

		try {
			const validToken = await ensureValidToken();
			if (!validToken) {
				console.warn(
					"Cannot save/unsave track - no valid token available"
				);
				return;
			}

			const response = await fetch(url, {
				method,
				headers: {
					Authorization: `Bearer ${validToken}`,
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

				try {
					const cachedSavedTracks = await AsyncStorage.getItem(
						"spotifySavedTracks"
					);
					if (cachedSavedTracks) {
						let parsedTracks = JSON.parse(cachedSavedTracks);

						if (currentlySaved) {
							parsedTracks = parsedTracks.filter(
								(savedTrack: any) =>
									savedTrack.track?.id !== trackId
							);
						} else {
							const newSavedTrack = {
								added_at: new Date().toISOString(),
								track: playbackState.item,
							};
							parsedTracks.unshift(newSavedTrack);
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
			);
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
			fetchAndUpdatePlaybackState();

			const intervalId = setInterval(() => {
				if (AppState.currentState === "active") {
					fetchAndUpdatePlaybackState();
				}
			}, 1000);

			return () => {
				clearInterval(intervalId);
				console.log("PlayingScreen unfocused, cleared interval.");
			};
		}, [makeApiRequest])
	);

	const getArtistNames = (artists: SpotifyArtistSimple[]) => {
		return artists.map((artist) => artist.name).join(", ");
	};

	if (isLoading) {
		return <ContentContainer headerTitle=" "></ContentContainer>;
	}

	if (!playbackState || !playbackState.item) {
		return (
			<ContentContainer headerTitle=" ">
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
			</ContentContainer>
		);
	}

	const { item } = playbackState;

	const animatedWidth = progress.interpolate({
		inputRange: [0, 1],
		outputRange: ["0%", "100%"],
	});

    const { invertColors } = useInvertColors();

	return (
		<ContentContainer headerTitle=" " style={{ paddingHorizontal: 20 }}>
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
							color={ invertColors ? "black" : "white" }
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
							style={[styles.progressBarBackground, { backgroundColor: invertColors ? "black" : "white" }]}
							onLayout={(event) => {
								progressBarWidthRef.current =
									event.nativeEvent.layout.width;
							}}
						>
							<Animated.View
								style={[
									styles.progressBarForeground,
                                    { backgroundColor: invertColors ? "black" : "white" },
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
							color={ invertColors ? "black" : "white" }
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
							color={ invertColors ? "black" : "white" }
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
							color={ invertColors ? "black" : "white" }
						/>
					</HapticPressable>
					<HapticPressable onPress={handleSkipToNext}>
						<MaterialIcons
							name={"skip-next"}
							size={52}
							color={ invertColors ? "black" : "white" }
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
							color={ invertColors ? "black" : "white" }
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
							color={ invertColors ? "black" : "white" }
						/>
					</HapticPressable>
					<HapticPressable
						onPress={() =>
							router.push({ pathname: "/select-device" as any })
						}
					>
						<MaterialIcons
							name={
								(
									playbackState.device.type ?? ""
								).toLowerCase() as any
							}
							size={30}
							color={ invertColors ? "black" : "white" }
						/>
					</HapticPressable>
					<HapticPressable onPress={handleNavigateToAddToPlaylist}>
						<MaterialIcons name="add" size={30} color={ invertColors ? "black" : "white" } />
					</HapticPressable>
				</View>
			</View>
		</ContentContainer>
	);
}

const styles = StyleSheet.create({
	centered: {
		justifyContent: "center",
		alignItems: "center",
	},
	content: {
		flex: 1,
        width: "100%",
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
		width: "90%",
	},
	progressBarBackground: {
		height: 2,
		width: "100%",
		overflow: "visible",
		marginBottom: 3,
	},
	progressBarForeground: {
		height: 6,
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
		overflow: "visible",
	},
	activeShuffleIndicator: {
		height: 1,
		width: "100%",
		overflow: "visible",
	},
	timeText: {
		fontSize: 12,
	},
});
