import { TOKEN_SWAP_URL, TOKEN_REFRESH_URL } from "../constants/spotify";

export interface TokenExchangeResponse {
	access_token: string;
	token_type: string;
	scope: string;
	expires_in: number;
	refresh_token?: string; // Optional for refresh responses
}

export interface TokenExchangeError {
	error: string;
	error_description?: string;
}

/**
 * Exchanges an authorization code for access and refresh tokens using the secure server
 * @param authorizationCode The authorization code received from Spotify
 * @param codeVerifier The code verifier used in the PKCE flow (not needed for server-side exchange)
 * @param redirectUri The redirect URI used in the authorization request (not needed for server-side exchange)
 * @returns Promise resolving to token response or throwing error
 */
export async function exchangeCodeForTokens(
	authorizationCode: string,
	codeVerifier: string,
	redirectUri: string
): Promise<TokenExchangeResponse> {
	try {
		console.log(
			"TokenExchange: Exchanging authorization code for tokens via server..."
		);

		const response = await fetch(TOKEN_SWAP_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				code: authorizationCode,
			}),
		});

		const responseText = await response.text();

		let data;
		if (!responseText || responseText.trim() === "") {
			console.error("TokenExchange: Empty response from server");
			throw new Error(
				`Empty response from server. Status: ${response.status}`
			);
		}

		try {
			data = JSON.parse(responseText);
		} catch (parseError) {
			console.error(
				"TokenExchange: Failed to parse response as JSON:",
				parseError
			);
			console.error("TokenExchange: Response was:", responseText);
			throw new Error(
				`Invalid JSON response from server: ${responseText}`
			);
		}

		console.log("TokenExchange: Response status:", response.status);

		if (!response.ok) {
			const error = data as TokenExchangeError;
			console.error(
				"TokenExchange: Failed to exchange code for tokens:",
				error
			);
			throw new Error(
				`Token exchange failed: ${error.error || "Unknown error"} - ${
					error.error_description || "Server error"
				}`
			);
		}

		const tokenResponse = data as TokenExchangeResponse;

		if (!tokenResponse.access_token || !tokenResponse.refresh_token) {
			throw new Error("Token exchange response missing required tokens");
		}

		console.log("TokenExchange: Successfully exchanged code for tokens");
		return tokenResponse;
	} catch (error) {
		console.error("TokenExchange: Error during token exchange:", error);
		throw error;
	}
}

/**
 * Refreshes an access token using a refresh token via the secure server
 * @param refreshToken The encrypted refresh token from the server
 * @returns Promise resolving to new token response
 */
export async function refreshAccessToken(
	refreshToken: string
): Promise<TokenExchangeResponse> {
	try {
		console.log("TokenExchange: Refreshing access token via server...");

		const response = await fetch(TOKEN_REFRESH_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				refresh_token: refreshToken,
			}),
		});

		console.log("TokenExchange: Refresh response status:", response.status);
		const responseText = await response.text();

		let data;
		if (!responseText || responseText.trim() === "") {
			console.error("TokenExchange: Empty refresh response from server");
			throw new Error(
				`Empty refresh response from server. Status: ${response.status}`
			);
		}

		try {
			data = JSON.parse(responseText);
		} catch (parseError) {
			console.error(
				"TokenExchange: Failed to parse refresh response as JSON:",
				parseError
			);
			console.error("TokenExchange: Refresh response was:", responseText);
			throw new Error(
				`Invalid JSON refresh response from server: ${responseText}`
			);
		}

		if (!response.ok) {
			const error = data as TokenExchangeError;
			console.error("TokenExchange: Failed to refresh token:", error);
			throw new Error(
				`Token refresh failed: ${error.error || "Unknown error"} - ${
					error.error_description || "Server error"
				}`
			);
		}

		const tokenResponse = data as TokenExchangeResponse;

		if (!tokenResponse.access_token) {
			throw new Error("Token refresh response missing access token");
		}

		// Note: Refresh token may not be returned if Spotify doesn't rotate it
		// The server will return the original encrypted refresh token in this case

		console.log("TokenExchange: Successfully refreshed access token");
		return tokenResponse;
	} catch (error) {
		console.error("TokenExchange: Error during token refresh:", error);
		throw error;
	}
}
