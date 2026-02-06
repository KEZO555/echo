import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";
import {
  AUTH_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  SPOTIFY_SCOPES,
  TOKEN_EXPIRY_KEY,
  USER_INFO_KEY,
} from "@/constants/spotify";
import { exchangeCodeForTokens } from "@/features/auth/services/tokenExchange";
import type { Credentials } from "@/features/credentials";
import { getStoredCredentials, REDIRECT_URI } from "@/features/credentials";
import SpotifySdk from "@/modules/spotify-sdk";
import type { SpotifyUser } from "@/shared/types/spotify";
import { log, logError } from "@/shared/utils/logger";

export const loginWithSpotify = async (
  credentials: Credentials,
  redirectUri: string,
  onTokenUpdate: (
    accessToken: string,
    refreshToken?: string,
    expiry?: number
  ) => void,
  onUserUpdate: (user: SpotifyUser) => void,
  _fetchInitialData: (token: string) => Promise<void>
): Promise<void> => {
  log("Auth: Starting authentication with CODE flow via server...");

  const authResult = await SpotifySdk.authorize(
    credentials.clientId,
    redirectUri,
    SPOTIFY_SCOPES,
    undefined,
    false
  );

  if (authResult.success && authResult.data?.authorizationCode) {
    log("Auth: Authorization code received, exchanging for tokens...");

    const tokenResponse = await exchangeCodeForTokens(
      authResult.data.authorizationCode,
      credentials.clientId,
      credentials.clientSecret
    );

    if (!tokenResponse.refresh_token) {
      throw new Error("No refresh token received from server");
    }

    const expiryTime = Date.now() + (tokenResponse.expires_in - 600) * 1000;

    await Promise.all([
      setItemAsync(AUTH_TOKEN_KEY, tokenResponse.access_token),
      setItemAsync(REFRESH_TOKEN_KEY, tokenResponse.refresh_token),
      setItemAsync(TOKEN_EXPIRY_KEY, expiryTime.toString()),
    ]);

    onTokenUpdate(
      tokenResponse.access_token,
      tokenResponse.refresh_token,
      expiryTime
    );

    try {
      log("Auth: Establishing App Remote connection...");
      const connectionResult = await SpotifySdk.connect(
        credentials.clientId,
        redirectUri
      );
      if (connectionResult.connected) {
        log("Auth: App Remote connected successfully");
      } else {
        console.warn(
          "Auth: App Remote connection failed, will retry on first play"
        );
      }
    } catch (connectionError) {
      console.warn("Auth: App Remote connection error:", connectionError);
    }

    log("Auth: Authentication successful with refresh token");
    await fetchUserInfo(
      tokenResponse.access_token,
      onUserUpdate,
      () => Promise.resolve(),
      undefined
    );
  } else {
    logError(
      "Auth: Authentication failed:",
      authResult.error || "No authorization code received"
    );
    throw new Error(
      String(authResult.error) ||
        "Authentication failed - no authorization code"
    );
  }
};

export const logoutFromSpotify = async (
  clearState: () => void,
  onCleanup?: () => Promise<void>
): Promise<void> => {
  log("Logging out...");
  try {
    await SpotifySdk.disconnect();
    await SpotifySdk.clearSession();
  } catch (error) {
    logError("Error clearing native SDK session:", error);
  }

  await deleteItemAsync(AUTH_TOKEN_KEY);
  await deleteItemAsync(REFRESH_TOKEN_KEY);
  await deleteItemAsync(USER_INFO_KEY);
  await deleteItemAsync(TOKEN_EXPIRY_KEY);

  if (onCleanup) {
    await onCleanup();
  }

  clearState();
};

export const loadStoredAuth = async (): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
  user: SpotifyUser | null;
  tokenExpiry: number | null;
}> => {
  try {
    const storedToken = await getItemAsync(AUTH_TOKEN_KEY);
    const storedRefreshToken = await getItemAsync(REFRESH_TOKEN_KEY);
    const storedUser = await getItemAsync(USER_INFO_KEY);
    const storedExpiry = await getItemAsync(TOKEN_EXPIRY_KEY);

    if (storedToken && storedRefreshToken) {
      log("Auth: Found stored tokens, enabling auto-connect");

      const credentials = await getStoredCredentials();
      if (credentials) {
        try {
          log("Auth: Establishing App Remote connection for stored tokens...");
          const connectionResult = await SpotifySdk.connect(
            credentials.clientId,
            REDIRECT_URI
          );
          if (connectionResult.connected) {
            log("Auth: App Remote connected successfully for stored tokens");
          }
        } catch (connectionError) {
          console.warn(
            "Auth: App Remote connection error for stored tokens:",
            connectionError
          );
        }
      }
    }

    return {
      accessToken: storedToken,
      refreshToken: storedRefreshToken,
      user: storedUser ? JSON.parse(storedUser) : null,
      tokenExpiry: storedExpiry ? Number.parseInt(storedExpiry, 10) : null,
    };
  } catch (error) {
    logError("Auth: Error loading stored auth:", error);
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
  onUserUpdate: (user: SpotifyUser) => void,
  fetchInitialData: (token: string) => Promise<void>,
  ensureValidToken?: () => Promise<string | null>
) => {
  try {
    // Use token validation if available, otherwise use the provided token
    let validToken = token;
    if (ensureValidToken) {
      const refreshedToken = await ensureValidToken();
      if (refreshedToken) {
        validToken = refreshedToken;
      }
    }

    if (!validToken) {
      throw new Error("No valid token available for fetching user info");
    }

    const response = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    const responseData = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        log("Auth: Token expired while fetching user info");
      }
      throw new Error(
        `Failed to fetch user info: ${(responseData as { error?: { message?: string } })?.error?.message || response.status}`
      );
    }
    const userData = responseData as SpotifyUser;
    onUserUpdate(userData);
    await setItemAsync(USER_INFO_KEY, JSON.stringify(userData));
    // Start fetching other data after user info is successfully retrieved
    await fetchInitialData(validToken);
  } catch (error: unknown) {
    logError(
      "Auth: Error fetching user info:",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
};
