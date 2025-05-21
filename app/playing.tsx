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

const formatTime = (ms: number | null | undefined): string => {
    if (ms === null || ms === undefined) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

export default function PlayingScreen() {
    const {
        accessToken, // Add accessToken
        getPlaybackState,
        startPlayback,
        pausePlayback,
        skipToNext,
        skipToPrevious,
        toggleShuffle,
        toggleRepeat,
    } = useAuth();
    const [playbackState, setPlaybackState] =
        useState<SpotifyCurrentlyPlaying | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCurrentTrackSaved, setIsCurrentTrackSaved] = useState(false); // New state
    const [currentTrackIdChecked, setCurrentTrackIdChecked] = useState<
        string | null
    >(null); // Keep track of the last checked track ID

    const progress = useRef(new Animated.Value(0)).current;

    // Function to check if the current track is saved
    const checkIfTrackIsSaved = async (trackId: string) => {
        if (!accessToken || !trackId) return;
        console.log(`Checking if track ${trackId} is saved.`);
        try {
            const response = await fetch(
                `https://api.spotify.com/v1/me/tracks/contains?ids=${trackId}`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );
            if (!response.ok) {
                // Don't throw an error that stops other UI updates, just log it
                console.error(
                    "Failed to check if track is saved",
                    await response.json()
                );
                setIsCurrentTrackSaved(false); // Assume not saved if check fails
                return;
            }
            const data: boolean[] = await response.json();
            if (data && data.length > 0) {
                setIsCurrentTrackSaved(data[0]);
            }
        } catch (error) {
            console.error("Error checking if track is saved:", error);
            setIsCurrentTrackSaved(false); // Assume not saved on error
        }
    };

    const fetchAndUpdatePlaybackState = async () => {
        console.log("Fetching playback state for PlayingScreen...");
        const state = await getPlaybackState();
        setPlaybackState(state);

        if (state && state.item && state.item.id) {
            // If the track has changed since the last check, or if no track was previously checked
            if (state.item.id !== currentTrackIdChecked) {
                await checkIfTrackIsSaved(state.item.id);
                setCurrentTrackIdChecked(state.item.id);
            }
            if (state.progress_ms !== null) {
                const progressRatio =
                    state.progress_ms / state.item.duration_ms;
                progress.setValue(progressRatio > 0 ? progressRatio : 0);
            } else {
                progress.setValue(0);
            }
        } else {
            progress.setValue(0);
            setIsCurrentTrackSaved(false); // No track playing, so not saved
            setCurrentTrackIdChecked(null); // Reset checked track ID
        }
        setIsLoading(false);
    };

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
            // Toggle between 'off' and 'track' states
            const newState =
                playbackState.repeat_state === "track" ? "off" : "track";
            await toggleRepeat(newState);
            // Fetch updated state immediately after the action
            await fetchAndUpdatePlaybackState();
        } catch (error) {
            console.error("Error toggling repeat:", error);
        }
    };

    // Add these functions to handle saving/removing tracks
    const handleToggleSaveTrack = async () => {
        if (
            !playbackState ||
            !playbackState.item ||
            !playbackState.item.id ||
            !accessToken
        )
            return;

        const trackId = playbackState.item.id;
        const currentlySaved = isCurrentTrackSaved;
        const method = currentlySaved ? "DELETE" : "PUT";
        const url = `https://api.spotify.com/v1/me/tracks?ids=${trackId}`;

        try {
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
            } else {
                const errorData = await response.json();
                console.error(
                    `Failed to ${currentlySaved ? "unsave" : "save"} track:`,
                    errorData
                );
            }
        } catch (error) {
            console.error(
                `Error ${currentlySaved ? "unsaving" : "saving"} track:`,
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
            setCurrentTrackIdChecked(null); // Reset on focus to ensure check runs
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
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#1DB954" />
            </View>
        );
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
                            color="#535353"
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
                    <View style={styles.progressBarBackground}>
                        <Animated.View
                            style={[
                                styles.progressBarForeground,
                                { width: animatedWidth },
                            ]}
                        />
                    </View>
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
                            name={"repeat"}
                            size={30}
                            color={"white"}
                        />
                        <View
                            style={[
                                styles.shuffleIndicator,
                                playbackState?.repeat_state === "track" &&
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
    progressBarBackground: {
        height: 2,
        width: "90%",
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
