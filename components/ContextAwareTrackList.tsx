import React from "react";
import {
	FlatList,
	TouchableOpacity,
	Text,
	View,
	StyleSheet,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";

interface Track {
	uri: string;
	name: string;
	artist: { name: string };
	duration_ms: number;
	track?: Track; // For saved tracks format
}

interface ContextAwareTrackListProps {
	tracks: Track[];
	contextType: "album" | "playlist" | "liked" | "artist";
	contextUri?: string;
	title?: string;
}

const ContextAwareTrackList: React.FC<ContextAwareTrackListProps> = ({
	tracks,
	contextType,
	contextUri,
	title,
}) => {
	const { playTrackWithContext, savedTracks, albums } = useAuth();

	const handleTrackPress = async (track: Track, index: number) => {
		// Extract the actual track URI (handle saved tracks format)
		const trackUri = track.track?.uri || track.uri;

		log(
			`Playing track ${index + 1}: ${track.name || track.track?.name}`
		);

		// Get the latest tracks from the context
		let currentTracks: any[] = tracks;
		if (contextType === "liked") {
			currentTracks = savedTracks?.map((t) => t.track) || [];
		} else if (contextType === "album") {
			const album = albums?.find((a) => a.album.uri === contextUri);
			currentTracks = album?.album.tracks?.items || [];
		} else if (contextType === "playlist") {
			// TODO: Fetch playlist tracks and pass them here
			currentTracks = [];
		}

		try {
			await playTrackWithContext(trackUri, {
				type: contextType,
				uri: contextUri,
				tracks: currentTracks,
				currentIndex: index,
			});
		} catch (error) {
			logError("Error playing track with context:", error);
		}
	};

	const formatDuration = (ms: number): string => {
		const minutes = Math.floor(ms / 60000);
		const seconds = Math.floor((ms % 60000) / 1000);
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	};

	const renderTrack = ({ item, index }: { item: Track; index: number }) => {
		// Handle both regular tracks and saved tracks format
		const track = item.track || item;

		return (
			<TouchableOpacity
				style={styles.trackItem}
				onPress={() => handleTrackPress(item, index)}
			>
				<View style={styles.trackInfo}>
					<Text style={styles.trackName} numberOfLines={1}>
						{track.name}
					</Text>
					<Text style={styles.artistName} numberOfLines={1}>
						{track.artist?.name || "Unknown Artist"}
					</Text>
				</View>
				<Text style={styles.duration}>
					{formatDuration(track.duration_ms)}
				</Text>
			</TouchableOpacity>
		);
	};

	return (
		<View style={styles.container}>
			{title && (
				<View style={styles.header}>
					<Text style={styles.title}>{title}</Text>
					<Text style={styles.subtitle}>
						{tracks.length} track{tracks.length !== 1 ? "s" : ""} •{" "}
						{contextType}
					</Text>
				</View>
			)}
			<FlatList
				data={tracks}
				renderItem={renderTrack}
				keyExtractor={(item, index) =>
					`${item.track?.uri || item.uri}-${index}`
				}
				showsVerticalScrollIndicator={false}
				contentContainerStyle={styles.listContent}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	header: {
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#333",
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#fff",
		marginBottom: 4,
	},
	subtitle: {
		fontSize: 14,
		color: "#aaa",
		textTransform: "capitalize",
	},
	listContent: {
		paddingBottom: 20,
	},
	trackItem: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 0.5,
		borderBottomColor: "#222",
	},
	trackInfo: {
		flex: 1,
		marginRight: 12,
	},
	trackName: {
		fontSize: 16,
		color: "#fff",
		fontWeight: "500",
		marginBottom: 2,
	},
	artistName: {
		fontSize: 14,
		color: "#aaa",
	},
	duration: {
		fontSize: 14,
		color: "#666",
		minWidth: 40,
		textAlign: "right",
	},
});

export default ContextAwareTrackList;

// Example usage in different screens:

/*
// Album Screen
<ContextAwareTrackList
	tracks={album.tracks.items}
	contextType="album"
	contextUri={album.uri}
	title={album.name}
/>

// Playlist Screen
<ContextAwareTrackList
	tracks={playlist.tracks.items}
	contextType="playlist"
	contextUri={playlist.uri}
	title={playlist.name}
/>

// Liked Songs Screen
<ContextAwareTrackList
	tracks={savedTracks}
	contextType="liked"
	title="Liked Songs"
/>

// Artist Top Tracks
<ContextAwareTrackList
	tracks={artistTopTracks}
	contextType="artist"
	contextUri={artist.uri}
	title={`${artist.name} - Top Tracks`}
/>
*/
import { log, logError } from "../utils/logger";
