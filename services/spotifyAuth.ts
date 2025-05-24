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
		console.log("Auth: Starting authentication...");

		// Use TOKEN flow (works without client secret) but implement smarter session management
		const authResult = await SpotifySdk.authorizeWithToken(
			SPOTIFY_CLIENT_ID,
			REDIRECT_URI,
			SPOTIFY_SCOPES
		);

		if (authResult.success && authResult.data?.accessToken) {
			const accessToken = authResult.data.accessToken;
			await SecureStore.setItemAsync(AUTH_TOKEN_KEY, accessToken);

			// Set token expiry to 50 minutes from now (be more conservative about expiry)
			const expiryTime = Date.now() + 50 * 60 * 1000;
			await SecureStore.setItemAsync(
				TOKEN_EXPIRY_KEY,
				expiryTime.toString()
			);

			onTokenUpdate(accessToken, undefined, expiryTime);

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

			console.log("Auth: Authentication successful");
			// Fetch user info after successful authentication
			await fetchUserInfo(accessToken, onUserUpdate, fetchInitialData);
		} else {
			console.error(
				"Auth: Authentication failed:",
				authResult.error || "Unknown error"
			);
			throw new Error(
				String(authResult.error) || "Authentication failed"
			);
		}
	} catch (error) {
		console.error("Auth: Error during native authentication:", error);
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
		// First check if user is logged in via native SDK
		const isLoggedIn = await SpotifySdk.isUserLoggedIn();
		if (isLoggedIn) {
			const token = await SpotifySdk.getAccessToken();
			if (token) {
				// Set token expiry to 50 minutes from now
				const expiryTime = Date.now() + 50 * 60 * 1000;
				await SecureStore.setItemAsync(
					TOKEN_EXPIRY_KEY,
					expiryTime.toString()
				);

				// Enable auto-connect for proper lifecycle management
				console.log("Auth: Found stored token, enabling auto-connect");
				await SpotifySdk.enableAutoConnect(true);

				// Immediately establish App Remote connection
				try {
					console.log(
						"Auth: Establishing App Remote connection for stored token..."
					);
					const connectionResult = await SpotifySdk.connect(
						SPOTIFY_CLIENT_ID,
						REDIRECT_URI
					);
					if (connectionResult.connected) {
						console.log(
							"Auth: App Remote connected successfully for stored token"
						);
					}
				} catch (connectionError) {
					console.warn(
						"Auth: App Remote connection error for stored token:",
						connectionError
					);
				}

				return {
					accessToken: token,
					refreshToken: null,
					user: null,
					tokenExpiry: expiryTime,
				};
			}
		}

		// Fallback to checking stored tokens
		const storedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
		const storedRefreshToken = await SecureStore.getItemAsync(
			REFRESH_TOKEN_KEY
		);
		const storedUser = await SecureStore.getItemAsync(USER_INFO_KEY);
		const storedExpiry = await SecureStore.getItemAsync(TOKEN_EXPIRY_KEY);

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
