import SpotifySdk from "../modules/spotify-sdk";
import { SPOTIFY_CLIENT_ID, REDIRECT_URI } from "../constants/spotify";
import type {
	SpotifyCurrentlyPlaying,
	SpotifySearchResults,
	SpotifyImage,
} from "../types/spotify";
import { loadCachedAlbumArt, saveCachedAlbumArt } from "../utils/cache";

export const ensureAppRemoteConnection = async (): Promise<boolean> => {
	try {
		const connected = await SpotifySdk.isConnected();
		if (connected) {
			return true;
		}

		const connectionResult = await SpotifySdk.connect(
			SPOTIFY_CLIENT_ID,
			REDIRECT_URI
		);

		if (connectionResult.connected) {
			await new Promise((resolve) => setTimeout(resolve, 250));
			return true;
		} else {
			console.log("Playback: Failed to connect to App Remote");
			return false;
		}
	} catch (error) {
		console.log("Playback: Error connecting to App Remote:", error);
		return false;
	}
};

export const forceAppRemoteConnection = async (): Promise<boolean> => {
	console.log("Playback: Attempting force connection...");

	try {
		await SpotifySdk.disconnect();
	} catch (error) {
		// Ignore disconnect errors
	}

	for (let i = 0; i < 3; i++) {
		try {
			const connectionResult = await SpotifySdk.connect(
				SPOTIFY_CLIENT_ID,
				REDIRECT_URI
			);

			if (connectionResult.connected) {
				return true;
			}
		} catch (error) {
			console.log(`Playback: Connection attempt ${i + 1} failed`);
		}

		if (i < 2) {
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}

	console.log("Playback: Force connection failed");
	return false;
};

export const playTrackWithNativeSdk = async (
	trackUri: string,
	deviceId?: string,
	contextUri?: string,
	accessToken?: string | null
): Promise<void> => {
	console.log(`Playback: Playing track: ${trackUri.split(":").pop()}`);

	try {
		let connected = await ensureAppRemoteConnection();

		if (!connected) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			connected = await ensureAppRemoteConnection();
		}

		if (!connected) {
			connected = await forceAppRemoteConnection();
			if (connected) {
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
		}

		if (!connected) {
			console.error("Playback: Cannot play - not connected to Spotify");
			return;
		}

		if (contextUri && accessToken) {
			try {
				const response = await fetch(
					"https://api.spotify.com/v1/me/player/play",
					{
						method: "PUT",
						headers: {
							Authorization: `Bearer ${accessToken}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							context_uri: contextUri,
							offset: { uri: trackUri },
						}),
					}
				);

				if (response.ok) {
					await new Promise((resolve) => setTimeout(resolve, 500));
					const playResult = await SpotifySdk.play();
					if (playResult.playing) {
						console.log("Playback: Playback started with context");
					}
					return;
				} else {
					throw new Error("Web API context failed");
				}
			} catch (webApiError: any) {
				console.log(
					"Playback: Web API error, using fallback method:",
					webApiError.message
				);
				const playResult = await SpotifySdk.play(trackUri);
				if (playResult.playing) {
					console.log("Playback: Direct track playback started");
				}
			}
		} else {
			const playResult = await SpotifySdk.play(trackUri);
			if (playResult.playing) {
				console.log(
					"Playback: Native SDK direct playback started successfully"
				);
			}
		}
	} catch (error: any) {
		console.error("Playback: Error with playback:", error);
		throw error;
	}
};

export const getPlaybackStateFromNativeSdk = async (
	accessToken?: string | null
): Promise<SpotifyCurrentlyPlaying | null> => {
	try {
		const connected = await ensureAppRemoteConnection();
		if (!connected) {
			console.log(
				"Playback: Cannot get playback state - App Remote not connected"
			);
			return null;
		}

		const playerState = await SpotifySdk.getPlayerState();
		if (!playerState || !playerState.track) {
			console.log("Playback: No player state or track available");
			return null;
		}

		// Get album art with cache-first strategy
		let albumImages: SpotifyImage[] = [];
		const albumId = playerState.track.album.uri.split(":").pop();

		if (albumId) {
			// 1. Try cache first (instant offline display)
			const cachedImages = await loadCachedAlbumArt(albumId);
			if (cachedImages) {
				albumImages = cachedImages;
			} else {
				// 2. Try native SDK (high-quality bitmap)
				try {
					const nativeImageUrl = await SpotifySdk.getImage(
						playerState.track.album.uri,
						"LARGE"
					);
					if (
						nativeImageUrl &&
						nativeImageUrl.startsWith("data:image/")
					) {
						albumImages = [
							{
								url: nativeImageUrl,
								height: 640,
								width: 640,
							},
						];
						await saveCachedAlbumArt(albumId, albumImages);
						console.log("Playback: Got album art from Native SDK");
					} else {
						throw new Error(
							"Native SDK did not return valid image data"
						);
					}
				} catch (nativeError) {
					// 3. Fallback to Web API (HTTP URLs)
					if (accessToken) {
						try {
							const response = await fetch(
								`https://api.spotify.com/v1/albums/${albumId}`,
								{
									headers: {
										Authorization: `Bearer ${accessToken}`,
									},
								}
							);
							if (response.ok) {
								const albumData = await response.json();
								if (
									albumData.images &&
									albumData.images.length > 0
								) {
									albumImages = albumData.images.map(
										(img: any) => ({
											url: img.url,
											height: img.height,
											width: img.width,
										})
									);
									await saveCachedAlbumArt(
										albumId,
										albumImages
									);
									console.log(
										"Playback: Got album art from Web API fallback"
									);
								}
							}
						} catch (webApiError) {
							console.log(
								"Playback: Both native SDK and Web API failed for album art"
							);
						}
					}
				}
			}
		}

		// Convert native SDK player state to Web API format
		return {
			timestamp: Date.now(),
			context: null,
			progress_ms: playerState.playbackPosition,
			is_playing: !playerState.isPaused,
			item: {
				artists: [
					{
						external_urls: { spotify: "" },
						href: "",
						id: playerState.track.artist.uri.split(":").pop() || "",
						name: playerState.track.artist.name,
						type: "artist",
						uri: playerState.track.artist.uri,
					},
				],
				available_markets: [],
				disc_number: 1,
				duration_ms: playerState.track.duration,
				explicit: false,
				external_urls: { spotify: "" },
				href: "",
				id: playerState.track.uri.split(":").pop() || "",
				is_local: false,
				name: playerState.track.name,
				preview_url: null,
				track_number: 1,
				type: "track",
				uri: playerState.track.uri,
				album: {
					album_type: "album",
					total_tracks: 1,
					available_markets: [],
					external_urls: { spotify: "" },
					href: "",
					id: albumId || "",
					images: albumImages,
					name: playerState.track.album.name,
					release_date: "",
					release_date_precision: "day",
					type: "album",
					uri: playerState.track.album.uri,
					artists: [
						{
							external_urls: { spotify: "" },
							href: "",
							id:
								playerState.track.artist.uri.split(":").pop() ||
								"",
							name: playerState.track.artist.name,
							type: "artist",
							uri: playerState.track.artist.uri,
						},
					],
				},
			},
			currently_playing_type: "track",
			actions: { disallows: {} },
			device: {
				id: "spotify_app_remote",
				is_active: true,
				is_private_session: false,
				is_restricted: false,
				name: "Spotify App Remote",
				type: "smartphone",
				volume_percent: 100,
				supports_volume: false,
				uri: "spotify:device:app_remote",
			},
			shuffle_state: playerState.playbackOptions.isShuffling,
			repeat_state:
				playerState.playbackOptions.repeatMode === 0
					? "off"
					: playerState.playbackOptions.repeatMode === 1
					? "track"
					: "context",
		};
	} catch (error) {
		console.log("Playback: Error getting playback state:", error);
		return null;
	}
};

export const startPlayback = async (): Promise<void> => {
	try {
		const connected = await ensureAppRemoteConnection();
		if (!connected) return;
		const result = await SpotifySdk.resume();
		if (result.resumed) console.log("Playback: Playback resumed");
	} catch (error) {
		console.error("Playback: Error starting playback:", error);
	}
};

export const pausePlayback = async (): Promise<void> => {
	try {
		const connected = await ensureAppRemoteConnection();
		if (!connected) return;
		const result = await SpotifySdk.pause();
		if (result.paused) console.log("Playback: Playback paused");
	} catch (error) {
		console.error("Playback: Error pausing playback:", error);
	}
};

export const skipToNext = async (): Promise<void> => {
	try {
		const connected = await ensureAppRemoteConnection();
		if (!connected) return;
		const result = await SpotifySdk.skipNext();
		if (result.skipped) console.log("Playback: Skipped to next track");
	} catch (error) {
		console.error("Playback: Error skipping to next track:", error);
	}
};

export const skipToPrevious = async (): Promise<void> => {
	try {
		const connected = await ensureAppRemoteConnection();
		if (!connected) return;
		const result = await SpotifySdk.skipPrevious();
		if (result.skipped) console.log("Playback: Skipped to previous track");
	} catch (error) {
		console.error("Playback: Error skipping to previous track:", error);
	}
};

export const toggleShuffle = async (state: boolean): Promise<void> => {
	try {
		const connected = await ensureAppRemoteConnection();
		if (!connected) return;
		const result = await SpotifySdk.setShuffle(state);
		if (result.shuffleSet) console.log(`Playback: Shuffle set to ${state}`);
	} catch (error) {
		console.error("Playback: Error toggling shuffle:", error);
	}
};

export const toggleRepeat = async (
	state: "off" | "context" | "track"
): Promise<void> => {
	try {
		const connected = await ensureAppRemoteConnection();
		if (!connected) return;
		// Map Web API states to Android SDK repeat modes
		// OFF = 0, ONE = 1 (track), ALL = 2 (context)
		const repeatMode = state === "off" ? 0 : state === "track" ? 1 : 2;
		const result = await SpotifySdk.setRepeat(repeatMode);
		if (result.repeatSet) console.log(`Playback: Repeat set to ${state}`);
	} catch (error) {
		console.error("Playback: Error toggling repeat:", error);
	}
};

export const seekToPosition = async (positionMs: number): Promise<void> => {
	try {
		const connected = await ensureAppRemoteConnection();
		if (!connected) return;
		const result = await SpotifySdk.seekTo(positionMs);
		if (result.seeked) console.log("Playback: Seek completed");
	} catch (error) {
		console.error("Playback: Error seeking:", error);
	}
};

export const getCurrentTrack = async (): Promise<any | null> => {
	try {
		const connected = await ensureAppRemoteConnection();
		if (!connected) return null;
		const playerState = await SpotifySdk.getPlayerState();
		if (!playerState || !playerState.track) return null;
		return {
			...playerState.track,
			albumArt: playerState.track.imageUri,
			position: playerState.playbackPosition,
			isPaused: playerState.isPaused,
			isShuffling: playerState.playbackOptions.isShuffling,
			repeatMode: playerState.playbackOptions.repeatMode,
		};
	} catch (error) {
		console.log("Playback: Error getting current track:", error);
		return null;
	}
};

export const getAlbumArt = async (
	uri?: string,
	size: string = "LARGE"
): Promise<string | null> => {
	try {
		const connected = await ensureAppRemoteConnection();
		if (!connected) return null;
		if (!uri) {
			const playerState = await SpotifySdk.getPlayerState();
			if (!playerState || !playerState.track) return null;
			uri = playerState.track.album.uri;
		}
		const imageUrl = await SpotifySdk.getImage(uri, size);
		return imageUrl;
	} catch (error) {
		console.log("Playback: Error getting album art:", error);
		return null;
	}
};

export const searchItems = async (
	query: string,
	types: string[],
	accessToken: string | null
): Promise<SpotifySearchResults | null> => {
	if (!accessToken || !query.trim()) return null;
	const typeString = types.join(",");
	const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(
		query
	)}&type=${encodeURIComponent(typeString)}&limit=10`;

	try {
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		if (!response.ok) return null;
		return await response.json();
	} catch (error) {
		console.error("Playback: Search error:", error);
		return null;
	}
};

export const addTrackToPlaylist = async (
	playlistId: string,
	trackUri: string,
	accessToken: string | null
): Promise<boolean> => {
	if (!accessToken || !playlistId || !trackUri) return false;

	try {
		const response = await fetch(
			`https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ uris: [trackUri] }),
			}
		);
		return response.ok;
	} catch (error) {
		console.error("Playback: Error adding track to playlist:", error);
		return false;
	}
};

export const playTrackWithContext = async (
	trackUri: string,
	accessToken: string | null,
	sourceContext?: {
		type: "album" | "playlist" | "liked" | "artist";
		uri?: string;
		tracks?: any[];
		currentIndex?: number;
	}
): Promise<void> => {
	console.log(
		"Playback: Playing track with context:",
		sourceContext?.type || "none"
	);

	try {
		// Ensure we have App Remote connection
		const connected = await ensureAppRemoteConnection();
		if (!connected) {
			console.log("Playback: Cannot play - App Remote not connected");
			return;
		}

		// UNIFIED HYBRID APPROACH: Web API for context + Native SDK for control
		if (
			sourceContext?.uri &&
			accessToken &&
			sourceContext.type !== "artist"
		) {
			try {
				console.log("Playback: Setting context via Web API");

				// Web API to set context + track offset
				const response = await fetch(
					"https://api.spotify.com/v1/me/player/play",
					{
						method: "PUT",
						headers: {
							Authorization: `Bearer ${accessToken}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							context_uri: sourceContext.uri,
							offset: { uri: trackUri }, // Start from specific track
						}),
					}
				);

				if (response.ok) {
					console.log("Playback: Context set, starting playback");
					await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for context
					await SpotifySdk.play(); // Native SDK control
					console.log("Playback: Started with context");
					return;
				} else {
					console.log(
						"Playback: Web API context failed with status:",
						response.status
					);
				}
			} catch (webApiError) {
				console.log(
					"Playback: Web API context failed, falling back to direct play:",
					webApiError
				);
			}
		}

		// Fallback: Direct track play (no context)
		console.log("Playback: Direct track play (no context)");
		await SpotifySdk.play(trackUri);
		console.log("Playback: Direct playback started");
	} catch (error) {
		console.error("Playback: Error in playTrackWithContext:", error);
		throw error;
	}
};
