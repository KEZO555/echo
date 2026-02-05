import { REDIRECT_URI } from "@/features/credentials";
import { log, logError } from "@/shared/utils/logger";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

interface TokenExchangeResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

interface TokenExchangeError {
  error: string;
  error_description?: string;
}

function encodeCredentials(clientId: string, clientSecret: string): string {
  return btoa(`${clientId}:${clientSecret}`);
}

export async function exchangeCodeForTokens(
  authorizationCode: string,
  clientId: string,
  clientSecret: string
): Promise<TokenExchangeResponse> {
  try {
    log("TokenExchange: Exchanging authorization code for tokens...");

    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${encodeCredentials(clientId, clientSecret)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: authorizationCode,
        redirect_uri: REDIRECT_URI,
      }).toString(),
    });

    const responseText = await response.text();

    let data;
    if (!responseText || responseText.trim() === "") {
      logError("TokenExchange: Empty response from Spotify");
      throw new Error(
        `Empty response from Spotify. Status: ${response.status}`
      );
    }

    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      logError("TokenExchange: Failed to parse response as JSON:", parseError);
      logError("TokenExchange: Response was:", responseText);
      throw new Error(`Invalid JSON response from Spotify: ${responseText}`);
    }

    log("TokenExchange: Response status:", response.status);

    if (!response.ok) {
      const error = data as TokenExchangeError;
      throw new Error(
        `Token exchange failed: ${error.error || "Unknown error"} - ${
          error.error_description || "Spotify error"
        }`
      );
    }

    const tokenResponse = data as TokenExchangeResponse;

    if (!(tokenResponse.access_token && tokenResponse.refresh_token)) {
      throw new Error("Token exchange response missing required tokens");
    }

    log("TokenExchange: Successfully exchanged code for tokens");
    return tokenResponse;
  } catch (error) {
    throw error;
  }
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TokenExchangeResponse> {
  try {
    log("TokenExchange: Refreshing access token...");

    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${encodeCredentials(clientId, clientSecret)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    });

    log("TokenExchange: Refresh response status:", response.status);
    const responseText = await response.text();

    let data;
    if (!responseText || responseText.trim() === "") {
      logError("TokenExchange: Empty refresh response from Spotify");
      throw new Error(
        `Empty refresh response from Spotify. Status: ${response.status}`
      );
    }

    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      logError(
        "TokenExchange: Failed to parse refresh response as JSON:",
        parseError
      );
      logError("TokenExchange: Refresh response was:", responseText);
      throw new Error(
        `Invalid JSON refresh response from Spotify: ${responseText}`
      );
    }

    if (!response.ok) {
      const error = data as TokenExchangeError;
      logError("TokenExchange: Failed to refresh token:", error);
      throw new Error(
        `Token refresh failed: ${error.error || "Unknown error"} - ${
          error.error_description || "Spotify error"
        }`
      );
    }

    const tokenResponse = data as TokenExchangeResponse;

    if (!tokenResponse.access_token) {
      throw new Error("Token refresh response missing access token");
    }

    log("TokenExchange: Successfully refreshed access token");
    return tokenResponse;
  } catch (error) {
    logError("TokenExchange: Error during token refresh:", error);
    throw error;
  }
}
