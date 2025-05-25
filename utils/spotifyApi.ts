import * as SecureStore from "expo-secure-store";
import {
	AUTH_TOKEN_KEY,
	REFRESH_TOKEN_KEY,
	USER_INFO_KEY,
	TOKEN_EXPIRY_KEY,
	SPOTIFY_CLIENT_ID,
} from "../constants/spotify";
import { clearCachedData } from "./cache";
import { refreshAccessToken as refreshTokenService } from "../services/tokenExchange";

export const makeApiRequest = async (
	url: string,
	errorMessage: string,
	accessToken: string | null,
	refreshToken: string | null,
	tokenExpiry: number | null,
	onTokenUpdate: (
		accessToken: string,
		refreshToken?: string,
		expiry?: number
	) => void,
	onLogout: () => Promise<void>,
	isRefreshing = false,
	retryCount = 0,
	options?: {
		method?: string;
		body?: string;
		headers?: Record<string, string>;
	}
): Promise<any | null> => {
	// Check if token is about to expire (within 5 minutes) and refresh proactively
	if (accessToken && tokenExpiry && refreshToken && retryCount === 0) {
		const timeUntilExpiry = tokenExpiry - Date.now();
		if (timeUntilExpiry < 5 * 60 * 1000) {
			// Less than 5 minutes
			console.log("API: Token expires soon, refreshing proactively...");
			const refreshed = await refreshAccessToken(
				refreshToken,
				onTokenUpdate,
				onLogout
			);
			if (!refreshed) {
				console.log(
					"API: Proactive refresh failed, proceeding with current token"
				);
			}
		}
	}

	if (!accessToken) {
		console.error("No access token available for API request.");
		if (refreshToken) {
			console.log("Attempting to refresh token before API request...");
			const refreshed = await refreshAccessToken(
				refreshToken,
				onTokenUpdate,
				onLogout
			);
			if (refreshed) {
				// Retry the request once after successful refresh
				return makeApiRequest(
					url,
					errorMessage,
					accessToken,
					refreshToken,
					tokenExpiry,
					onTokenUpdate,
					onLogout,
					isRefreshing,
					1,
					options
				);
			} else {
				await onLogout();
				return null;
			}
		}
		return null;
	}

	if (isRefreshing)
		console.log(`Refreshing ${errorMessage.toLowerCase()}...`);

	try {
		const fetchOptions: RequestInit = {
			method: options?.method || "GET",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				...options?.headers,
			},
		};

		if (options?.body) {
			fetchOptions.body = options.body;
		}

		const response = await fetch(url, fetchOptions);
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
			if (response.status === 401 && retryCount < 1 && refreshToken) {
				console.log(
					"Token might be expired. Attempting to refresh token."
				);
				const refreshed = await refreshAccessToken(
					refreshToken,
					onTokenUpdate,
					onLogout
				);
				if (refreshed) {
					console.log(
						"Token refreshed successfully. Retrying API request."
					);
					return makeApiRequest(
						url,
						errorMessage,
						accessToken,
						refreshToken,
						tokenExpiry,
						onTokenUpdate,
						onLogout,
						isRefreshing,
						1,
						options
					);
				} else {
					console.log("Failed to refresh token. Logging out.");
					await onLogout();
					return null;
				}
			} else if (response.status === 401) {
				console.log(
					"Token is invalid even after refresh attempt or no refresh token. Logging out."
				);
				await onLogout();
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
};

export const refreshAccessToken = async (
	currentRefreshToken: string,
	onTokenUpdate: (
		accessToken: string,
		refreshToken?: string,
		expiry?: number
	) => void,
	onLogout: () => Promise<void>
): Promise<boolean> => {
	console.log("API: Attempting to refresh access token...");

	try {
		if (!currentRefreshToken) {
			console.log("API: No refresh token available");
			throw new Error("No refresh token available");
		}

		console.log("API: Using new token exchange service for refresh...");

		// Use the new token exchange service
		const tokenResponse = await refreshTokenService(currentRefreshToken);

		console.log("API: Access token refreshed successfully");

		// Update tokens in secure storage
		await SecureStore.setItemAsync(
			AUTH_TOKEN_KEY,
			tokenResponse.access_token
		);
		if (tokenResponse.refresh_token) {
			await SecureStore.setItemAsync(
				REFRESH_TOKEN_KEY,
				tokenResponse.refresh_token
			);
		}

		// Set token expiry with 10-minute buffer for safety
		const expiryTime = Date.now() + (tokenResponse.expires_in - 600) * 1000;
		await SecureStore.setItemAsync(TOKEN_EXPIRY_KEY, expiryTime.toString());

		onTokenUpdate(
			tokenResponse.access_token,
			tokenResponse.refresh_token,
			expiryTime
		);

		return true;
	} catch (error) {
		console.error("API: Error during token refresh:", error);

		// Clear invalid tokens and require re-authentication
		console.log(
			"API: Clearing invalid session, user needs to re-authenticate"
		);
		await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
		await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
		await SecureStore.deleteItemAsync(USER_INFO_KEY);
		await SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY);
		await onLogout();
		return false;
	}
};
