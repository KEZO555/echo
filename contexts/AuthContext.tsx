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

interface AuthContextType {
	accessToken: string | null;
	user: any | null; // Replace 'any' with a more specific User type if you have one
	playlists: SpotifyPlaylist[] | null;
	isLoading: boolean;
	login: () => Promise<void>;
	logout: () => Promise<void>;
	fetchPlaylists: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = "spotifyAuthToken";
const USER_INFO_KEY = "spotifyUserInfo";
const PLAYLISTS_KEY = "spotifyPlaylists"; // For potential caching

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	const [accessToken, setAccessToken] = useState<string | null>(null);
	const [user, setUser] = useState<any | null>(null);
	const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null);
	const [isLoading, setIsLoading] = useState(true);

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
				setIsLoading(false);
			}
		} catch (e) {
			console.error("Failed to fetch token:", e);
			setIsLoading(false);
		}
	};

	const fetchUserInfo = async (token: string) => {
		setIsLoading(true); // Ensure loading is true at the start
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
			// After fetching user, fetch their playlists
			await fetchPlaylistsInternal(token);
		} catch (e) {
			console.error("Failed to fetch user info:", e);
		} finally {
			// setIsLoading(false); // Loading will be set to false after playlists are fetched or fail
		}
	};

	const fetchPlaylistsInternal = async (token: string) => {
		// Renamed to avoid conflict with exported fetchPlaylists
		if (!token) {
			setPlaylists(null);
			setIsLoading(false);
			return;
		}
		setIsLoading(true);
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
			// Optionally cache playlists
			// await SecureStore.setItemAsync(PLAYLISTS_KEY, JSON.stringify(playlistsData.items));
		} catch (e) {
			console.error("Failed to fetch playlists:", e);
			setPlaylists(null); // Clear playlists on error
		} finally {
			setIsLoading(false);
		}
	};

	// Exposed function for manual refresh if needed by components
	const fetchPlaylists = async () => {
		if (accessToken) {
			await fetchPlaylistsInternal(accessToken);
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
			setPlaylists(null); // Clear playlists on logout
			await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
			await SecureStore.deleteItemAsync(USER_INFO_KEY);
			// await SecureStore.deleteItemAsync(PLAYLISTS_KEY); // Clear cached playlists
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
				isLoading,
				login,
				logout,
				fetchPlaylists,
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
