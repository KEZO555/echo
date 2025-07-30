import SpotifySdk from "../modules/spotify-sdk";
import { SPOTIFY_CLIENT_ID, REDIRECT_URI } from "../constants/spotify";
import type {
    SpotifyCurrentlyPlaying,
    SpotifySearchResults,
    SpotifyImage,
} from "../types/spotify";
import { loadCachedAlbumArt, saveCachedAlbumArt } from "../utils/cache";
import { log, logError } from "../utils/logger";

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
            log("Playback: Failed to connect to App Remote");
            return false;
        }
    } catch (error) {
        log("Playback: Error connecting to App Remote:", error);
        return false;
    }
};

export const forceAppRemoteConnection = async (): Promise<boolean> => {
    log("Playback: Attempting force connection...");

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
            log(`Playback: Connection attempt ${i + 1} failed`);
        }

        if (i < 2) {
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }

    log("Playback: Force connection failed");
    return false;
};

export const playTrackWithNativeSdk = async (
    trackUri: string,
    _deviceId?: string,
    contextUri?: string,
    accessToken?: string | null,
    ensureValidToken?: () => Promise<string | null>
): Promise<void> => {
    log(`Playback: Playing track: ${trackUri.split(":").pop()}`);

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
            logError("Playback: Cannot play - not connected to Spotify");
            return;
        }

        if (contextUri && accessToken) {
            try {
                // Use token validation if available, otherwise use the provided token
                let validToken = accessToken;
                if (ensureValidToken) {
                    const refreshedToken = await ensureValidToken();
                    if (refreshedToken) {
                        validToken = refreshedToken;
                    }
                }

                // Use centralized API request with token refresh handling
                const response = await fetch(
                    "https://api.spotify.com/v1/me/player/play",
                    {
                        method: "PUT",
                        headers: {
                            Authorization: `Bearer ${validToken}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            context_uri: contextUri,
                            offset: { uri: trackUri },
                        }),
                    }
                );

                if (response.ok) {
                    log(
                        "Playback: Web API successfully set context and initiated playback."
                    );
                    return;
                } else if (response.status === 401) {
                    log(
                        "Playback: Token expired, falling back to direct play"
                    );
                    throw new Error("Token expired - using fallback");
                } else {
                    throw new Error("Web API context failed");
                }
            } catch (webApiError: any) {
                log(
                    "Playback: Web API error, using fallback method:",
                    webApiError.message
                );
                const playResult = await SpotifySdk.play(trackUri);
                if (playResult.playing) {
                    log("Playback: Direct track playback started");
                }
            }
        } else {
            const playResult = await SpotifySdk.play(trackUri);
            if (playResult.playing) {
                log(
                    "Playback: Native SDK direct playback started successfully"
                );
            }
        }
    } catch (error: any) {
        logError("Playback: Error with playback:", error);
        throw error;
    }
};

export const getPlaybackStateFromNativeSdk = async (
    accessToken?: string | null,
    ensureValidToken?: () => Promise<string | null>,
    makeApiRequest?: (url: string, errorMessage: string) => Promise<any | null>
): Promise<SpotifyCurrentlyPlaying | null> => {
    try {
        const connected = await ensureAppRemoteConnection();
        if (!connected) {
            log(
                "Playback: Cannot get playback state - App Remote not connected"
            );
            return null;
        }

        const playerState = await SpotifySdk.getPlayerState();
        if (!playerState || !playerState.track) {
            log("Playback: No player state or track available");
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
                // 2. Try native SDK current track image (most direct approach)
                try {
                    log(
                        "Playback: Attempting to get current track image from Native SDK"
                    );
                    const nativeImageUrl =
                        await SpotifySdk.getCurrentTrackImage("LARGE");
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
                        log(
                            "Playback: Got album art from Native SDK (current track)"
                        );
                    } else {
                        throw new Error(
                            "Native SDK getCurrentTrackImage did not return valid image data"
                        );
                    }
                } catch (currentTrackError) {
                    log(
                        "Playback: getCurrentTrackImage failed, trying album URI approach:",
                        currentTrackError
                    );

                    // 3. Try native SDK with album URI (fallback approach)
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
                            log(
                                "Playback: Got album art from Native SDK (album URI)"
                            );
                        } else {
                            throw new Error(
                                "Native SDK getImage did not return valid image data"
                            );
                        }
                    } catch (albumUriError) {
                        log(
                            "Playback: Album URI approach failed, trying track image URI:",
                            albumUriError
                        );

                        // 4. Try native SDK with track image URI (if available)
                        try {
                            if (playerState.track.imageUri) {
                                const nativeImageUrl =
                                    await SpotifySdk.getImage(
                                        playerState.track.imageUri,
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
                                    await saveCachedAlbumArt(
                                        albumId,
                                        albumImages
                                    );
                                    log(
                                        "Playback: Got album art from Native SDK (track image URI)"
                                    );
                                } else {
                                    throw new Error(
                                        "Native SDK track image URI did not return valid image data"
                                    );
                                }
                            } else {
                                throw new Error("No track image URI available");
                            }
                        } catch (trackImageError) {
                            log(
                                "Playback: All Native SDK approaches failed, falling back to Web API:",
                                trackImageError
                            );

                            // 5. Fallback to Web API (HTTP URLs)
                            let validToken = accessToken;
                            if (ensureValidToken) {
                                const refreshedToken = await ensureValidToken();
                                if (refreshedToken) {
                                    validToken = refreshedToken;
                                }
                            }

                            if (validToken && makeApiRequest) {
                                try {
                                    const albumData = await makeApiRequest(
                                        `https://api.spotify.com/v1/albums/${albumId}`,
                                        "Album art fetch"
                                    );
                                    if (
                                        albumData &&
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
                                        log(
                                            "Playback: Got album art from Web API fallback"
                                        );
                                    }
                                } catch (webApiError) {
                                    log(
                                        "Playback: Web API failed for album art:",
                                        webApiError
                                    );
                                }
                            } else if (validToken) {
                                // Fallback to direct fetch if makeApiRequest is not available
                                try {
                                    const response = await fetch(
                                        `https://api.spotify.com/v1/albums/${albumId}`,
                                        {
                                            headers: {
                                                Authorization: `Bearer ${validToken}`,
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
                                            log(
                                                "Playback: Got album art from Web API fallback (direct fetch)"
                                            );
                                        }
                                    } else if (response.status === 401) {
                                        log(
                                            "Playback: Token expired while fetching album art"
                                        );
                                    }
                                } catch (webApiError) {
                                    log(
                                        "Playback: All approaches failed for album art"
                                    );
                                }
                            }
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
        log("Playback: Error getting playback state:", error);
        return null;
    }
};

export const startPlayback = async (): Promise<void> => {
    try {
        const connected = await ensureAppRemoteConnection();
        if (!connected) return;
        const result = await SpotifySdk.resume();
        if (result.resumed) log("Playback: Playback resumed");
    } catch (error) {
        logError("Playback: Error starting playback:", error);
    }
};

export const pausePlayback = async (): Promise<void> => {
    try {
        const connected = await ensureAppRemoteConnection();
        if (!connected) return;
        const result = await SpotifySdk.pause();
        if (result.paused) log("Playback: Playback paused");
    } catch (error) {
        logError("Playback: Error pausing playback:", error);
    }
};

export const skipToNext = async (): Promise<void> => {
    try {
        const connected = await ensureAppRemoteConnection();
        if (!connected) return;
        const result = await SpotifySdk.skipNext();
        if (result.skipped) log("Playback: Skipped to next track");
    } catch (error) {
        logError("Playback: Error skipping to next track:", error);
    }
};

export const skipToPrevious = async (): Promise<void> => {
    try {
        const connected = await ensureAppRemoteConnection();
        if (!connected) return;
        const result = await SpotifySdk.skipPrevious();
        if (result.skipped) log("Playback: Skipped to previous track");
    } catch (error) {
        logError("Playback: Error skipping to previous track:", error);
    }
};

export const toggleShuffle = async (state: boolean): Promise<void> => {
    try {
        const connected = await ensureAppRemoteConnection();
        if (!connected) return;
        const result = await SpotifySdk.setShuffle(state);
        if (result.shuffleSet) log(`Playback: Shuffle set to ${state}`);
    } catch (error) {
        logError("Playback: Error toggling shuffle:", error);
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
        if (result.repeatSet) log(`Playback: Repeat set to ${state}`);
    } catch (error) {
        logError("Playback: Error toggling repeat:", error);
    }
};

export const seekToPosition = async (positionMs: number): Promise<void> => {
    try {
        const connected = await ensureAppRemoteConnection();
        if (!connected) return;
        const result = await SpotifySdk.seekTo(positionMs);
        if (result.seeked) log("Playback: Seek completed");
    } catch (error) {
        logError("Playback: Error seeking:", error);
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
        log("Playback: Error getting current track:", error);
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

        // If no URI provided, get current track image directly
        if (!uri) {
            try {
                log(
                    "Playback: Getting current track image from Native SDK"
                );
                const imageUrl = await SpotifySdk.getCurrentTrackImage(size);
                if (imageUrl && imageUrl.startsWith("data:image/")) {
                    log(
                        "Playback: Successfully got current track image from Native SDK"
                    );
                    return imageUrl;
                }
            } catch (error) {
                log(
                    "Playback: getCurrentTrackImage failed, trying player state approach:",
                    error
                );
            }

            // Fallback: get player state and use album URI
            try {
                const playerState = await SpotifySdk.getPlayerState();
                if (!playerState || !playerState.track) return null;
                uri = playerState.track.album.uri;
            } catch (error) {
                log(
                    "Playback: Failed to get player state for album art:",
                    error
                );
                return null;
            }
        }

        // Try to get image with provided or derived URI
        if (uri) {
            log("Playback: Getting image for URI:", uri);
            const imageUrl = await SpotifySdk.getImage(uri, size);
            if (imageUrl && imageUrl.startsWith("data:image/")) {
                log("Playback: Successfully got image from Native SDK");
                return imageUrl;
            }
        }

        return null;
    } catch (error) {
        log("Playback: Error getting album art:", error);
        return null;
    }
};

export const searchItems = async (
    query: string,
    types: string[],
    accessToken: string | null,
    ensureValidToken?: () => Promise<string | null>
): Promise<SpotifySearchResults | null> => {
    if (!query.trim()) return null;

    // Use token validation if available, otherwise use the provided token
    let validToken = accessToken;
    if (ensureValidToken) {
        const refreshedToken = await ensureValidToken();
        if (refreshedToken) {
            validToken = refreshedToken;
        }
    }

    if (!validToken) return null;

    const typeString = types.join(",");
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        query
    )}&type=${encodeURIComponent(typeString)}&limit=10`;

    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${validToken}` },
        });
        if (!response.ok) {
            if (response.status === 401) {
                log("Search: Token expired");
            }
            return null;
        }
        return await response.json();
    } catch (error) {
        logError("Playback: Search error:", error);
        return null;
    }
};

export const addTrackToPlaylist = async (
    playlistId: string,
    trackUri: string,
    accessToken: string | null,
    ensureValidToken?: () => Promise<string | null>
): Promise<boolean> => {
    if (!playlistId || !trackUri) return false;

    // Use token validation if available, otherwise use the provided token
    let validToken = accessToken;
    if (ensureValidToken) {
        const refreshedToken = await ensureValidToken();
        if (refreshedToken) {
            validToken = refreshedToken;
        }
    }

    if (!validToken) return false;

    try {
        const response = await fetch(
            `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${validToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ uris: [trackUri] }),
            }
        );
        if (!response.ok && response.status === 401) {
            log("AddTrackToPlaylist: Token expired");
        }
        return response.ok;
    } catch (error) {
        logError("Playback: Error adding track to playlist:", error);
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
    },
    ensureValidToken?: () => Promise<string | null>
): Promise<void> => {
    log(
        "Playback: Playing track with context:",
        sourceContext?.type || "none"
    );

    try {
        // Ensure we have App Remote connection
        const connected = await ensureAppRemoteConnection();
        if (!connected) {
            log("Playback: Cannot play - App Remote not connected");
            return;
        }

        // UNIFIED HYBRID APPROACH: Web API for context + Native SDK for control
        if (
            sourceContext?.uri &&
            sourceContext.type !== "artist"
        ) {
            try {
                log("Playback: Setting context via Web API");

                // Always validate token before attempting playback to ensure context works
                let validToken = accessToken;
                if (ensureValidToken) {
                    log("Playback: Validating token before context playback...");
                    const refreshedToken = await ensureValidToken();
                    if (refreshedToken) {
                        validToken = refreshedToken;
                        log("Playback: Using validated/refreshed token");
                    } else {
                        log("Playback: Token validation failed, cannot set context");
                        throw new Error("Token validation failed");
                    }
                }

                if (!validToken) {
                    log("Playback: No valid token available, falling back to direct play");
                    throw new Error("No valid token");
                }

                log("Playback: Making Web API call with context:", {
                    contextUri: sourceContext.uri,
                    trackUri: trackUri,
                    tokenLength: validToken.length
                });

                // First, try to get available devices to target the call properly
                let deviceId: string | undefined;
                try {
                    const devicesResponse = await fetch(
                        "https://api.spotify.com/v1/me/player/devices",
                        {
                            headers: {
                                Authorization: `Bearer ${validToken}`,
                            },
                        }
                    );

                    if (devicesResponse.ok) {
                        const devicesData = await devicesResponse.json();
                        log("Playback: Available devices:", devicesData.devices?.length || 0);

                        // Find an active device or use the first available one
                        const activeDevice = devicesData.devices?.find((d: any) => d.is_active);
                        const availableDevice = devicesData.devices?.[0];
                        deviceId = activeDevice?.id || availableDevice?.id;

                        if (deviceId) {
                            log("Playback: Using device:", {
                                id: deviceId,
                                name: activeDevice?.name || availableDevice?.name,
                                isActive: !!activeDevice
                            });
                        } else {
                            log("Playback: No devices found, trying without device_id");
                        }
                    } else {
                        log("Playback: Failed to get devices, proceeding without device_id");
                    }
                } catch (deviceError) {
                    log("Playback: Device detection failed, proceeding without device_id:", deviceError);
                }

                // Prepare the playback request body
                const playbackBody: any = {
                    context_uri: sourceContext.uri,
                    offset: { uri: trackUri }, // Start from specific track
                };

                // Add device_id if we found one
                if (deviceId) {
                    // We'll add device_id as a query parameter instead of in the body
                }

                // Web API to set context + track offset
                const playUrl = deviceId
                    ? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`
                    : "https://api.spotify.com/v1/me/player/play";

                const response = await fetch(playUrl, {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${validToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(playbackBody),
                });

                log("Playback: Web API response status:", response.status);

                if (response.ok) {
                    log("Playback: Context set successfully, starting playback");
                    await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for context
                    await SpotifySdk.play(); // Native SDK control
                    log("Playback: Started with context");
                    return;
                } else if (response.status === 401) {
                    const errorText = await response.text();
                    log("Playback: Token expired during context call:", errorText);
                    throw new Error("Token expired - using fallback");
                } else if (response.status === 404) {
                    const errorText = await response.text();
                    log("Playback: Device not found (404):", errorText);
                    throw new Error("Device not found - using fallback");
                } else {
                    const errorText = await response.text();
                    log("Playback: Web API context failed:", {
                        status: response.status,
                        statusText: response.statusText,
                        error: errorText
                    });
                    throw new Error(`HTTP ${response.status} - using fallback`);
                }
            } catch (webApiError: any) {
                log(
                    "Playback: Web API context failed, falling back to direct play:",
                    webApiError.message
                );
            }
        }

        // Fallback: Direct track play (no context)
        log("Playback: Direct track play (no context)");
        await SpotifySdk.play(trackUri);
        log("Playback: Direct playback started");
    } catch (error) {
        logError("Playback: Error in playTrackWithContext:", error);
        throw error;
    }
};

export const skipToIndex = async (
    sourceContext: {
        type: "album" | "playlist" | "liked" | "artist";
        uri?: string;
        tracks?: any[];
        currentIndex?: number;
    }
): Promise<void> => {
    log(
        "Playback: Playing track with context via SkipToIndex:",
        sourceContext?.type || "none"
    );
    {
        const connected = await ensureAppRemoteConnection(); if (!connected) {
            log("Playback: Cannot play - App Remote not connected");
            return;
        }

        if (
            sourceContext?.uri &&
            sourceContext.currentIndex !== undefined &&
            sourceContext.currentIndex !== null &&
            sourceContext.type !== "artist"
        ) {
            log("Index:", {
                currentIndex: sourceContext.currentIndex,
            });
            log("URI:", {
                uri: sourceContext.uri,
            });
            await SpotifySdk.skipToIndex(sourceContext.uri, sourceContext.currentIndex);
        }
        log("Playback: Skipped to index");
        return;
    }
};
