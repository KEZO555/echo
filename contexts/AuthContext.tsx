import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

// 1. Spotify Configuration - REPLACE WITH YOUR ACTUAL CREDENTIALS
const SPOTIFY_CLIENT_ID = "2f20bc972e764706956ba7b59648b707";
const SPOTIFY_SCOPES = [
	"user-read-email",
	"user-library-read",
	"user-read-recently-played",
	"user-top-read",
	"playlist-read-private",
	"playlist-read-collaborative",
	"playlist-modify-public",
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

interface AuthContextType {
	accessToken: string | null;
	user: any | null;
	playlists: SpotifyPlaylist[] | null;
	albums: SpotifySavedAlbum[] | null;
	isLoading: boolean;
	isRefreshingPlaylists: boolean;
	isRefreshingAlbums: boolean;
	login: () => Promise<void>;
	logout: () => Promise<void>;
	fetchPlaylists: () => Promise<void>;
	fetchAlbums: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = "spotifyAuthToken";
const USER_INFO_KEY = "spotifyUserInfo";
const PLAYLISTS_KEY = "spotifyPlaylists"; // For potential caching

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	const [accessToken, setAccessToken] = useState<string | null>(null);
	const [user, setUser] = useState<any | null>(null);
	const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null);
	const [albums, setAlbums] = useState<SpotifySavedAlbum[] | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isRefreshingPlaylists, setIsRefreshingPlaylists] = useState(false);
	const [isRefreshingAlbums, setIsRefreshingAlbums] = useState(false);

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
		setIsLoading(true);
		try {
			const userInfoResponse = await fetch(
				"https://api.spotify.com/v1/me",
				{
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			);
			const userInfo = await userInfoResponse.json();
			setUser(userInfo);
			await SecureStore.setItemAsync(
				USER_INFO_KEY,
				JSON.stringify(userInfo)
			);
			// After fetching user, fetch their initial playlists then albums
			await _fetchInitialPlaylists(token);
			await _fetchInitialAlbumsAndUpdateGlobalLoading(token);
		} catch (e) {
			console.error(
				"Failed to fetch user info (or initial data failed to initiate properly):",
				e
			);
			setUser(null);
			setPlaylists(null);
			setAlbums(null);
			setIsLoading(false);
		}
	};

	// Renamed and modified: Only for initial playlist load, DOES NOT complete global loading.
	const _fetchInitialPlaylists = async (token: string) => {
		if (!token) {
			console.warn("_fetchInitialPlaylists called without a token.");
			setPlaylists(null);
			return;
		}
		try {
			const playlistsResponse = await fetch(
				"https://api.spotify.com/v1/me/playlists?limit=50",
				{
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			);
			if (!playlistsResponse.ok) {
				throw new Error(
					`Failed to fetch playlists: ${playlistsResponse.status}`
				);
			}
			const playlistsData: SpotifyPlaylistsResponse =
				await playlistsResponse.json();
			setPlaylists(playlistsData.items);
		} catch (e) {
			console.error("Failed to fetch initial playlists:", e);
			setPlaylists(null);
		}
	};

	// New function: For initial album load, completes global loading.
	const _fetchInitialAlbumsAndUpdateGlobalLoading = async (token: string) => {
		if (!token) {
			console.warn(
				"_fetchInitialAlbumsAndUpdateGlobalLoading called without a token."
			);
			setAlbums(null);
			setIsLoading(false);
			return;
		}
		try {
			const albumsResponse = await fetch(
				"https://api.spotify.com/v1/me/albums?limit=50",
				{
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			);
			if (!albumsResponse.ok) {
				throw new Error(
					`Failed to fetch saved albums: ${albumsResponse.status}`
				);
			}
			const albumsData: SpotifySavedAlbumsResponse =
				await albumsResponse.json();
			setAlbums(albumsData.items);
		} catch (e) {
			console.error("Failed to fetch initial saved albums:", e);
			setAlbums(null);
		} finally {
			setIsLoading(false);
		}
	};

	// Exposed function for manual playlist refresh - uses isRefreshingPlaylists
	const fetchPlaylists = async () => {
		if (!accessToken) {
			console.log("Cannot refresh playlists: No access token.");
			return;
		}
		setIsRefreshingPlaylists(true);
		try {
			const playlistsResponse = await fetch(
				"https://api.spotify.com/v1/me/playlists?limit=50",
				{
					headers: {
						Authorization: `Bearer ${accessToken}`,
					},
				}
			);
			if (!playlistsResponse.ok) {
				throw new Error(
					`Failed to fetch playlists: ${playlistsResponse.status}`
				);
			}
			const playlistsData: SpotifyPlaylistsResponse =
				await playlistsResponse.json();
			setPlaylists(playlistsData.items);
		} catch (e) {
			console.error("Failed to refresh playlists:", e);
		} finally {
			setIsRefreshingPlaylists(false);
		}
	};

	// Exposed function for manual album refresh - uses isRefreshingAlbums
	const fetchAlbums = async () => {
		if (!accessToken) {
			console.log("Cannot refresh albums: No access token.");
			return;
		}
		setIsRefreshingAlbums(true);
		try {
			const albumsResponse = await fetch(
				"https://api.spotify.com/v1/me/albums?limit=50",
				{
					headers: {
						Authorization: `Bearer ${accessToken}`,
					},
				}
			);
			if (!albumsResponse.ok) {
				throw new Error(
					`Failed to refresh saved albums: ${albumsResponse.status}`
				);
			}
			const albumsData: SpotifySavedAlbumsResponse =
				await albumsResponse.json();
			setAlbums(albumsData.items);
		} catch (e) {
			console.error("Failed to refresh saved albums:", e);
		} finally {
			setIsRefreshingAlbums(false);
		}
	};

	const login = async () => {
		if (!request) {
			console.log("Auth request not ready yet");
			return;
		}
		setIsLoading(true);
		await promptAsync();
		// The useEffect hook for 'response' will handle the rest
	};

	const logout = async () => {
		try {
			setAccessToken(null);
			setUser(null);
			setPlaylists(null);
			setAlbums(null);
			await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
			await SecureStore.deleteItemAsync(USER_INFO_KEY);
			// await SecureStore.deleteItemAsync(PLAYLISTS_KEY);
		} catch (e) {
			console.error("Failed to logout:", e);
		}
	};

	return (
		<AuthContext.Provider
			value={{
				accessToken,
				user,
				playlists,
				albums,
				isLoading,
				isRefreshingPlaylists,
				isRefreshingAlbums,
				login,
				logout,
				fetchPlaylists,
				fetchAlbums,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
};
