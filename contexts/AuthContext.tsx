import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
    useCallback,
} from "react";
import * as SecureStore from "expo-secure-store";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

const SPOTIFY_CLIENT_ID = "2f20bc972e764706956ba7b59648b707";
const SPOTIFY_SCOPES = [
    "user-read-email",
    "user-library-read",
    "user-library-modify",
    "user-read-recently-played",
    "user-top-read",
    "playlist-read-private",
    "playlist-read-collaborative",
    "playlist-modify-public",
    "playlist-modify-private",
    "user-modify-playback-state",
    "user-read-playback-state",
    "streaming",
];

// Use `AuthSession.makeRedirectUri()` to automatically generate the redirect URI
// Ensure this URI is added to your Spotify app's allowed redirect URIs in the Spotify Developer Dashboard.
const redirectUri = AuthSession.makeRedirectUri({
    native: "spotify-light://callback", // Force this for native builds
    // scheme: 'spotify-light', // Your custom scheme defined in app.json
    // path: 'callback',       // The path component of your redirect URI
});

const discovery = {
    authorizationEndpoint: "https://accounts.spotify.com/authorize",
    tokenEndpoint: "https://accounts.spotify.com/api/token",
};

WebBrowser.maybeCompleteAuthSession();

// Spotify API Types
export interface SpotifyImage {
    url: string;
    height?: number;
    width?: number;
}

export interface SpotifyPlaylistOwner {
    display_name?: string;
    id: string;
}

export interface SpotifyPlaylist {
    id: string;
    name: string;
    description: string | null;
    images: SpotifyImage[];
    owner: SpotifyPlaylistOwner;
    tracks: {
        href: string;
        total: number;
    };
    public?: boolean;
    collaborative: boolean;
    uri: string;
    href: string;
}

export interface SpotifyPlaylistsResponse {
    href: string;
    items: SpotifyPlaylist[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
}

// Spotify API Types - Albums
export interface SpotifyArtistSimple {
    external_urls: { spotify: string };
    href: string;
    id: string;
    name: string;
    type: string;
    uri: string;
}

export interface SpotifyAlbum {
    album_type: string;
    total_tracks: number;
    available_markets: string[];
    external_urls: { spotify: string };
    href: string;
    id: string;
    images: SpotifyImage[];
    name: string;
    release_date: string;
    release_date_precision: string;
    type: string;
    uri: string;
    artists: SpotifyArtistSimple[];
    tracks?: SpotifyAlbumTracks;
}

export interface SpotifyAlbumTracks {
    href: string;
    items: SpotifyTrackSimple[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
    uri: string;
}

export interface SpotifyTrackSimple {
    artists: SpotifyArtistSimple[];
    available_markets: string[];
    disc_number: number;
    duration_ms: number;
    explicit: boolean;
    external_urls: { spotify: string };
    href: string;
    id: string;
    is_local: boolean;
    name: string;
    preview_url: string | null;
    track_number: number;
    type: string;
    uri: string;
    album?: SpotifyAlbum;
}

export interface SpotifySavedAlbum {
    added_at: string;
    album: SpotifyAlbum;
}

export interface SpotifySavedAlbumsResponse {
    href: string;
    items: SpotifySavedAlbum[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
}

// Spotify API Types - Saved Tracks
export interface SavedTrackObject {
    added_at: string;
    track: SpotifyTrackSimple; // Reusing SpotifyTrackSimple, ensure it has album images
}

export interface SavedTracksResponse {
    href: string;
    items: SavedTrackObject[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
}

// Spotify API Types - Player / Devices
export interface SpotifyDevice {
    id: string | null; // Can be null if no device is active
    is_active: boolean;
    is_private_session: boolean;
    is_restricted: boolean;
    name: string;
    type: string; // e.g., "computer", "smartphone", "speaker"
    volume_percent: number | null; // Can be null
    supports_volume: boolean;
}

export interface SpotifyDevicesResponse {
    devices: SpotifyDevice[];
}

export interface SpotifyRepeatState {
    state: "off" | "track" | "context";
}

export interface SpotifyCurrentlyPlaying {
    timestamp: number;
    context: SpotifyPlaybackContext | null;
    progress_ms: number | null;
    is_playing: boolean;
    item: SpotifyTrackSimple | null; // Can be null if nothing is playing
    currently_playing_type: "track" | "episode" | "ad" | "unknown";
    actions: { disallows: Record<string, boolean> };
    device: SpotifyDevice;
    shuffle_state: boolean;
    repeat_state: SpotifyRepeatState["state"];
}

export interface SpotifyPlaybackContext {
    type: "album" | "artist" | "playlist" | "show";
    href: string;
    external_urls: { spotify: string };
    uri: string;
}

interface AuthContextType {
    accessToken: string | null;
    refreshToken: string | null;
    user: any | null;

    playlists: SpotifyPlaylist[] | null;
    playlistsNextUrl: string | null;
    isLoadingMorePlaylists: boolean;
    fetchMorePlaylists: () => Promise<void>;

    albums: SpotifySavedAlbum[] | null;
    albumsNextUrl: string | null;
    isLoadingMoreAlbums: boolean;
    fetchMoreAlbums: () => Promise<void>;

    savedTracks: SavedTrackObject[] | null;
    savedTracksNextUrl: string | null;
    isLoadingMoreSavedTracks: boolean;
    fetchMoreSavedTracks: () => Promise<void>;

    isLoading: boolean;
    isRefreshingPlaylists: boolean;
    isRefreshingAlbums: boolean;
    isRefreshingSavedTracks: boolean;

    login: () => Promise<void>;
    logout: () => Promise<void>;

    fetchPlaylists: () => Promise<void>;
    fetchAlbums: () => Promise<void>;
    fetchSavedTracks: () => Promise<void>;
    playTrack: (
        trackUri: string,
        deviceId?: string,
        contextUri?: string
    ) => Promise<void>;
    getPlaybackState: () => Promise<SpotifyCurrentlyPlaying | null>;
    startPlayback: () => Promise<void>;
    pausePlayback: () => Promise<void>;
    skipToNext: () => Promise<void>;
    skipToPrevious: () => Promise<void>;
    toggleShuffle: (state: boolean) => Promise<void>;
    toggleRepeat: (state: "off" | "track") => Promise<void>;
    addTrackToPlaylist: (
        playlistId: string,
        trackUri: string
    ) => Promise<boolean>; // Added
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = "spotifyAuthToken";
const REFRESH_TOKEN_KEY = "spotifyRefreshToken";
const USER_INFO_KEY = "spotifyUserInfo";
const TOKEN_EXPIRY_KEY = "spotifyTokenExpiry";
const PLAYLISTS_KEY = "spotifyPlaylists"; // For potential caching
const ALBUMS_KEY = "spotifyAlbums"; // For potential caching for saved albums
const SAVED_TRACKS_KEY = "spotifySavedTracks"; // For potential caching for saved tracks

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [user, setUser] = useState<any | null>(null);
    const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);

    // Playlists
    const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null);
    const [playlistsNextUrl, setPlaylistsNextUrl] = useState<string | null>(
        null
    );
    const [isLoadingMorePlaylists, setIsLoadingMorePlaylists] = useState(false);
    const [isRefreshingPlaylists, setIsRefreshingPlaylists] = useState(false);

    // Albums
    const [albums, setAlbums] = useState<SpotifySavedAlbum[] | null>(null);
    const [albumsNextUrl, setAlbumsNextUrl] = useState<string | null>(null);
    const [isLoadingMoreAlbums, setIsLoadingMoreAlbums] = useState(false);
    const [isRefreshingAlbums, setIsRefreshingAlbums] = useState(false);

    // Saved Tracks
    const [savedTracks, setSavedTracks] = useState<SavedTrackObject[] | null>(
        null
    );
    const [savedTracksNextUrl, setSavedTracksNextUrl] = useState<string | null>(
        null
    );
    const [isLoadingMoreSavedTracks, setIsLoadingMoreSavedTracks] =
        useState(false);
    const [isRefreshingSavedTracks, setIsRefreshingSavedTracks] =
        useState(false);

    const [isLoading, setIsLoading] = useState(true); // Global initial loading

    const [request, response, promptAsync] = AuthSession.useAuthRequest(
        {
            clientId: SPOTIFY_CLIENT_ID,
            scopes: SPOTIFY_SCOPES,
            usePKCE: true, // Recommended for mobile apps
            redirectUri: redirectUri,
        },
        discovery
    );

    useEffect(() => {
        if (request) {
            console.log(
                "AuthContext: Generated redirectUri for Spotify request:",
                request.redirectUri
            );
        }
    }, [request]);

    // Function to refresh the access token
    const refreshAccessToken = useCallback(
        async (currentRefreshToken: string) => {
            console.log("AuthContext: Attempting to refresh access token...");
            if (!currentRefreshToken) {
                console.log(
                    "AuthContext: No refresh token available to refresh access token."
                );
                return false;
            }
            try {
                const response = await AuthSession.refreshAsync(
                    {
                        clientId: SPOTIFY_CLIENT_ID,
                        refreshToken: currentRefreshToken,
                    },
                    discovery
                );

                if (response.accessToken) {
                    setAccessToken(response.accessToken);
                    await SecureStore.setItemAsync(
                        AUTH_TOKEN_KEY,
                        response.accessToken
                    );

                    // Set token expiry to 45 minutes from now
                    const expiryTime = Date.now() + 45 * 60 * 1000;
                    setTokenExpiry(expiryTime);
                    await SecureStore.setItemAsync(
                        TOKEN_EXPIRY_KEY,
                        expiryTime.toString()
                    );

                    console.log(
                        "AuthContext: Access token refreshed successfully."
                    );

                    // Spotify may return a new refresh token
                    if (response.refreshToken) {
                        setRefreshToken(response.refreshToken);
                        await SecureStore.setItemAsync(
                            REFRESH_TOKEN_KEY,
                            response.refreshToken
                        );
                        console.log(
                            "AuthContext: New refresh token received and stored."
                        );
                    }
                    return true;
                } else {
                    console.error(
                        "AuthContext: Failed to refresh access token. No new token received."
                    );
                    // Clear tokens and user data
                    setAccessToken(null);
                    setRefreshToken(null);
                    setUser(null);
                    setTokenExpiry(null);
                    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
                    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
                    await SecureStore.deleteItemAsync(USER_INFO_KEY);
                    await SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY);
                    return false;
                }
            } catch (error) {
                console.error(
                    "AuthContext: Error during token refresh:",
                    error
                );
                // Clear tokens and user data
                setAccessToken(null);
                setRefreshToken(null);
                setUser(null);
                setTokenExpiry(null);
                await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
                await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
                await SecureStore.deleteItemAsync(USER_INFO_KEY);
                await SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY);
                return false;
            }
        },
        [setAccessToken, setRefreshToken, setUser]
    );

    // Add proactive token refresh mechanism
    useEffect(() => {
        const checkAndRefreshToken = async () => {
            if (!tokenExpiry || !refreshToken) return;

            // Refresh token if it's within 5 minutes of expiring
            const timeUntilExpiry = tokenExpiry - Date.now();
            if (timeUntilExpiry < 5 * 60 * 1000) {
                // 5 minutes
                console.log(
                    "AuthContext: Proactively refreshing token before expiry"
                );
                await refreshAccessToken(refreshToken);
            }
        };

        // Check token every minute
        const intervalId = setInterval(checkAndRefreshToken, 60 * 1000);
        return () => clearInterval(intervalId);
    }, [tokenExpiry, refreshToken, refreshAccessToken]);

    const logout = useCallback(async () => {
        console.log("Logging out...");
        await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        await SecureStore.deleteItemAsync(USER_INFO_KEY);
        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
        setPlaylists(null);
        setPlaylistsNextUrl(null);
        setAlbums(null);
        setAlbumsNextUrl(null);
        setSavedTracks(null);
        setSavedTracksNextUrl(null);
        setIsLoading(false); // Reset loading state
    }, [
        setAccessToken,
        setRefreshToken,
        setUser,
        setPlaylists,
        setPlaylistsNextUrl,
        setAlbums,
        setAlbumsNextUrl,
        setSavedTracks,
        setSavedTracksNextUrl,
        setIsLoading,
    ]);

    useEffect(() => {
        const loadStoredAuth = async () => {
            try {
                const storedToken = await SecureStore.getItemAsync(
                    AUTH_TOKEN_KEY
                );
                const storedRefreshToken = await SecureStore.getItemAsync(
                    REFRESH_TOKEN_KEY
                );
                const storedUser = await SecureStore.getItemAsync(
                    USER_INFO_KEY
                );
                const storedExpiry = await SecureStore.getItemAsync(
                    TOKEN_EXPIRY_KEY
                );

                if (storedToken && storedExpiry) {
                    const expiryTime = parseInt(storedExpiry);
                    // If token is expired or will expire in next 5 minutes, refresh it
                    if (expiryTime > Date.now() + 5 * 60 * 1000) {
                        setAccessToken(storedToken);
                        setTokenExpiry(expiryTime);
                        if (storedRefreshToken) {
                            setRefreshToken(storedRefreshToken);
                        }
                        if (storedUser) {
                            setUser(JSON.parse(storedUser));
                        }
                    } else if (storedRefreshToken) {
                        // Token expired or about to expire, refresh it
                        const refreshed = await refreshAccessToken(
                            storedRefreshToken
                        );
                        if (!refreshed) {
                            await logout();
                        }
                    }
                } else if (storedRefreshToken) {
                    console.log(
                        "AuthContext: Access token not found or expired, attempting to refresh."
                    );
                    setRefreshToken(storedRefreshToken);
                    const refreshed = await refreshAccessToken(
                        storedRefreshToken
                    );
                    if (!refreshed) {
                        await logout();
                    }
                }
            } catch (e) {
                console.error("Failed to load auth state:", e);
                await logout();
            } finally {
                setIsLoading(false);
            }
        };
        loadStoredAuth();
    }, [refreshAccessToken, logout]);

    useEffect(() => {
        if (response) {
            if (response.type === "success") {
                const { code } = response.params;
                fetchToken(code);
            } else if (response.type === "error") {
                console.error("Spotify Authentication Error:", response.error);
                setIsLoading(false);
            }
        }
    }, [response]);

    const fetchToken = async (code: string) => {
        try {
            const tokenResponse = await AuthSession.exchangeCodeAsync(
                {
                    clientId: SPOTIFY_CLIENT_ID,
                    code: code,
                    redirectUri: redirectUri,
                    extraParams: {
                        code_verifier: request?.codeVerifier || "",
                    },
                },
                discovery
            );
            if (tokenResponse.accessToken) {
                setAccessToken(tokenResponse.accessToken);
                await SecureStore.setItemAsync(
                    AUTH_TOKEN_KEY,
                    tokenResponse.accessToken
                );
                if (tokenResponse.refreshToken) {
                    setRefreshToken(tokenResponse.refreshToken);
                    await SecureStore.setItemAsync(
                        REFRESH_TOKEN_KEY,
                        tokenResponse.refreshToken
                    );
                }
                // Fetch user info after getting token
                await fetchUserInfo(tokenResponse.accessToken);
            } else {
                setIsLoading(false); // Ensure loading stops if token exchange fails
            }
        } catch (e) {
            console.error("Failed to fetch token:", e);
            setIsLoading(false);
        }
    };

    const fetchUserInfo = async (token: string) => {
        console.log("AuthContext: Fetching user info...");
        try {
            const response = await fetch("https://api.spotify.com/v1/me", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const userData = await response.json();
            if (!response.ok) {
                throw new Error(
                    `Failed to fetch user info: ${
                        userData?.error?.message || response.status
                    }`
                );
            }
            setUser(userData);
            await SecureStore.setItemAsync(
                USER_INFO_KEY,
                JSON.stringify(userData)
            );
            // Start fetching other data after user info is successfully retrieved
            await _fetchInitialPlaylists(token);
        } catch (e: any) {
            console.error("AuthContext: Error fetching user info:", e.message);
            // Attempt to parse more detailed error from Spotify if it's an HTTP error like object
            if (e.response && typeof e.response.json === "function") {
                try {
                    const errorData = await e.response.json();
                    console.error("Spotify API Error Details:", errorData);
                } catch (parseError) {
                    console.error(
                        "Error parsing Spotify API error response:",
                        parseError
                    );
                }
            }
            setAccessToken(null); // Log out on error
            setUser(null);
            await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
            await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
            await SecureStore.deleteItemAsync(USER_INFO_KEY);
            setPlaylists(null);
            setPlaylistsNextUrl(null);
            setAlbums(null);
            setAlbumsNextUrl(null);
            setSavedTracks(null);
            setSavedTracksNextUrl(null);
            setIsLoading(false); // Ensure loading stops on error
        }
    };

    const _fetchInitialPlaylists = async (token: string) => {
        console.log("AuthContext: Fetching initial playlists (page 1)...");
        try {
            const response = await fetch(
                "https://api.spotify.com/v1/me/playlists?limit=50", // Fetch first page
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            const data: SpotifyPlaylistsResponse = await response.json();
            if (!response.ok) {
                let errorMessage = response.status.toString();
                try {
                    const errorData = data as any;
                    if (
                        errorData &&
                        errorData.error &&
                        errorData.error.message
                    ) {
                        errorMessage = errorData.error.message;
                    }
                } catch (e) {
                    /* Ignore */
                }
                throw new Error(`Failed to fetch playlists: ${errorMessage}`);
            }
            setPlaylists(data.items);
            setPlaylistsNextUrl(data.next);
            await _fetchInitialAlbums(token); // Chain loading
        } catch (e: any) {
            console.error(
                "AuthContext: Error fetching initial playlists:",
                e.message
            );
            setPlaylists(null);
            setPlaylistsNextUrl(null);
            await _fetchInitialAlbums(token); // Still try to load next set of data
        }
    };

    const _fetchInitialAlbums = async (token: string) => {
        console.log("AuthContext: Fetching initial albums (page 1)...");
        try {
            const response = await fetch(
                "https://api.spotify.com/v1/me/albums?limit=50", // Fetch first page
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            const data: SpotifySavedAlbumsResponse = await response.json();
            if (!response.ok) {
                let errorMessage = response.status.toString();
                try {
                    const errorData = data as any;
                    if (
                        errorData &&
                        errorData.error &&
                        errorData.error.message
                    ) {
                        errorMessage = errorData.error.message;
                    }
                } catch (e) {
                    /* Ignore */
                }
                throw new Error(`Failed to fetch albums: ${errorMessage}`);
            }
            setAlbums(data.items);
            setAlbumsNextUrl(data.next);
            await _fetchInitialSavedTracksAndUpdateGlobalLoading(token); // Chain loading
        } catch (e: any) {
            console.error(
                "AuthContext: Error fetching initial albums:",
                e.message
            );
            setAlbums(null);
            setAlbumsNextUrl(null);
            await _fetchInitialSavedTracksAndUpdateGlobalLoading(token); // Still try to load next
        }
    };

    const _fetchInitialSavedTracksAndUpdateGlobalLoading = async (
        token: string
    ) => {
        console.log("AuthContext: Fetching initial saved tracks (page 1)...");
        try {
            const response = await fetch(
                "https://api.spotify.com/v1/me/tracks?limit=50", // Fetch first page
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            const data: SavedTracksResponse = await response.json();
            if (!response.ok) {
                let errorMessage = response.status.toString();
                try {
                    const errorData = data as any;
                    if (
                        errorData &&
                        errorData.error &&
                        errorData.error.message
                    ) {
                        errorMessage = errorData.error.message;
                    }
                } catch (e) {
                    /* Ignore */
                }
                throw new Error(
                    `Failed to fetch saved tracks: ${errorMessage}`
                );
            }
            setSavedTracks(data.items);
            setSavedTracksNextUrl(data.next);
        } catch (e: any) {
            console.error(
                "AuthContext: Error fetching initial saved tracks:",
                e.message
            );
            setSavedTracks(null);
            setSavedTracksNextUrl(null);
        } finally {
            console.log(
                "AuthContext: Finished all initial data fetches (page 1 of each). Setting global loading to false."
            );
            setIsLoading(false);
        }
    };

    // --- Utility for API calls ---
    const makeApiRequest = useCallback(
        async (
            url: string,
            errorMessage: string,
            isRefreshing = false,
            retryCount = 0
        ): Promise<any | null> => {
            if (!accessToken) {
                console.error("No access token available for API request.");
                if (refreshToken) {
                    console.log(
                        "Attempting to refresh token before API request..."
                    );
                    const refreshed = await refreshAccessToken(refreshToken);
                    if (refreshed) {
                        // Retry the request once after successful refresh
                        return makeApiRequest(
                            url,
                            errorMessage,
                            isRefreshing,
                            1
                        );
                    } else {
                        await logout();
                        return null;
                    }
                }
                // Optionally, trigger re-authentication or inform the user
                // For now, just returning null to prevent further execution without a token
                return null;
            }
            if (isRefreshing)
                console.log(`Refreshing ${errorMessage.toLowerCase()}...`);

            try {
                const response = await fetch(url, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });
                if (!response.ok) {
                    const errorData = await response
                        .json()
                        .catch(() => ({ message: "Unknown error" }));
                    console.error(
                        `Error fetching ${errorMessage.toLowerCase()}: ${
                            response.status
                        }`,
                        errorData
                    );
                    if (
                        response.status === 401 &&
                        retryCount < 1 &&
                        refreshToken
                    ) {
                        console.log(
                            "Token might be expired. Attempting to refresh token."
                        );
                        const refreshed = await refreshAccessToken(
                            refreshToken
                        );
                        if (refreshed) {
                            console.log(
                                "Token refreshed successfully. Retrying API request."
                            );
                            return makeApiRequest(
                                url,
                                errorMessage,
                                isRefreshing,
                                1
                            );
                        } else {
                            console.log(
                                "Failed to refresh token. Logging out."
                            );
                            await logout();
                            return null;
                        }
                    } else if (response.status === 401) {
                        console.log(
                            "Token is invalid even after refresh attempt or no refresh token. Logging out."
                        );
                        await logout();
                    }
                    return null;
                }
                return await response.json();
            } catch (error) {
                console.error(
                    `Network or other error fetching ${errorMessage.toLowerCase()}:`,
                    error
                );
                return null;
            }
        },
        [accessToken, refreshToken, refreshAccessToken, logout]
    );

    // --- Playlists ---
    const fetchPlaylists = useCallback(async () => {
        if (!accessToken) return;
        setIsRefreshingPlaylists(true);
        const data = await makeApiRequest(
            "https://api.spotify.com/v1/me/playlists?limit=50",
            "Playlists",
            true
        );
        if (data) {
            setPlaylists(data.items);
            setPlaylistsNextUrl(data.next);
        } else {
            // Handle error, maybe set playlists to an empty array or show a message
            setPlaylists([]); // Example: clear playlists on error
            setPlaylistsNextUrl(null);
        }
        setIsRefreshingPlaylists(false);
    }, [accessToken, makeApiRequest]);

    const fetchMorePlaylists = useCallback(async () => {
        if (!playlistsNextUrl || isLoadingMorePlaylists || !accessToken) return;
        setIsLoadingMorePlaylists(true);
        const data = await makeApiRequest(playlistsNextUrl, "More Playlists");
        if (data) {
            setPlaylists((prevPlaylists) => [
                ...(prevPlaylists || []),
                ...data.items,
            ]);
            setPlaylistsNextUrl(data.next);
        }
        setIsLoadingMorePlaylists(false);
    }, [playlistsNextUrl, isLoadingMorePlaylists, accessToken, makeApiRequest]);

    // --- Albums ---
    const fetchAlbums = useCallback(async () => {
        if (!accessToken) return;
        setIsRefreshingAlbums(true);
        const data = await makeApiRequest(
            "https://api.spotify.com/v1/me/albums?limit=50",
            "Albums",
            true
        );
        if (data) {
            setAlbums(data.items);
            setAlbumsNextUrl(data.next);
        } else {
            setAlbums([]);
            setAlbumsNextUrl(null);
        }
        setIsRefreshingAlbums(false);
    }, [accessToken, makeApiRequest]);

    const fetchMoreAlbums = useCallback(async () => {
        if (!albumsNextUrl || isLoadingMoreAlbums || !accessToken) return;
        setIsLoadingMoreAlbums(true);
        const data = await makeApiRequest(albumsNextUrl, "More Albums");
        if (data) {
            setAlbums((prevAlbums) => [...(prevAlbums || []), ...data.items]);
            setAlbumsNextUrl(data.next);
        }
        setIsLoadingMoreAlbums(false);
    }, [albumsNextUrl, isLoadingMoreAlbums, accessToken, makeApiRequest]);

    // --- Saved Tracks ---
    const fetchSavedTracks = useCallback(async () => {
        if (!accessToken) return;
        setIsRefreshingSavedTracks(true);
        const data = await makeApiRequest(
            "https://api.spotify.com/v1/me/tracks?limit=50",
            "Saved Tracks",
            true
        );
        if (data) {
            setSavedTracks(data.items);
            setSavedTracksNextUrl(data.next);
        } else {
            setSavedTracks([]);
            setSavedTracksNextUrl(null);
        }
        setIsRefreshingSavedTracks(false);
    }, [accessToken, makeApiRequest]);

    const fetchMoreSavedTracks = useCallback(async () => {
        if (!savedTracksNextUrl || isLoadingMoreSavedTracks || !accessToken)
            return;
        setIsLoadingMoreSavedTracks(true);
        const data = await makeApiRequest(
            savedTracksNextUrl,
            "More Saved Tracks"
        );
        if (data) {
            setSavedTracks((prevTracks) => [
                ...(prevTracks || []),
                ...data.items,
            ]);
            setSavedTracksNextUrl(data.next);
        }
        setIsLoadingMoreSavedTracks(false);
    }, [
        savedTracksNextUrl,
        isLoadingMoreSavedTracks,
        accessToken,
        makeApiRequest,
    ]);

    // --- Device and Playback ---
    const _getAvailableDeviceId = useCallback(async (): Promise<
        string | null
    > => {
        console.log("AuthContext: Fetching available devices...");
        if (!accessToken) {
            console.error("AuthContext: No access token for fetching devices.");
            return null;
        }
        try {
            const response = await fetch(
                "https://api.spotify.com/v1/me/player/devices",
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                }
            );
            const data: SpotifyDevicesResponse = await response.json();
            if (!response.ok) {
                let errorMessage = response.status.toString();
                try {
                    const errorData = data as any;
                    if (
                        errorData &&
                        errorData.error &&
                        errorData.error.message
                    ) {
                        errorMessage = errorData.error.message;
                    }
                } catch (e) {
                    /* Ignore if casting/accessing error fails */
                }
                throw new Error(`Failed to fetch devices: ${errorMessage}`);
            }

            if (data.devices && data.devices.length > 0) {
                const activeDevice = data.devices.find(
                    (device) => device.is_active
                );
                if (activeDevice && activeDevice.id) {
                    console.log(
                        `AuthContext: Found active device: ${activeDevice.name} (ID: ${activeDevice.id})`
                    );
                    return activeDevice.id;
                }
                // If no active device, try to return the first available device's ID
                // This might not always be what the user wants, but it's better than nothing if they have an inactive device.
                // For a better UX, you might prompt the user to select a device.
                if (data.devices[0] && data.devices[0].id) {
                    console.log(
                        `AuthContext: No active device found. Using first available device: ${data.devices[0].name} (ID: ${data.devices[0].id})`
                    );
                    return data.devices[0].id;
                }
            }
            console.log("AuthContext: No devices found or available.");
            return null;
        } catch (e: any) {
            console.error(
                "AuthContext: Error fetching available devices:",
                e.message
            );
            return null;
        }
    }, [accessToken]);

    const playTrack = useCallback(
        async (
            trackUri: string,
            deviceId?: string,
            contextUri?: string // Allow context URI to be passed
        ) => {
            if (!accessToken) {
                console.error("Cannot play track: No access token.");
                return;
            }

            let targetDeviceId = deviceId;

            if (!targetDeviceId) {
                // Custom device selection: prefer TLP301 if available, otherwise open Spotify app
                console.log(
                    "AuthContext: Fetching devices for custom logic..."
                );
                let devices: SpotifyDevicesResponse["devices"] = [];
                try {
                    const resp = await fetch(
                        "https://api.spotify.com/v1/me/player/devices",
                        {
                            headers: { Authorization: `Bearer ${accessToken}` },
                        }
                    );
                    const data: SpotifyDevicesResponse = await resp.json();
                    if (resp.ok && data.devices) {
                        devices = data.devices;
                    } else {
                        console.error(
                            "AuthContext: Error fetching devices for play logic",
                            data
                        );
                    }
                } catch (e: any) {
                    console.error(
                        "AuthContext: Exception fetching devices for play logic",
                        e
                    );
                }
                // Log all device names for debugging
                if (devices.length > 0) {
                    console.log(
                        "AuthContext: Available devices:",
                        devices.map((d) => d.name).join(", ")
                    );
                } else {
                    console.log(
                        "AuthContext: No devices available for custom logic"
                    );
                }
                const tlpDevice = devices.find(
                    (device) => device.name === "TLP301"
                );
                if (tlpDevice && tlpDevice.id) {
                    console.log(
                        `AuthContext: Found TLP301 device (ID: ${tlpDevice.id}), playing on it.`
                    );
                    targetDeviceId = tlpDevice.id;
                } else {
                    console.log(
                        "AuthContext: TLP301 not found, opening Spotify app."
                    );
                    Linking.openURL(trackUri).catch((err) => {
                        console.error(
                            "AuthContext: Failed to open Spotify app",
                            err
                        );
                    });
                    return;
                }
            }

            console.log(
                `AuthContext: Attempting to play track: ${trackUri}` +
                    (targetDeviceId ? ` on device: ${targetDeviceId}` : "")
            );
            try {
                // Build payload: use contextUri to queue liked songs, otherwise play single track
                const payload: any = contextUri
                    ? { context_uri: contextUri, offset: { uri: trackUri } }
                    : { uris: [trackUri] };

                let playUrl = "https://api.spotify.com/v1/me/player/play";
                if (targetDeviceId) {
                    playUrl += `?device_id=${targetDeviceId}`;
                }

                const response = await fetch(playUrl, {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    let errorBodyText = await response.text(); // Read body as text for more info
                    let errorMessage = `${response.status} - ${response.statusText}`;
                    try {
                        const errorData = JSON.parse(errorBodyText); // Try to parse as JSON
                        if (
                            errorData &&
                            errorData.error &&
                            errorData.error.message
                        ) {
                            errorMessage = errorData.error.message;
                            if (errorData.error.reason) {
                                console.error(
                                    "Spotify Playback Error Reason:",
                                    errorData.error.reason
                                );
                                // NO_ACTIVE_DEVICE is a common reason if device_id is not specified and no device is active
                                // PLAYER_COMMAND_FAILED if device_id is specified but invalid, or other reasons
                            }
                        }
                    } catch (e) {
                        /* Ignore if body is not JSON */
                    }
                    console.error(
                        "Spotify Playback Error Full Response:",
                        errorBodyText
                    );
                    throw new Error(`Failed to play track: ${errorMessage}`);
                }
                console.log(
                    "AuthContext: Play command sent successfully for track:",
                    trackUri
                );
            } catch (e: any) {
                console.error("AuthContext: Error playing track:", e.message);
                // Potentially show a toast or message to the user
            }
        },
        [accessToken, _getAvailableDeviceId]
    ); // Added _getAvailableDeviceId as a dependency

    const addTrackToPlaylist = async (
        playlistId: string,
        trackUri: string
    ): Promise<boolean> => {
        if (!accessToken) {
            console.error(
                "AuthContext: Cannot add track to playlist, no access token."
            );
            return false;
        }
        if (!playlistId || !trackUri) {
            console.error(
                "AuthContext: Playlist ID and Track URI are required."
            );
            return false;
        }

        console.log(
            `AuthContext: Adding track ${trackUri} to playlist ${playlistId}`
        );
        try {
            const response = await fetch(
                `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        uris: [trackUri],
                    }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({
                    message: "Failed to parse error response",
                }));
                console.error(
                    `AuthContext: Failed to add track to playlist ${playlistId}. Status: ${response.status}`,
                    errorData
                );
                // Consider more specific error handling based on status or errorData.error.reason
                return false;
            }

            console.log(
                `AuthContext: Successfully added track ${trackUri} to playlist ${playlistId}`
            );
            return true;
        } catch (error: any) {
            console.error(
                `AuthContext: Error adding track to playlist ${playlistId}:`,
                error.message
            );
            return false;
        }
    };

    // --- Authentication Flow ---
    const login = useCallback(async () => {
        if (!request) {
            console.log("Auth request not ready yet");
            return;
        }
        setIsLoading(true);
        await promptAsync();
        // The useEffect hook for 'response' will handle the rest
    }, [request, promptAsync]);

    const getPlaybackState =
        async (): Promise<SpotifyCurrentlyPlaying | null> => {
            if (!accessToken) return null;

            try {
                const response = await fetch(
                    "https://api.spotify.com/v1/me/player",
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    }
                );

                if (response.status === 204 || response.status === 202) {
                    // No content or accepted, meaning no active player or nothing playing
                    return null;
                }

                if (!response.ok) {
                    const errorData = await response.text(); // Use .text() for better error detail
                    console.error(
                        "Error fetching playback state:",
                        response.status,
                        errorData
                    );
                    return null;
                }

                const data = await response.json();
                return data as SpotifyCurrentlyPlaying;
            } catch (error) {
                console.error("Error in getPlaybackState:", error);
                return null;
            }
        };

    const startPlayback = async () => {
        if (!accessToken) return;

        try {
            const response = await fetch(
                "https://api.spotify.com/v1/me/player/play",
                {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error("Failed to start playback");
            }
        } catch (error) {
            console.error("Error starting playback:", error);
            throw error;
        }
    };

    const pausePlayback = async () => {
        if (!accessToken) return;

        try {
            const response = await fetch(
                "https://api.spotify.com/v1/me/player/pause",
                {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error("Failed to pause playback");
            }
        } catch (error) {
            console.error("Error pausing playback:", error);
            throw error;
        }
    };

    const skipToNext = async () => {
        if (!accessToken) return;

        try {
            const response = await fetch(
                "https://api.spotify.com/v1/me/player/next",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error("Failed to skip to next track");
            }
        } catch (error) {
            console.error("Error skipping to next track:", error);
            throw error;
        }
    };

    const skipToPrevious = async () => {
        if (!accessToken) return;

        try {
            // First get the current playback state to check progress
            const currentState = await getPlaybackState();
            if (!currentState || !currentState.item) return;

            const THRESHOLD_MS = 3000; // 3 seconds threshold

            if (
                currentState.progress_ms &&
                currentState.progress_ms > THRESHOLD_MS
            ) {
                // If we're past the threshold, restart the current track
                const response = await fetch(
                    "https://api.spotify.com/v1/me/player/seek?position_ms=0",
                    {
                        method: "PUT",
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    }
                );

                if (!response.ok) {
                    throw new Error("Failed to restart current track");
                }
            } else {
                // If we're within the threshold, go to previous track
                const response = await fetch(
                    "https://api.spotify.com/v1/me/player/previous",
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    }
                );

                if (!response.ok) {
                    throw new Error("Failed to skip to previous track");
                }
            }
        } catch (error) {
            console.error("Error handling previous track:", error);
            throw error;
        }
    };

    const toggleShuffle = async (state: boolean) => {
        if (!accessToken) return;

        try {
            const response = await fetch(
                `https://api.spotify.com/v1/me/player/shuffle?state=${state}`,
                {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error("Failed to toggle shuffle");
            }
        } catch (error) {
            console.error("Error toggling shuffle:", error);
            throw error;
        }
    };

    const toggleRepeat = async (state: "off" | "track") => {
        if (!accessToken) return;

        try {
            const response = await fetch(
                `https://api.spotify.com/v1/me/player/repeat?state=${state}`,
                {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error("Failed to toggle repeat");
            }
        } catch (error) {
            console.error("Error toggling repeat:", error);
            throw error;
        }
    };

    const value = {
        accessToken,
        refreshToken,
        user,
        playlists,
        playlistsNextUrl,
        isLoadingMorePlaylists,
        fetchMorePlaylists,
        albums,
        albumsNextUrl,
        isLoadingMoreAlbums,
        fetchMoreAlbums,
        savedTracks,
        savedTracksNextUrl,
        isLoadingMoreSavedTracks,
        fetchMoreSavedTracks,
        isLoading,
        isRefreshingPlaylists,
        isRefreshingAlbums,
        isRefreshingSavedTracks,
        login,
        logout,
        fetchPlaylists,
        fetchAlbums,
        fetchSavedTracks,
        playTrack,
        getPlaybackState,
        startPlayback,
        pausePlayback,
        skipToNext,
        skipToPrevious,
        toggleShuffle,
        toggleRepeat,
        addTrackToPlaylist, // Added
    };

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
