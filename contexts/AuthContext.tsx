import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	ReactNode,
	useCallback,
} from "react";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import SpotifySdk from "../modules/spotify-sdk";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";

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

// Use the same redirect URI that's configured in the Android manifest
const REDIRECT_URI = "spotify-light://callback";

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
	uri: string;
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

// Spotify API Types - Search
export interface SpotifyAlbumSimple {
	// Simplified Album for search results
	album_type: string;
	total_tracks: number;
	href: string;
	id: string;
	images: SpotifyImage[];
	name: string;
	release_date: string;
	release_date_precision: string;
	type: "album";
	uri: string;
	artists: SpotifyArtistSimple[];
}

export interface SpotifyTrack {
	// More complete track for search results if needed, or use SpotifyTrackSimple
	album: SpotifyAlbumSimple;
	artists: SpotifyArtistSimple[];
	available_markets: string[];
	disc_number: number;
	duration_ms: number;
	explicit: boolean;
	external_ids: { isrc?: string; ean?: string; upc?: string };
	external_urls: { spotify: string };
	href: string;
	id: string;
	is_local: boolean;
	name: string;
	popularity: number;
	preview_url: string | null;
	track_number: number;
	type: "track";
	uri: string;
}

export interface SpotifyPlaylistSimple {
	// Simplified Playlist for search results
	collaborative: boolean;
	description: string | null;
	external_urls: { spotify: string };
	href: string;
	id: string;
	images: SpotifyImage[];
	name: string;
	owner: SpotifyPlaylistOwner; // Ensure SpotifyPlaylistOwner is exported or accessible
	public: boolean | null;
	snapshot_id: string;
	tracks: {
		href: string;
		total: number;
	};
	type: "playlist";
	uri: string;
}

export interface SpotifySearchResults {
	tracks?: {
		href: string;
		items: SpotifyTrack[];
		limit: number;
		next: string | null;
		offset: number;
		previous: string | null;
		total: number;
	};
	albums?: {
		href: string;
		items: SpotifyAlbumSimple[];
		limit: number;
		next: string | null;
		offset: number;
		previous: string | null;
		total: number;
	};
	playlists?: {
		href: string;
		items: SpotifyPlaylistSimple[];
		limit: number;
		next: string | null;
		offset: number;
		previous: string | null;
		total: number;
	};
	// artists, shows, episodes, audiobooks can be added if needed
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
	isConnectedToAppRemote: boolean;

	login: () => Promise<void>;
	logout: () => Promise<void>;

	fetchPlaylists: () => Promise<void>;
	fetchAlbums: () => Promise<void>;
	fetchSavedTracks: () => Promise<void>;
	refreshSavedTracksFromCache: () => Promise<void>;
	saveAlbum: (albumId: string) => Promise<boolean>;
	removeAlbum: (albumId: string) => Promise<boolean>;
	checkIfAlbumIsSaved: (albumId: string) => Promise<boolean>;
	refreshSavedAlbumsFromCache: () => Promise<void>;
	playTrack: (
		trackUri: string,
		deviceId?: string,
		contextUri?: string
	) => Promise<void>;
	playTrackWithContext: (
		trackUri: string,
		sourceContext?: {
			type: "album" | "playlist" | "liked" | "artist";
			uri?: string;
			tracks?: any[];
			currentIndex?: number;
		}
	) => Promise<void>;
	getPlaybackState: () => Promise<SpotifyCurrentlyPlaying | null>;
	getCurrentTrack: () => Promise<any | null>;
	getAlbumArt: (uri?: string, size?: string) => Promise<string | null>;
	startPlayback: () => Promise<void>;
	pausePlayback: () => Promise<void>;
	skipToNext: () => Promise<void>;
	skipToPrevious: () => Promise<void>;
	toggleShuffle: (state: boolean) => Promise<void>;
	toggleRepeat: (state: "off" | "track") => Promise<void>;
	addTrackToPlaylist: (
		playlistId: string,
		trackUri: string
	) => Promise<boolean>;
	seekToPosition: (positionMs: number) => Promise<void>;
	searchItems: (
		query: string,
		types: string[]
	) => Promise<SpotifySearchResults | null>;
	clearCachedData: () => Promise<void>;
	forceAppRemoteConnection: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = "spotifyAuthToken";
const REFRESH_TOKEN_KEY = "spotifyRefreshToken";
const USER_INFO_KEY = "spotifyUserInfo";
const TOKEN_EXPIRY_KEY = "spotifyTokenExpiry";
const PLAYLISTS_KEY = "spotifyPlaylists"; // For potential caching
const ALBUMS_KEY = "spotifyAlbums"; // For potential caching for saved albums
const SAVED_TRACKS_KEY = "spotifySavedTracks"; // For potential caching for saved tracks
const ALBUM_ART_CACHE_KEY = "spotifyAlbumArtCache"; // For caching album art URLs

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

	// --- Native SDK App Remote Connection State ---
	const [isConnectedToAppRemote, setIsConnectedToAppRemote] = useState(false);
	const [appState, setAppState] = useState<AppStateStatus>(
		AppState.currentState
	);

	// Ensure App Remote connection
	const ensureAppRemoteConnection =
		useCallback(async (): Promise<boolean> => {
			try {
				// Check if already connected
				const connected = await SpotifySdk.isConnected();
				if (connected) {
					setIsConnectedToAppRemote(true);
					// Removed verbose logging since this gets called frequently
					return true;
				}

				// Reset connection state since we're not connected
				setIsConnectedToAppRemote(false);

				// Connect to App Remote
				console.log("AuthContext: Connecting to Spotify App Remote...");
				const connectionResult = await SpotifySdk.connect(
					SPOTIFY_CLIENT_ID,
					REDIRECT_URI
				);

				if (connectionResult.connected) {
					setIsConnectedToAppRemote(true);
					console.log(
						"AuthContext: Successfully connected to App Remote"
					);
					return true;
				} else {
					console.log(
						"AuthContext: Failed to connect to App Remote - connectionResult.connected is false"
					);
					return false;
				}
			} catch (error) {
				console.log(
					"AuthContext: Error connecting to App Remote (this is normal in airplane mode):",
					error
				);
				setIsConnectedToAppRemote(false);
				return false;
			}
		}, []);

	// More aggressive connection attempt for critical operations
	const forceAppRemoteConnection = useCallback(async (): Promise<boolean> => {
		console.log("AuthContext: Force connecting to App Remote...");

		// First, try to disconnect cleanly (in case of stale connection)
		try {
			await SpotifySdk.disconnect();
		} catch (error) {
			// Ignore disconnect errors
		}

		setIsConnectedToAppRemote(false);

		// Try to connect multiple times
		for (let i = 0; i < 3; i++) {
			console.log(`AuthContext: Connection attempt ${i + 1}/3`);

			try {
				const connectionResult = await SpotifySdk.connect(
					SPOTIFY_CLIENT_ID,
					REDIRECT_URI
				);

				if (connectionResult.connected) {
					setIsConnectedToAppRemote(true);
					console.log(
						"AuthContext: Successfully force-connected to App Remote"
					);
					return true;
				}
			} catch (error) {
				console.log(
					`AuthContext: Connection attempt ${i + 1} failed:`,
					error
				);
			}

			// Wait before retry (except for last attempt)
			if (i < 2) {
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
		}

		console.log("AuthContext: All connection attempts failed");
		setIsConnectedToAppRemote(false);
		return false;
	}, []);

	// Handle app state changes and native lifecycle events for connection management
	useEffect(() => {
		const handleAppStateChange = (nextAppState: AppStateStatus) => {
			console.log(
				`AuthContext: App state changed from ${appState} to ${nextAppState}`
			);

			if (
				appState.match(/inactive|background/) &&
				nextAppState === "active"
			) {
				console.log(
					"AuthContext: App came to foreground - enabling auto-connect"
				);
				// App came to foreground, enable auto-connect for proper lifecycle management
				if (accessToken) {
					SpotifySdk.enableAutoConnect(true);
				}
			} else if (
				appState === "active" &&
				nextAppState.match(/inactive|background/)
			) {
				console.log(
					"AuthContext: App going to background - auto-disconnect will be handled by native lifecycle"
				);
				// The native module will automatically disconnect when the activity goes to background
				setIsConnectedToAppRemote(false);
			}

			setAppState(nextAppState);
		};

		// Handle native lifecycle events
		const handleNativeConnected = (event: any) => {
			console.log("AuthContext: Native SDK connected:", event);
			setIsConnectedToAppRemote(true);
		};

		const handleNativeDisconnected = (event: any) => {
			console.log("AuthContext: Native SDK disconnected:", event);
			setIsConnectedToAppRemote(false);
		};

		const handleActivityStopped = (event: any) => {
			console.log("AuthContext: Activity stopped (background):", event);
			setIsConnectedToAppRemote(false);
		};

		const appStateSubscription = AppState.addEventListener(
			"change",
			handleAppStateChange
		);

		// Listen to native lifecycle events
		const connectedSubscription = SpotifySdk.addListener(
			"onConnected",
			handleNativeConnected
		);
		const disconnectedSubscription = SpotifySdk.addListener(
			"onDisconnected",
			handleNativeDisconnected
		);
		const activityStoppedSubscription = SpotifySdk.addListener(
			"onActivityStopped",
			handleActivityStopped
		);

		return () => {
			appStateSubscription?.remove();
			connectedSubscription?.remove();
			disconnectedSubscription?.remove();
			activityStoppedSubscription?.remove();
		};
	}, [appState, accessToken]);

	// --- Cache Management Functions ---
	const loadCachedData = useCallback(async () => {
		console.log("AuthContext: Loading cached data for offline support...");
		try {
			// Load cached playlists
			const cachedPlaylists = await AsyncStorage.getItem(PLAYLISTS_KEY);
			if (cachedPlaylists) {
				const parsedPlaylists = JSON.parse(cachedPlaylists);
				setPlaylists(parsedPlaylists);
				console.log(
					`AuthContext: Loaded ${parsedPlaylists.length} cached playlists`
				);
			}

			// Load cached albums
			const cachedAlbums = await AsyncStorage.getItem(ALBUMS_KEY);
			if (cachedAlbums) {
				const parsedAlbums = JSON.parse(cachedAlbums);
				setAlbums(parsedAlbums);
				console.log(
					`AuthContext: Loaded ${parsedAlbums.length} cached albums`
				);
			}

			// Load cached saved tracks
			const cachedSavedTracks = await AsyncStorage.getItem(
				SAVED_TRACKS_KEY
			);
			if (cachedSavedTracks) {
				const parsedTracks = JSON.parse(cachedSavedTracks);
				setSavedTracks(parsedTracks);
				console.log(
					`AuthContext: Loaded ${parsedTracks.length} cached saved tracks`
				);
			}
		} catch (error) {
			console.error("AuthContext: Error loading cached data:", error);
		}
	}, []);

	const saveCachedData = useCallback(
		async (
			playlistsData?: SpotifyPlaylist[],
			albumsData?: SpotifySavedAlbum[],
			tracksData?: SavedTrackObject[]
		) => {
			try {
				if (playlistsData) {
					await AsyncStorage.setItem(
						PLAYLISTS_KEY,
						JSON.stringify(playlistsData)
					);
					console.log(
						`AuthContext: Cached ${playlistsData.length} playlists for offline use`
					);
				}
				if (albumsData) {
					await AsyncStorage.setItem(
						ALBUMS_KEY,
						JSON.stringify(albumsData)
					);
					console.log(
						`AuthContext: Cached ${albumsData.length} albums for offline use`
					);
				}
				if (tracksData) {
					await AsyncStorage.setItem(
						SAVED_TRACKS_KEY,
						JSON.stringify(tracksData)
					);
					console.log(
						`AuthContext: Cached ${tracksData.length} saved tracks for offline use`
					);
				}
			} catch (error) {
				console.error("AuthContext: Error saving cached data:", error);
			}
		},
		[]
	);

	// Album art cache management
	const loadCachedAlbumArt = useCallback(
		async (albumId: string): Promise<SpotifyImage[] | null> => {
			try {
				const cachedAlbumArt = await AsyncStorage.getItem(
					ALBUM_ART_CACHE_KEY
				);
				if (cachedAlbumArt) {
					const albumArtCache = JSON.parse(cachedAlbumArt);
					return albumArtCache[albumId] || null;
				}
			} catch (error) {
				console.error(
					"AuthContext: Error loading cached album art:",
					error
				);
			}
			return null;
		},
		[]
	);

	const saveCachedAlbumArt = useCallback(
		async (albumId: string, images: SpotifyImage[]) => {
			try {
				const cachedAlbumArt = await AsyncStorage.getItem(
					ALBUM_ART_CACHE_KEY
				);
				const albumArtCache = cachedAlbumArt
					? JSON.parse(cachedAlbumArt)
					: {};
				albumArtCache[albumId] = images;
				await AsyncStorage.setItem(
					ALBUM_ART_CACHE_KEY,
					JSON.stringify(albumArtCache)
				);
			} catch (error) {
				console.error(
					"AuthContext: Error saving cached album art:",
					error
				);
			}
		},
		[]
	);

	const clearCachedData = useCallback(async () => {
		console.log("AuthContext: Clearing cached data...");
		try {
			await AsyncStorage.removeItem(PLAYLISTS_KEY);
			await AsyncStorage.removeItem(ALBUMS_KEY);
			await AsyncStorage.removeItem(SAVED_TRACKS_KEY);
			await AsyncStorage.removeItem(ALBUM_ART_CACHE_KEY);
			console.log("AuthContext: Cached data cleared successfully");
		} catch (error) {
			console.error("AuthContext: Error clearing cached data:", error);
		}
	}, []);

	// Remove the useAuthRequest hook as we'll use native authentication
	useEffect(() => {
		console.log(
			"AuthContext: Using native Spotify SDK authentication with redirect URI:",
			REDIRECT_URI
		);
	}, []);

	// Function to refresh the access token - Updated for native SDK
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
				// For native SDK, we'll need to check if the stored token is still valid
				// and re-authenticate if needed. The native SDK handles token management internally.
				const isLoggedIn = await SpotifySdk.isUserLoggedIn();
				if (isLoggedIn) {
					const token = await SpotifySdk.getAccessToken();
					if (token) {
						setAccessToken(token);
						await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
						// Set token expiry to 45 minutes from now
						const expiryTime = Date.now() + 45 * 60 * 1000;
						setTokenExpiry(expiryTime);
						await SecureStore.setItemAsync(
							TOKEN_EXPIRY_KEY,
							expiryTime.toString()
						);
						console.log(
							"AuthContext: Access token refreshed successfully from native SDK."
						);
						return true;
					}
				}

				// If no valid token, clear everything and require re-authentication
				console.log(
					"AuthContext: No valid token from native SDK, clearing session."
				);
				await SpotifySdk.clearSession();
				setAccessToken(null);
				setRefreshToken(null);
				setUser(null);
				setTokenExpiry(null);
				await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
				await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
				await SecureStore.deleteItemAsync(USER_INFO_KEY);
				await SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY);
				return false;
			} catch (error) {
				console.error(
					"AuthContext: Error during token refresh:",
					error
				);
				// Clear tokens and user data
				await SpotifySdk.clearSession();
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

	const logout = useCallback(async () => {
		console.log("Logging out...");
		// Disable auto-connect and clear native SDK session
		try {
			await SpotifySdk.enableAutoConnect(false);
			await SpotifySdk.disconnect();
			await SpotifySdk.clearSession();
		} catch (error) {
			console.error("Error clearing native SDK session:", error);
		}

		await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
		await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
		await SecureStore.deleteItemAsync(USER_INFO_KEY);

		// Clear cached data
		await clearCachedData();

		setAccessToken(null);
		setRefreshToken(null);
		setUser(null);
		setPlaylists(null);
		setPlaylistsNextUrl(null);
		setAlbums(null);
		setAlbumsNextUrl(null);
		setSavedTracks(null);
		setSavedTracksNextUrl(null);
		setIsConnectedToAppRemote(false); // Reset connection state
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
		clearCachedData,
	]);

	useEffect(() => {
		const loadStoredAuth = async () => {
			try {
				// First check if user is logged in via native SDK
				const isLoggedIn = await SpotifySdk.isUserLoggedIn();
				if (isLoggedIn) {
					const token = await SpotifySdk.getAccessToken();
					if (token) {
						setAccessToken(token);
						await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
						// Set token expiry to 45 minutes from now
						const expiryTime = Date.now() + 45 * 60 * 1000;
						setTokenExpiry(expiryTime);
						await SecureStore.setItemAsync(
							TOKEN_EXPIRY_KEY,
							expiryTime.toString()
						);

						// Enable auto-connect for proper lifecycle management
						console.log(
							"AuthContext: Found stored token, enabling auto-connect"
						);
						SpotifySdk.enableAutoConnect(true);

						// CACHE-FIRST STRATEGY: Load cached data immediately for instant UI
						await loadCachedData();
						setIsLoading(false); // Show UI with cached data immediately

						// Fetch fresh data in background and update cache
						console.log(
							"AuthContext: Loading fresh data in background..."
						);
						await fetchUserInfo(token);
						return;
					}
				}

				// Fallback to checking stored tokens
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

						// CACHE-FIRST STRATEGY: Load cached data immediately
						await loadCachedData();
						setIsLoading(false); // Show UI with cached data

						// Fetch fresh data in background
						console.log(
							"AuthContext: Loading fresh data in background..."
						);
						await _fetchInitialPlaylists(storedToken);
					} else if (storedRefreshToken) {
						// Token expired or about to expire, refresh it
						const refreshed = await refreshAccessToken(
							storedRefreshToken
						);
						if (!refreshed) {
							await logout();
						}
					}
				} else {
					// No stored auth, load any cached data and ensure we're logged out
					await loadCachedData();
					await logout();
				}
			} catch (e) {
				console.error("Failed to load auth state:", e);
				// Still try to load cached data even if auth fails
				await loadCachedData();
				await logout();
			} finally {
				// Ensure loading is false even if something goes wrong
				if (isLoading) {
					setIsLoading(false);
				}
			}
		};
		loadStoredAuth();
	}, [refreshAccessToken, logout, loadCachedData, isLoading]);

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
			// Cache the playlists for offline use
			await saveCachedData(data.items, undefined, undefined);
		} else {
			// Handle error, maybe set playlists to an empty array or show a message
			setPlaylists([]); // Example: clear playlists on error
			setPlaylistsNextUrl(null);
		}
		setIsRefreshingPlaylists(false);
	}, [accessToken, makeApiRequest, saveCachedData]);

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
			// Cache the albums for offline use
			await saveCachedData(undefined, data.items, undefined);
		} else {
			setAlbums([]);
			setAlbumsNextUrl(null);
		}
		setIsRefreshingAlbums(false);
	}, [accessToken, makeApiRequest, saveCachedData]);

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
			// Cache the saved tracks for offline use
			await saveCachedData(undefined, undefined, data.items);
		} else {
			setSavedTracks([]);
			setSavedTracksNextUrl(null);
		}
		setIsRefreshingSavedTracks(false);
	}, [accessToken, makeApiRequest, saveCachedData]);

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
			deviceId?: string, // Keep for API compatibility but not used in native SDK
			contextUri?: string // Context URI for playlists/albums
		) => {
			console.log(
				`AuthContext: Playing track with hybrid approach: ${trackUri}`,
				{
					contextUri,
					hasContext: !!contextUri,
				}
			);

			try {
				// Ensure we're connected to App Remote
				let connected = await ensureAppRemoteConnection();

				// If connection failed, try one more time (important for offline scenarios)
				if (!connected) {
					console.log(
						"AuthContext: First connection attempt failed, retrying..."
					);
					await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
					connected = await ensureAppRemoteConnection();
				}

				// If still not connected, try force connection as last resort
				if (!connected) {
					console.log(
						"AuthContext: Normal connection failed, trying force connection..."
					);
					connected = await forceAppRemoteConnection();
				}

				if (!connected) {
					console.error(
						"AuthContext: Cannot play - App Remote not connected after all attempts"
					);
					return;
				}

				// HYBRID APPROACH: Use Web API for context, Native SDK for control
				if (contextUri && accessToken) {
					console.log(
						`AuthContext: Using hybrid approach - Web API for context: ${contextUri}`
					);

					try {
						// Method 1: Use Web API to set context and start from specific track
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
									offset: {
										uri: trackUri, // Start from this specific track
									},
								}),
							}
						);

						if (response.ok) {
							console.log(
								"AuthContext: Successfully set context via Web API, now using Native SDK"
							);

							// Wait a moment for Spotify to process the context
							await new Promise((resolve) =>
								setTimeout(resolve, 500)
							);

							// Now use Native SDK for immediate control
							const playResult = await SpotifySdk.play();

							if (playResult.playing) {
								console.log(
									"AuthContext: Hybrid playback started successfully"
								);
							} else {
								console.log(
									"AuthContext: Context set via Web API, Native SDK play may be redundant"
								);
							}
							return;
						} else {
							console.log(
								"AuthContext: Web API context failed, falling back to Native SDK only"
							);
							throw new Error("Web API context failed");
						}
					} catch (webApiError: any) {
						console.log(
							"AuthContext: Web API error, using fallback method:",
							webApiError.message
						);

						// Method 2: Fallback - Aggressive context establishment with minimal wrong track audio
						try {
							console.log(
								`AuthContext: Fallback - Establishing context ${contextUri} with aggressive timing`
							);

							// Play the context to establish it (brief first track playback)
							const contextResult = await SpotifySdk.play(
								contextUri
							);

							if (contextResult.playing) {
								// Immediately pause to minimize wrong track audio (within ~50ms)
								await SpotifySdk.pause();
								console.log(
									"AuthContext: Context established and immediately paused"
								);

								// Queue the target track immediately
								await SpotifySdk.addToQueue(trackUri);

								// Skip to the queued track (no delay)
								await SpotifySdk.skipNext();

								// Resume playback of the correct track
								await SpotifySdk.play();

								console.log(
									"AuthContext: Context maintained with minimal wrong track audio"
								);
							} else {
								throw new Error("Context playback failed");
							}
						} catch (fallbackError: any) {
							console.log(
								"AuthContext: Fallback method failed, using direct track play:",
								fallbackError.message
							);

							// Method 3: Last resort - Direct track play (no context)
							const playResult = await SpotifySdk.play(trackUri);

							if (playResult.playing) {
								console.log(
									"AuthContext: Direct track playback started (no context)"
								);
							}
						}
					}
				} else {
					// No context provided or no access token - direct track play
					console.log(
						`AuthContext: Playing individual track directly: ${trackUri}`
					);
					const playResult = await SpotifySdk.play(trackUri);

					if (playResult.playing) {
						console.log(
							"AuthContext: Native SDK direct playback started successfully"
						);
					} else {
						console.error(
							"AuthContext: Native SDK reported playback failed"
						);
					}
				}
			} catch (error: any) {
				console.error(
					"AuthContext: Error with hybrid playback approach:",
					error
				);

				// If playback failed, the connection might be stale - reset connection state
				setIsConnectedToAppRemote(false);
			}
		},
		[ensureAppRemoteConnection, forceAppRemoteConnection, accessToken]
	);

	const searchItems = async (
		query: string,
		types: string[]
	): Promise<SpotifySearchResults | null> => {
		if (!accessToken) {
			console.error("AuthContext: Cannot search, no access token.");
			return null;
		}
		if (!query.trim()) {
			console.error("AuthContext: Search query cannot be empty.");
			return null;
		}
		const typeString = types.join(",");
		const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(
			query
		)}&type=${encodeURIComponent(typeString)}&limit=10`; // Limit to 10 for each type for now

		console.log(
			`AuthContext: Searching for "${query}" (types: ${typeString})`
		);
		const data = await makeApiRequest(url, "Search Results");
		return data as SpotifySearchResults | null;
	};

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

	// --- Authentication Flow - Updated for Native SDK ---
	const login = useCallback(async () => {
		setIsLoading(true);
		try {
			console.log(
				"AuthContext: Starting native Spotify authentication..."
			);

			// Use native SDK token-based authorization (recommended for mobile)
			const authResult = await SpotifySdk.authorizeWithToken(
				SPOTIFY_CLIENT_ID,
				REDIRECT_URI,
				SPOTIFY_SCOPES
			);

			console.log("AuthContext: Authentication result:", authResult);

			if (authResult.success && authResult.data?.accessToken) {
				const accessToken = authResult.data.accessToken;
				setAccessToken(accessToken);
				await SecureStore.setItemAsync(AUTH_TOKEN_KEY, accessToken);

				// Set token expiry - native SDK handles expiry internally, use default 45 minutes
				const expiryTime = Date.now() + 45 * 60 * 1000; // 45 minutes default
				setTokenExpiry(expiryTime);
				await SecureStore.setItemAsync(
					TOKEN_EXPIRY_KEY,
					expiryTime.toString()
				);

				// Enable auto-connect for proper lifecycle management
				console.log(
					"AuthContext: Successfully authenticated, enabling auto-connect"
				);
				SpotifySdk.enableAutoConnect(true);

				// Native SDK handles refresh tokens internally, so we don't need to store them
				console.log(
					"AuthContext: Successfully authenticated with native SDK"
				);

				// Fetch user info after successful authentication
				await fetchUserInfo(accessToken);
			} else {
				console.error(
					"AuthContext: Authentication failed:",
					authResult.error || "Unknown error"
				);
				setIsLoading(false);
			}
		} catch (error) {
			console.error(
				"AuthContext: Error during native authentication:",
				error
			);
			setIsLoading(false);
		}
	}, []);

	const getPlaybackState =
		async (): Promise<SpotifyCurrentlyPlaying | null> => {
			try {
				// Use native SDK instead of Web API for offline compatibility
				const connected = await ensureAppRemoteConnection();
				if (!connected) {
					console.log(
						"AuthContext: Cannot get playback state - App Remote not connected"
					);
					return null;
				}

				const playerState = await SpotifySdk.getPlayerState();
				if (!playerState || !playerState.track) {
					console.log(
						"AuthContext: No player state or track available"
					);
					return null;
				}

				// Get album art - try native SDK first for better offline support
				let albumImages: SpotifyImage[] = [];

				const albumId = playerState.track.album.uri.split(":").pop();
				if (albumId) {
					// First, try to load from cache for offline support
					const cachedImages = await loadCachedAlbumArt(albumId);
					if (cachedImages) {
						albumImages = cachedImages;
					} else {
						// Try native SDK first (works offline)
						try {
							const nativeImageUrl = await SpotifySdk.getImage(
								playerState.track.album.uri,
								"LARGE"
							);
							if (
								nativeImageUrl &&
								nativeImageUrl.startsWith("data:image/")
							) {
								// Native SDK returned a data URI
								albumImages = [
									{
										url: nativeImageUrl,
										height: 640,
										width: 640,
									},
								];
								// Cache the native image for offline use
								await saveCachedAlbumArt(albumId, albumImages);
							} else {
								throw new Error(
									"Native SDK did not return valid image data"
								);
							}
						} catch (nativeError) {
							// If native SDK fails, try Web API as fallback
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
											// Cache the Web API images for offline use
											await saveCachedAlbumArt(
												albumId,
												albumImages
											);
										}
									}
								} catch (webApiError) {
									// Both native SDK and Web API failed - no album art available
								}
							}
						}
					}
				}

				// Convert native SDK player state to Web API format for compatibility
				const convertedState: SpotifyCurrentlyPlaying = {
					timestamp: Date.now(),
					context: null, // Native SDK doesn't provide context in the same format
					progress_ms: playerState.playbackPosition,
					is_playing: !playerState.isPaused,
					item: {
						// Convert native track to Web API track format
						artists: [
							{
								external_urls: { spotify: "" },
								href: "",
								id:
									playerState.track.artist.uri
										.split(":")
										.pop() || "",
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
							id:
								playerState.track.album.uri.split(":").pop() ||
								"",
							images: albumImages, // HTTP URLs from Web API or empty array
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
										playerState.track.artist.uri
											.split(":")
											.pop() || "",
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
							? "context"
							: "track",
				};

				return convertedState;
			} catch (error) {
				console.log(
					"AuthContext: Error getting playback state from native SDK (normal if nothing playing):",
					error
				);
				return null;
			}
		};

	const startPlayback = async () => {
		try {
			const connected = await ensureAppRemoteConnection();
			if (!connected) {
				console.error(
					"AuthContext: Cannot start playback - App Remote not connected"
				);
				return;
			}

			const result = await SpotifySdk.resume();
			if (result.resumed) {
				console.log("AuthContext: Playback resumed via native SDK");
			} else {
				console.error("AuthContext: Failed to resume playback");
			}
		} catch (error) {
			console.error("AuthContext: Error starting playback:", error);
		}
	};

	const pausePlayback = async () => {
		try {
			const connected = await ensureAppRemoteConnection();
			if (!connected) {
				console.error(
					"AuthContext: Cannot pause playback - App Remote not connected"
				);
				return;
			}

			const result = await SpotifySdk.pause();
			if (result.paused) {
				console.log("AuthContext: Playback paused via native SDK");
			} else {
				console.error("AuthContext: Failed to pause playback");
			}
		} catch (error) {
			console.error("AuthContext: Error pausing playback:", error);
		}
	};

	const skipToNext = async () => {
		try {
			const connected = await ensureAppRemoteConnection();
			if (!connected) {
				console.error(
					"AuthContext: Cannot skip - App Remote not connected"
				);
				return;
			}

			const result = await SpotifySdk.skipNext();
			if (result.skipped) {
				console.log(
					"AuthContext: Skipped to next track via native SDK"
				);
			} else {
				console.error("AuthContext: Failed to skip to next track");
			}
		} catch (error) {
			console.error("AuthContext: Error skipping to next track:", error);
		}
	};

	const skipToPrevious = async () => {
		try {
			const connected = await ensureAppRemoteConnection();
			if (!connected) {
				console.error(
					"AuthContext: Cannot skip to previous - App Remote not connected"
				);
				return;
			}

			const result = await SpotifySdk.skipPrevious();
			if (result.skipped) {
				console.log(
					"AuthContext: Skipped to previous track via native SDK"
				);
			} else {
				console.error("AuthContext: Failed to skip to previous track");
			}
		} catch (error) {
			console.error(
				"AuthContext: Error skipping to previous track:",
				error
			);
		}
	};

	const toggleShuffle = async (state: boolean) => {
		try {
			const connected = await ensureAppRemoteConnection();
			if (!connected) {
				console.error(
					"AuthContext: Cannot toggle shuffle - App Remote not connected"
				);
				return;
			}

			const result = await SpotifySdk.setShuffle(state);
			if (result.shuffleSet) {
				console.log(
					`AuthContext: Shuffle set to ${state} via native SDK`
				);
			} else {
				console.error("AuthContext: Failed to toggle shuffle");
			}
		} catch (error) {
			console.error("AuthContext: Error toggling shuffle:", error);
		}
	};

	const toggleRepeat = async (state: "off" | "track") => {
		try {
			const connected = await ensureAppRemoteConnection();
			if (!connected) {
				console.error(
					"AuthContext: Cannot toggle repeat - App Remote not connected"
				);
				return;
			}

			// Convert state to repeat mode number (0: off, 1: context, 2: track)
			const repeatMode = state === "off" ? 0 : 2; // track repeat
			const result = await SpotifySdk.setRepeat(repeatMode);
			if (result.repeatSet) {
				console.log(
					`AuthContext: Repeat set to ${state} (mode: ${repeatMode}) via native SDK`
				);
			} else {
				console.error("AuthContext: Failed to toggle repeat");
			}
		} catch (error) {
			console.error("AuthContext: Error toggling repeat:", error);
		}
	};

	const seekToPosition = async (positionMs: number) => {
		try {
			const connected = await ensureAppRemoteConnection();
			if (!connected) {
				console.error(
					"AuthContext: Cannot seek - App Remote not connected"
				);
				return;
			}

			console.log(
				`AuthContext: Seeking to ${positionMs}ms via native SDK`
			);
			const result = await SpotifySdk.seekTo(positionMs);
			if (result.seeked) {
				console.log("AuthContext: Seek completed via native SDK");
			} else {
				console.error("AuthContext: Failed to seek to position");
			}
		} catch (error) {
			console.error("AuthContext: Error seeking to position:", error);
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
			// Cache the playlists for offline use
			await saveCachedData(data.items, undefined, undefined);
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
			// Cache the albums for offline use
			await saveCachedData(undefined, data.items, undefined);
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
			// Cache the saved tracks for offline use
			await saveCachedData(undefined, undefined, data.items);
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

	const getCurrentTrack = async () => {
		try {
			const connected = await ensureAppRemoteConnection();
			if (!connected) {
				console.log(
					"AuthContext: Cannot get current track - App Remote not connected"
				);
				return null;
			}

			const playerState = await SpotifySdk.getPlayerState();
			if (!playerState || !playerState.track) {
				console.log("AuthContext: No current track available");
				return null;
			}

			console.log(
				"AuthContext: Got current track from native SDK:",
				playerState.track.name
			);

			// Return enhanced track with album art
			return {
				...playerState.track,
				albumArt: playerState.track.imageUri, // Direct album art URL
				position: playerState.playbackPosition,
				isPaused: playerState.isPaused,
				isShuffling: playerState.playbackOptions.isShuffling,
				repeatMode: playerState.playbackOptions.repeatMode,
			};
		} catch (error) {
			console.log(
				"AuthContext: Error getting current track from native SDK:",
				error
			);
			return null;
		}
	};

	const getAlbumArt = async (
		uri?: string,
		size: string = "LARGE"
	): Promise<string | null> => {
		try {
			const connected = await ensureAppRemoteConnection();
			if (!connected) {
				console.log(
					"AuthContext: Cannot get album art - App Remote not connected"
				);
				return null;
			}

			// If no URI provided, get current track's album art
			if (!uri) {
				const playerState = await SpotifySdk.getPlayerState();
				if (!playerState || !playerState.track) {
					console.log("AuthContext: No current track for album art");
					return null;
				}
				uri = playerState.track.album.uri;
			}

			// Use native SDK to get high-quality album art
			const imageUrl = await SpotifySdk.getImage(uri, size);
			console.log("AuthContext: Got album art from native SDK");
			return imageUrl;
		} catch (error) {
			console.log(
				"AuthContext: Error getting album art from native SDK:",
				error
			);
			return null;
		}
	};

	// Helper function to build context URIs for different scenarios
	const buildContextUri = useCallback(
		(trackUri: string, sourceContext?: any): string | null => {
			// If explicit context is provided, use it
			if (sourceContext && typeof sourceContext === "string") {
				return sourceContext;
			}

			// Try to determine context from the track's source
			if (sourceContext?.type === "album") {
				return sourceContext.uri;
			}

			if (sourceContext?.type === "playlist") {
				return sourceContext.uri;
			}

			// For saved tracks, we can't reliably create a context since
			// "liked songs" isn't a real playlist URI that works with play()
			// Instead, we'll use the queue method
			return null;
		},
		[]
	);

	// Album save/remove functions
	const saveAlbum = useCallback(
		async (albumId: string): Promise<boolean> => {
			if (!accessToken) {
				console.warn("Cannot save album - no access token available");
				return false;
			}

			try {
				const response = await fetch(
					`https://api.spotify.com/v1/me/albums?ids=${albumId}`,
					{
						method: "PUT",
						headers: {
							Authorization: `Bearer ${accessToken}`,
							"Content-Type": "application/json",
						},
					}
				);

				if (response.ok) {
					console.log(`Album ${albumId} saved successfully`);
					// Update local cache to reflect the change
					try {
						// First, we need to get the album details to add to cache
						const albumResponse = await fetch(
							`https://api.spotify.com/v1/albums/${albumId}`,
							{
								headers: {
									Authorization: `Bearer ${accessToken}`,
								},
							}
						);

						if (albumResponse.ok) {
							const albumData = await albumResponse.json();
							const cachedAlbums = await AsyncStorage.getItem(
								ALBUMS_KEY
							);
							let parsedAlbums = cachedAlbums
								? JSON.parse(cachedAlbums)
								: [];

							// Add the new saved album to the beginning of the cache
							const newSavedAlbum = {
								added_at: new Date().toISOString(),
								album: albumData,
							};
							parsedAlbums.unshift(newSavedAlbum);

							await AsyncStorage.setItem(
								ALBUMS_KEY,
								JSON.stringify(parsedAlbums)
							);
							setAlbums(parsedAlbums);
							console.log(
								`Updated cached albums: added album ${albumId}`
							);
						}
					} catch (cacheError) {
						console.error(
							"Error updating albums cache:",
							cacheError
						);
						// If cache update fails, fall back to full refresh
						await fetchAlbums();
					}
					return true;
				} else {
					const errorData = await response.json();
					console.error("Failed to save album:", errorData);
					return false;
				}
			} catch (error) {
				console.error("Error saving album:", error);
				return false;
			}
		},
		[accessToken, fetchAlbums]
	);

	const removeAlbum = useCallback(
		async (albumId: string): Promise<boolean> => {
			if (!accessToken) {
				console.warn("Cannot remove album - no access token available");
				return false;
			}

			try {
				const response = await fetch(
					`https://api.spotify.com/v1/me/albums?ids=${albumId}`,
					{
						method: "DELETE",
						headers: {
							Authorization: `Bearer ${accessToken}`,
							"Content-Type": "application/json",
						},
					}
				);

				if (response.ok) {
					console.log(`Album ${albumId} removed successfully`);
					// Update cached albums to remove the deleted album
					try {
						const cachedAlbums = await AsyncStorage.getItem(
							ALBUMS_KEY
						);
						if (cachedAlbums) {
							let parsedAlbums = JSON.parse(cachedAlbums);
							parsedAlbums = parsedAlbums.filter(
								(savedAlbum: any) =>
									savedAlbum.album?.id !== albumId
							);
							await AsyncStorage.setItem(
								ALBUMS_KEY,
								JSON.stringify(parsedAlbums)
							);
							setAlbums(parsedAlbums);
							console.log(
								`Updated cached albums: removed album ${albumId}`
							);
						}
					} catch (cacheError) {
						console.error(
							"Error updating albums cache:",
							cacheError
						);
					}
					return true;
				} else {
					const errorData = await response.json();
					console.error("Failed to remove album:", errorData);
					return false;
				}
			} catch (error) {
				console.error("Error removing album:", error);
				return false;
			}
		},
		[accessToken]
	);

	const checkIfAlbumIsSaved = useCallback(
		async (albumId: string): Promise<boolean> => {
			// First, check cached saved albums (works offline)
			try {
				const cachedSavedAlbums = await AsyncStorage.getItem(
					ALBUMS_KEY
				);
				if (cachedSavedAlbums) {
					const parsedAlbums = JSON.parse(cachedSavedAlbums);
					const isAlbumInCache = parsedAlbums.some(
						(savedAlbum: any) => savedAlbum.album?.id === albumId
					);
					if (isAlbumInCache) {
						console.log(
							`Album ${albumId} found in offline cache - it's saved`
						);
						return true;
					}
				}
			} catch (error) {
				console.error("Error checking cached saved albums:", error);
			}

			// Only make API call if we have access token and the album wasn't found in cache
			if (!accessToken) {
				// No access token and not in cache - assume not saved
				return false;
			}

			try {
				const response = await fetch(
					`https://api.spotify.com/v1/me/albums/contains?ids=${albumId}`,
					{
						headers: {
							Authorization: `Bearer ${accessToken}`,
						},
					}
				);
				if (!response.ok) {
					console.error(
						"Failed to check if album is saved",
						await response.json()
					);
					return false;
				}
				const data: boolean[] = await response.json();
				if (data && data.length > 0) {
					console.log(
						`Album ${albumId} API check - saved: ${data[0]}`
					);
					return data[0];
				}
				return false;
			} catch (error) {
				console.log(
					"Error checking if album is saved (likely offline):",
					error
				);
				return false;
			}
		},
		[accessToken]
	);

	const refreshSavedAlbumsFromCache = useCallback(async () => {
		try {
			const cachedSavedAlbums = await AsyncStorage.getItem(ALBUMS_KEY);
			if (cachedSavedAlbums) {
				const parsedAlbums = JSON.parse(cachedSavedAlbums);
				setAlbums(parsedAlbums);
				console.log(
					`AuthContext: Refreshed saved albums state from cache - ${parsedAlbums.length} albums`
				);
			}
		} catch (error) {
			console.error(
				"AuthContext: Error refreshing saved albums from cache:",
				error
			);
		}
	}, []);

	// Function to refresh saved tracks state from cache
	const refreshSavedTracksFromCache = useCallback(async () => {
		try {
			const cachedSavedTracks = await AsyncStorage.getItem(
				SAVED_TRACKS_KEY
			);
			if (cachedSavedTracks) {
				const parsedTracks = JSON.parse(cachedSavedTracks);
				setSavedTracks(parsedTracks);
				console.log(
					`AuthContext: Refreshed saved tracks state from cache - ${parsedTracks.length} tracks`
				);
			}
		} catch (error) {
			console.error(
				"AuthContext: Error refreshing saved tracks from cache:",
				error
			);
		}
	}, []);

	// Enhanced playback function for different source types
	const playTrackWithContext = useCallback(
		async (
			trackUri: string,
			sourceContext?: {
				type: "album" | "playlist" | "liked" | "artist";
				uri?: string;
				tracks?: any[];
				currentIndex?: number;
			}
		) => {
			console.log("AuthContext: Enhanced playback with context:", {
				trackUri,
				sourceContext,
			});

			try {
				const connected = await ensureAppRemoteConnection();
				if (!connected) {
					console.error("AuthContext: Cannot play - not connected");
					return;
				}

				// Handle different source types
				switch (sourceContext?.type) {
					case "album":
					case "playlist":
						if (sourceContext.uri) {
							// Use the hybrid approach with Web API context
							await playTrack(
								trackUri,
								undefined,
								sourceContext.uri
							);
							return;
						}
						break;

					case "liked":
						// For liked songs, build a queue from the available tracks
						if (
							sourceContext.tracks &&
							sourceContext.currentIndex !== undefined
						) {
							console.log(
								"AuthContext: Building queue for liked songs"
							);

							// Play the target track first
							const playResult = await SpotifySdk.play(trackUri);

							if (playResult.playing) {
								// Queue subsequent tracks for skip-next functionality
								const tracksToQueue =
									sourceContext.tracks.slice(
										sourceContext.currentIndex + 1,
										sourceContext.currentIndex + 10
									); // Queue next 10 tracks

								for (const track of tracksToQueue) {
									try {
										await SpotifySdk.addToQueue(
											track.track?.uri || track.uri
										);
									} catch (queueError) {
										console.log(
											"AuthContext: Queue error (continuing):",
											queueError
										);
									}
								}

								console.log(
									`AuthContext: Queued ${tracksToQueue.length} tracks for context`
								);
							}
							return;
						}
						break;

					case "artist":
						// For artist context, we could queue popular tracks
						console.log(
							"AuthContext: Artist context - using direct play"
						);
						await playTrack(trackUri);
						return;

					default:
						// Fallback to direct track play
						console.log(
							"AuthContext: Unknown context type, playing directly"
						);
						await playTrack(trackUri);
						return;
				}
			} catch (error: any) {
				console.error(
					"AuthContext: Error in enhanced playback:",
					error
				);
				// Fallback to simple play
				await playTrack(trackUri);
			}
		},
		[playTrack, ensureAppRemoteConnection]
	);

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
		isConnectedToAppRemote,
		login,
		logout,
		fetchPlaylists,
		fetchAlbums,
		fetchSavedTracks,
		refreshSavedTracksFromCache,
		saveAlbum,
		removeAlbum,
		checkIfAlbumIsSaved,
		refreshSavedAlbumsFromCache,
		playTrack,
		playTrackWithContext,
		getPlaybackState,
		getCurrentTrack,
		getAlbumArt,
		startPlayback,
		pausePlayback,
		skipToNext,
		skipToPrevious,
		toggleShuffle,
		toggleRepeat,
		addTrackToPlaylist,
		seekToPosition,
		searchItems,
		clearCachedData,
		forceAppRemoteConnection,
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
