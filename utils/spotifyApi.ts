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
			console.log("API: Token expires soon, refreshing proactively...", {
				timeUntilExpiry,
			});
			try {
				const refreshed = await refreshAccessToken(
					refreshToken,
					onTokenUpdate,
					onLogout
				);
				if (refreshed) {
					// Get the updated token from secure storage after refresh
					const updatedToken = await SecureStore.getItemAsync(
						AUTH_TOKEN_KEY
					);
					console.log(
						"API: Proactive refresh successful, using updated token for current request"
					);
					// Use the updated token for this request
					accessToken = updatedToken;
				} else {
					console.warn(
						"API: Proactive refresh failed, proceeding with current token"
					);
				}
			} catch (error) {
				console.error(
					"API: Proactive refresh error, proceeding with current token:",
					error
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
				// Get the updated token from secure storage after refresh
				const updatedToken = await SecureStore.getItemAsync(
					AUTH_TOKEN_KEY
				);
				console.log(
					"API: Using updated token for retry after refresh",
					{
						hasUpdatedToken: !!updatedToken,
					}
				);
				// Retry the request once after successful refresh
				return makeApiRequest(
					url,
					errorMessage,
					updatedToken,
					refreshToken,
					tokenExpiry,
					onTokenUpdate,
					onLogout,
					isRefreshing,
					1,
					options
				);
			} else {
				console.warn(
					"No access token and refresh failed. The refreshAccessToken function already handled logout if needed."
				);
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
				console.warn(
					"Token might be expired. Attempting to refresh token.",
					{ url, status: response.status, retryCount }
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
					// Get the updated token from secure storage after refresh
					const updatedToken = await SecureStore.getItemAsync(
						AUTH_TOKEN_KEY
					);
					console.log(
						"API: Using updated token for retry after 401 refresh",
						{ hasUpdatedToken: !!updatedToken }
					);
					return makeApiRequest(
						url,
						errorMessage,
						updatedToken,
						refreshToken,
						tokenExpiry,
						onTokenUpdate,
						onLogout,
						isRefreshing,
						1,
						options
					);
				} else {
					console.error(
						"Failed to refresh token. The refreshAccessToken function already handled logout if needed."
					);
					return null;
				}
			} else if (response.status === 401) {
				console.error(
					"Token is invalid even after refresh attempt or no refresh token. Logging out.",
					{
						url,
						status: response.status,
						retryCount,
						hasRefreshToken: !!refreshToken,
					}
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
			console.error("API: No refresh token available");
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
			tokenResponse.refresh_token || currentRefreshToken, // Use existing refresh token if no new one provided
			expiryTime
		);

		return true;
	} catch (error) {
		console.error("API: Error during token refresh:", error);

		// Check if this is a network error vs an authentication error
		const isNetworkError =
			error instanceof TypeError ||
			(error as any)?.message?.includes("Network request failed") ||
			(error as any)?.message?.includes("fetch");

		if (isNetworkError) {
			console.log(
				"API: Network error during token refresh, will retry later"
			);
			// Don't logout on network errors - let the user try again
			return false;
		}

		// Clear invalid tokens and require re-authentication only for auth errors
		console.log(
			"API: Authentication error during token refresh, clearing session"
		);
		await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
		await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
		await SecureStore.deleteItemAsync(USER_INFO_KEY);
		await SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY);
		await onLogout();
		return false;
	}
};
