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
	"user-read-recently-played",
	"user-top-read",
	"playlist-read-private",
	"playlist-read-collaborative",
	"playlist-modify-public",
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

interface AuthContextType {
	accessToken: string | null;
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

	fetchPlaylists: () => Promise<void>; // For initial load / manual refresh of first page
	fetchAlbums: () => Promise<void>; // For initial load / manual refresh of first page
	fetchSavedTracks: () => Promise<void>; // For initial load / manual refresh of first page
	playTrack: (
		trackUri: string,
		deviceId?: string,
		contextUri?: string
	) => Promise<void>; // Added playTrack with optional contextUri
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = "spotifyAuthToken";
const USER_INFO_KEY = "spotifyUserInfo";
const PLAYLISTS_KEY = "spotifyPlaylists"; // For potential caching
const ALBUMS_KEY = "spotifyAlbums"; // For potential caching for saved albums
const SAVED_TRACKS_KEY = "spotifySavedTracks"; // For potential caching for saved tracks

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	const [accessToken, setAccessToken] = useState<string | null>(null);
	const [user, setUser] = useState<any | null>(null);

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

	useEffect(() => {
		const loadStoredAuth = async () => {
			try {
				const storedToken = await SecureStore.getItemAsync(
					AUTH_TOKEN_KEY
				);
				const storedUser = await SecureStore.getItemAsync(
					USER_INFO_KEY
				);
				if (storedToken) {
					setAccessToken(storedToken);
					if (storedUser) {
						setUser(JSON.parse(storedUser));
					}
					// Optionally, you could add a check here to see if the token is expired
					// and try to refresh it or log out.
				}
			} catch (e) {
				console.error("Failed to load auth state:", e);
			} finally {
				setIsLoading(false);
			}
		};
		loadStoredAuth();
	}, []);

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
			token: string,
			errorMessage: string,
			isRefreshing = false
		) => {
			if (!token) {
				console.error("No access token available for API request.");
				// Optionally, trigger re-authentication or inform the user
				// For now, just returning null to prevent further execution without a token
				return null;
			}
			if (isRefreshing)
				console.log(`Refreshing ${errorMessage.toLowerCase()}...`);

			try {
				const response = await fetch(url, {
					headers: {
						Authorization: `Bearer ${token}`,
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
					if (response.status === 401) {
						// Token expired or invalid, attempt to refresh or logout
						console.log(
							"Token might be expired. Consider implementing token refresh."
						);
						// logout(); // Or a more sophisticated token refresh mechanism
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
		[]
	);

	// --- Playlists ---
	const fetchPlaylists = useCallback(async () => {
		if (!accessToken) return;
		setIsRefreshingPlaylists(true);
		const data = await makeApiRequest(
			"https://api.spotify.com/v1/me/playlists?limit=50",
			accessToken,
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
		const data = await makeApiRequest(
			playlistsNextUrl,
			accessToken,
			"More Playlists"
		);
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
			accessToken,
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
		const data = await makeApiRequest(
			albumsNextUrl,
			accessToken,
			"More Albums"
		);
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
			accessToken,
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
			accessToken,
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
	const _getAvailableDeviceId = useCallback(
		async (token: string): Promise<string | null> => {
			console.log("AuthContext: Fetching available devices...");
			try {
				const response = await fetch(
					"https://api.spotify.com/v1/me/player/devices",
					{
						headers: { Authorization: `Bearer ${token}` },
					}
				);
				const data: SpotifyDevicesResponse = await response.json();
				if (!response.ok) {
					let errorMessage = response.status.toString();
					try {
						const errorData = data as any; // Cast to any to access potential error property
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
		},
		[]
	);

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

	const logout = useCallback(async () => {
		console.log("Logging out...");
		await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
		await SecureStore.deleteItemAsync(USER_INFO_KEY);
		setAccessToken(null);
		setUser(null);
		setPlaylists(null);
		setPlaylistsNextUrl(null);
		setAlbums(null);
		setAlbumsNextUrl(null);
		setSavedTracks(null);
		setSavedTracksNextUrl(null);
		setIsLoading(false); // Reset loading state
	}, []);

	const value = {
		accessToken,
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
		isLoading, // This is the global one
		isRefreshingPlaylists,
		isRefreshingAlbums,
		isRefreshingSavedTracks,
		login,
		logout,
		fetchPlaylists, // For initial load / manual refresh
		fetchAlbums, // For initial load / manual refresh
		fetchSavedTracks, // For initial load / manual refresh
		playTrack,
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
