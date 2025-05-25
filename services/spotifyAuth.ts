import * as SecureStore from "expo-secure-store";
import SpotifySdk from "../modules/spotify-sdk";
import {
	AUTH_TOKEN_KEY,
	REFRESH_TOKEN_KEY,
	USER_INFO_KEY,
	TOKEN_EXPIRY_KEY,
	SPOTIFY_CLIENT_ID,
	REDIRECT_URI,
	SPOTIFY_SCOPES,
} from "../constants/spotify";
import { clearCachedData } from "../utils/cache";
import { exchangeCodeForTokens } from "../services/tokenExchange";
import type {
	SpotifyPlaylistsResponse,
	SpotifySavedAlbumsResponse,
	SavedTracksResponse,
} from "../types/spotify";

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
		console.log(
			"Auth: Starting authentication with CODE flow via server..."
		);

		// Use CODE flow (server handles PKCE and token exchange)
		const authResult = await SpotifySdk.authorizeWithCode(
			SPOTIFY_CLIENT_ID,
			REDIRECT_URI,
			SPOTIFY_SCOPES,
			undefined, // state
			false // showDialog
			// No codeChallenge needed - server handles PKCE
		);

		if (authResult.success && authResult.data?.authorizationCode) {
			console.log(
				"Auth: Authorization code received, exchanging for tokens via server..."
			);

			// Exchange authorization code for access and refresh tokens via server
			const tokenResponse = await exchangeCodeForTokens(
				authResult.data.authorizationCode,
				"", // codeVerifier not needed for server exchange
				REDIRECT_URI // redirectUri not needed for server exchange but kept for compatibility
			);

			// Store tokens securely (refresh token is encrypted by server)
			await SecureStore.setItemAsync(
				AUTH_TOKEN_KEY,
				tokenResponse.access_token
			);
			await SecureStore.setItemAsync(
				REFRESH_TOKEN_KEY,
				tokenResponse.refresh_token
			);

			// Calculate and store token expiry (be conservative - use 50 minutes instead of full hour)
			const expiryTime =
				Date.now() + (tokenResponse.expires_in - 600) * 1000; // 10 minutes buffer
			await SecureStore.setItemAsync(
				TOKEN_EXPIRY_KEY,
				expiryTime.toString()
			);

			onTokenUpdate(
				tokenResponse.access_token,
				tokenResponse.refresh_token,
				expiryTime
			);

			// Small delay to allow authentication state to settle
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Enable auto-connect for proper lifecycle management
			SpotifySdk.enableAutoConnect(true);

			// Immediately establish App Remote connection after authentication
			try {
				console.log("Auth: Establishing App Remote connection...");
				const connectionResult = await SpotifySdk.connect(
					SPOTIFY_CLIENT_ID,
					REDIRECT_URI
				);
				if (connectionResult.connected) {
					console.log("Auth: App Remote connected successfully");
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

			console.log("Auth: Authentication successful with refresh token");
			// Fetch user info after successful authentication
			await fetchUserInfo(
				tokenResponse.access_token,
				onUserUpdate,
				fetchInitialData
			);
		} else {
			console.error(
				"Auth: Authentication failed:",
				authResult.error || "No authorization code received"
			);
			throw new Error(
				String(authResult.error) ||
					"Authentication failed - no authorization code"
			);
		}
	} catch (error) {
		console.error("Auth: Error during authentication:", error);
		throw error;
	}
};

export const logoutFromSpotify = async (
	clearState: () => void
): Promise<void> => {
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
			console.log("Auth: Found stored tokens, enabling auto-connect");
			await SpotifySdk.enableAutoConnect(true);

			// Immediately establish App Remote connection
			try {
				console.log(
					"Auth: Establishing App Remote connection for stored tokens..."
				);
				const connectionResult = await SpotifySdk.connect(
					SPOTIFY_CLIENT_ID,
					REDIRECT_URI
				);
				if (connectionResult.connected) {
					console.log(
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
		console.error("Auth: Error loading stored auth:", error);
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
	fetchInitialData: (token: string) => Promise<void>
) => {
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
		onUserUpdate(userData);
		await SecureStore.setItemAsync(USER_INFO_KEY, JSON.stringify(userData));
		// Start fetching other data after user info is successfully retrieved
		await fetchInitialData(token);
	} catch (error: any) {
		console.error("Auth: Error fetching user info:", error.message);
		throw error;
	}
};

export const fetchInitialDataInParallel = async (
	token: string,
	onPlaylistsUpdate: (playlists: any[], nextUrl: string | null) => void,
	onAlbumsUpdate: (albums: any[], nextUrl: string | null) => void,
	onSavedTracksUpdate: (tracks: any[], nextUrl: string | null) => void,
	saveCachedData: (
		playlists?: any[],
		albums?: any[],
		tracks?: any[]
	) => Promise<void>
) => {
	console.log("Auth: Loading user data...");

	const fetchPlaylists = async () => {
		try {
			const response = await fetch(
				"https://api.spotify.com/v1/me/playlists?limit=50",
				{
					headers: { Authorization: `Bearer ${token}` },
				}
			);
			const data: SpotifyPlaylistsResponse = await response.json();
			if (!response.ok) {
				throw new Error(
					`Failed to fetch playlists: ${response.status}`
				);
			}
			onPlaylistsUpdate(data.items, data.next);
			await saveCachedData(data.items, undefined, undefined);
		} catch (error: any) {
			console.error("Auth: Error fetching playlists:", error.message);
			onPlaylistsUpdate([], null);
		}
	};

	const fetchAlbums = async () => {
		try {
			const response = await fetch(
				"https://api.spotify.com/v1/me/albums?limit=50",
				{
					headers: { Authorization: `Bearer ${token}` },
				}
			);
			const data: SpotifySavedAlbumsResponse = await response.json();
			if (!response.ok) {
				throw new Error(`Failed to fetch albums: ${response.status}`);
			}
			onAlbumsUpdate(data.items, data.next);
			await saveCachedData(undefined, data.items, undefined);
		} catch (error: any) {
			console.error("Auth: Error fetching albums:", error.message);
			onAlbumsUpdate([], null);
		}
	};

	const fetchSavedTracks = async () => {
		try {
			const response = await fetch(
				"https://api.spotify.com/v1/me/tracks?limit=50",
				{
					headers: { Authorization: `Bearer ${token}` },
				}
			);
			const data: SavedTracksResponse = await response.json();
			if (!response.ok) {
				throw new Error(
					`Failed to fetch saved tracks: ${response.status}`
				);
			}
			onSavedTracksUpdate(data.items, data.next);
			await saveCachedData(undefined, undefined, data.items);
		} catch (error: any) {
			console.error("Auth: Error fetching saved tracks:", error.message);
			onSavedTracksUpdate([], null);
		}
	};

	try {
		// Execute all data fetches in parallel for faster loading
		await Promise.all([
			fetchPlaylists(),
			fetchAlbums(),
			fetchSavedTracks(),
		]);
		console.log("Auth: Data loaded successfully");
	} catch (error) {
		console.error("Auth: Error in parallel data fetching:", error);
	}
};
