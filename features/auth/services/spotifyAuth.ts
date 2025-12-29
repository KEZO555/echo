import * as SecureStore from "expo-secure-store";
import SpotifySdk from "@/modules/spotify-sdk";
import {
    AUTH_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    USER_INFO_KEY,
    TOKEN_EXPIRY_KEY,
    SPOTIFY_CLIENT_ID,
    REDIRECT_URI,
    SPOTIFY_SCOPES,
} from "@/constants/spotify";
import { clearCachedData } from "@/features/library/utils/cache";
import { exchangeCodeForTokens } from "@/features/auth/services/tokenExchange";
import { log, logError } from "@/shared/utils/logger";
import type {
    SpotifyPlaylistsResponse,
    SpotifySavedAlbumsResponse,
    SpotifySavedShowsResponse,
    SpotifyFollowedArtistsResponse,
    SavedTracksResponse,
} from "@/shared/types/spotify";

export const loginWithSpotify = async (
    onTokenUpdate: (
        accessToken: string,
        refreshToken?: string,
        expiry?: number
    ) => void,
    onUserUpdate: (user: any) => void,
    fetchInitialData: (token: string) => Promise<void>
): Promise<void> => {
    try {
        log(
            "Auth: Starting authentication with CODE flow via server..."
        );

        // Use CODE flow (server handles PKCE and token exchange)
        const authResult = await SpotifySdk.authorize(
            SPOTIFY_CLIENT_ID,
            REDIRECT_URI,
            SPOTIFY_SCOPES,
            undefined, // state
            false // showDialog
            // No codeChallenge needed - server handles PKCE
        );

        if (authResult.success && authResult.data?.authorizationCode) {
            log(
                "Auth: Authorization code received, exchanging for tokens via server..."
            );

            // Exchange authorization code for access and refresh tokens via server
            const tokenResponse = await exchangeCodeForTokens(
                authResult.data.authorizationCode,
                "", // codeVerifier not needed for server exchange
                REDIRECT_URI // redirectUri not needed for server exchange but kept for compatibility
            );

            if (!tokenResponse.refresh_token) {
                throw new Error("No refresh token received from server");
            }

            // Calculate token expiry (be conservative - use 50 minutes instead of full hour)
            const expiryTime =
                Date.now() + (tokenResponse.expires_in - 600) * 1000; // 10 minutes buffer

            // Store tokens securely in parallel for faster writes
            await Promise.all([
                SecureStore.setItemAsync(AUTH_TOKEN_KEY, tokenResponse.access_token),
                SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokenResponse.refresh_token),
                SecureStore.setItemAsync(TOKEN_EXPIRY_KEY, expiryTime.toString()),
            ]);

            onTokenUpdate(
                tokenResponse.access_token,
                tokenResponse.refresh_token,
                expiryTime
            );

            // Enable auto-connect for proper lifecycle management

            // Immediately establish App Remote connection after authentication
            try {
                log("Auth: Establishing App Remote connection...");
                const connectionResult = await SpotifySdk.connect(
                    SPOTIFY_CLIENT_ID,
                    REDIRECT_URI
                );
                if (connectionResult.connected) {
                    log("Auth: App Remote connected successfully");
                } else {
                    console.warn(
                        "Auth: App Remote connection failed, will retry on first play"
                    );
                }
            } catch (connectionError) {
                console.warn(
                    "Auth: App Remote connection error:",
                    connectionError
                );
            }

            log("Auth: Authentication successful with refresh token");
            // Fetch user info after successful authentication (without triggering data fetch)
            await fetchUserInfo(
                tokenResponse.access_token,
                onUserUpdate,
                () => Promise.resolve(), // Empty function - don't fetch data here
                undefined // ensureValidToken not needed here since we have a fresh token
            );
        } else {
            logError(
                "Auth: Authentication failed:",
                authResult.error || "No authorization code received"
            );
            throw new Error(
                String(authResult.error) ||
                "Authentication failed - no authorization code"
            );
        }
    } catch (error) {
        logError("Auth: Error during authentication:", error);
        throw error;
    }
};

export const logoutFromSpotify = async (
    clearState: () => void
): Promise<void> => {
    log("Logging out...");
    // Disable auto-connect and clear native SDK session
    try {
        await SpotifySdk.disconnect();
        await SpotifySdk.clearSession();
    } catch (error) {
        logError("Error clearing native SDK session:", error);
    }

    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_INFO_KEY);
    await SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY);

    // Clear cached data
    await clearCachedData();

    clearState();
};

export const loadStoredAuth = async () => {
    try {
        // Load tokens from secure storage (CODE flow tokens)
        const storedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
        const storedRefreshToken = await SecureStore.getItemAsync(
            REFRESH_TOKEN_KEY
        );
        const storedUser = await SecureStore.getItemAsync(USER_INFO_KEY);
        const storedExpiry = await SecureStore.getItemAsync(TOKEN_EXPIRY_KEY);

        // If we have stored tokens, enable auto-connect for App Remote
        if (storedToken && storedRefreshToken) {
            log("Auth: Found stored tokens, enabling auto-connect");

            // Immediately establish App Remote connection
            try {
                log(
                    "Auth: Establishing App Remote connection for stored tokens..."
                );
                const connectionResult = await SpotifySdk.connect(
                    SPOTIFY_CLIENT_ID,
                    REDIRECT_URI
                );
                if (connectionResult.connected) {
                    log(
                        "Auth: App Remote connected successfully for stored tokens"
                    );
                }
            } catch (connectionError) {
                console.warn(
                    "Auth: App Remote connection error for stored tokens:",
                    connectionError
                );
            }
        }

        return {
            accessToken: storedToken,
            refreshToken: storedRefreshToken,
            user: storedUser ? JSON.parse(storedUser) : null,
            tokenExpiry: storedExpiry ? parseInt(storedExpiry) : null,
        };
    } catch (error) {
        logError("Auth: Error loading stored auth:", error);
        return {
            accessToken: null,
            refreshToken: null,
            user: null,
            tokenExpiry: null,
        };
    }
};

const fetchUserInfo = async (
    token: string,
    onUserUpdate: (user: any) => void,
    fetchInitialData: (token: string) => Promise<void>,
    ensureValidToken?: () => Promise<string | null>
) => {
    try {
        // Use token validation if available, otherwise use the provided token
        let validToken = token;
        if (ensureValidToken) {
            const refreshedToken = await ensureValidToken();
            if (refreshedToken) {
                validToken = refreshedToken;
            }
        }

        if (!validToken) {
            throw new Error("No valid token available for fetching user info");
        }

        const response = await fetch("https://api.spotify.com/v1/me", {
            headers: { Authorization: `Bearer ${validToken}` },
        });
        const userData = await response.json();
        if (!response.ok) {
            if (response.status === 401) {
                log("Auth: Token expired while fetching user info");
            }
            throw new Error(
                `Failed to fetch user info: ${userData?.error?.message || response.status
                }`
            );
        }
        onUserUpdate(userData);
        await SecureStore.setItemAsync(USER_INFO_KEY, JSON.stringify(userData));
        // Start fetching other data after user info is successfully retrieved
        await fetchInitialData(validToken);
    } catch (error: any) {
        logError("Auth: Error fetching user info:", error.message);
        throw error;
    }
};

export const fetchInitialDataInParallel = async (
    token: string,
    onPlaylistsUpdate: (playlists: any[], nextUrl: string | null) => void,
    onAlbumsUpdate: (albums: any[], nextUrl: string | null) => void,
    onPodcastsUpdate: (podcasts: any[], nextUrl: string | null) => void,
    onArtistsUpdate: (artists: any[], nextUrl: string | null) => void,
    onSavedTracksUpdate: (tracks: any[], nextUrl: string | null) => void,
    saveCachedData: (
        playlists?: any[],
        albums?: any[],
        artists?: any[],
        tracks?: any[],
        podcasts?: any[]
    ) => Promise<void>,
    makeApiRequest: (
        url: string,
        errorMessage: string,
        isRefreshing?: boolean
    ) => Promise<any | null>
) => {
    log("Auth: Loading user data...");

    const fetchPlaylists = async () => {
        try {
            const data: SpotifyPlaylistsResponse | null = await makeApiRequest(
                "https://api.spotify.com/v1/me/playlists?limit=50",
                "Playlists",
                true
            );

            if (data) {
                onPlaylistsUpdate(data.items, data.next);
                await saveCachedData(data.items, undefined, undefined, undefined);
            } else {
                onPlaylistsUpdate([], null);
            }
        } catch (error: any) {
            logError("Auth: Error fetching playlists:", error.message);
            onPlaylistsUpdate([], null);
        }
    };

    const fetchAlbums = async () => {
        try {
            const data: SpotifySavedAlbumsResponse | null = await makeApiRequest(
                "https://api.spotify.com/v1/me/albums?limit=50",
                "Albums",
                true
            );

            if (data) {
                onAlbumsUpdate(data.items, data.next);
                await saveCachedData(undefined, data.items, undefined, undefined, undefined);
            } else {
                onAlbumsUpdate([], null);
            }
        } catch (error: any) {
            logError("Auth: Error fetching albums:", error.message);
            onAlbumsUpdate([], null);
        }
    };

    const fetchPodcasts = async () => {
        try {
            const data: SpotifySavedShowsResponse | null = await makeApiRequest(
                "https://api.spotify.com/v1/me/shows?limit=50",
                "Podcasts",
                true
            );

            if (data) {
                onPodcastsUpdate(data.items, data.next);
                await saveCachedData(undefined, undefined, undefined, undefined, data.items);
            } else {
                onPodcastsUpdate([], null);
            }
        } catch (error: any) {
            logError("Auth: Error fetching podcasts:", error.message);
            onPodcastsUpdate([], null);
        }
    };

    const fetchArtists = async () => {
        try {
            const data: SpotifyFollowedArtistsResponse | null = await makeApiRequest(
                "https://api.spotify.com/v1/me/following?type=artist&limit=50",
                "Artists",
                true
            );

            if (data) {
                onArtistsUpdate(data.artists.items, data.artists.next);
                await saveCachedData(undefined, undefined, data.artists.items, undefined);
            } else {
                onArtistsUpdate([], null);
            }
        } catch (error: any) {
            logError("Auth: Error fetching artists:", error.message);
            onArtistsUpdate([], null);
        }
    };

    const fetchSavedTracks = async () => {
        try {
            const data: SavedTracksResponse | null = await makeApiRequest(
                "https://api.spotify.com/v1/me/tracks?limit=50",
                "Saved Tracks",
                true
            );

            if (data) {
                onSavedTracksUpdate(data.items, data.next);
                await saveCachedData(undefined, undefined, undefined, data.items, undefined);
            } else {
                onSavedTracksUpdate([], null);
            }
        } catch (error: any) {
            logError("Auth: Error fetching saved tracks:", error.message);
            onSavedTracksUpdate([], null);
        }
    };

    try {
        // Execute all data fetches in parallel for faster loading
        await Promise.all([
            fetchPlaylists(),
            fetchAlbums(),
            fetchPodcasts(),
            fetchArtists(),
            fetchSavedTracks(),
        ]);
        log("Auth: Data loaded successfully");
    } catch (error) {
        logError("Auth: Error in parallel data fetching:", error);
    }
};
