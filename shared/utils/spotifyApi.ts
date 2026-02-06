import { deleteItemAsync, setItemAsync } from "expo-secure-store";
import {
  AUTH_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  TOKEN_EXPIRY_KEY,
  USER_INFO_KEY,
} from "@/constants/spotify";
import { refreshAccessToken as refreshTokenService } from "@/features/auth";
import { getStoredCredentials } from "@/features/credentials";
import { log, logError } from "./logger";

let isRefreshInProgress = false;
let refreshPromise: Promise<boolean> | null = null;

export const refreshAccessToken = async (
  currentRefreshToken: string,
  onTokenUpdate: (
    accessToken: string,
    refreshToken?: string,
    expiry?: number
  ) => void,
  onLogout: () => Promise<void>
): Promise<boolean> => {
  if (isRefreshInProgress && refreshPromise) {
    log("API: Token refresh already in progress, waiting for completion...");
    return await refreshPromise;
  }

  isRefreshInProgress = true;
  refreshPromise = performTokenRefresh(
    currentRefreshToken,
    onTokenUpdate,
    onLogout
  );

  try {
    const result = await refreshPromise;
    return result;
  } finally {
    isRefreshInProgress = false;
    refreshPromise = null;
  }
};

const performTokenRefresh = async (
  currentRefreshToken: string,
  onTokenUpdate: (
    accessToken: string,
    refreshToken?: string,
    expiry?: number
  ) => void,
  onLogout: () => Promise<void>
): Promise<boolean> => {
  log("API: Attempting to refresh access token...");

  try {
    if (!currentRefreshToken) {
      logError("API: No refresh token available");
      throw new Error("No refresh token available");
    }

    log("API: Using new token exchange service for refresh...");

    const credentials = await getStoredCredentials();
    if (!credentials) {
      logError("API: No credentials configured");
      throw new Error("No credentials configured");
    }

    const tokenResponse = await refreshTokenService(
      currentRefreshToken,
      credentials.clientId,
      credentials.clientSecret
    );

    log("API: Access token refreshed successfully");

    const expiryTime = Date.now() + (tokenResponse.expires_in - 600) * 1000;

    const storagePromises: Promise<void>[] = [
      setItemAsync(AUTH_TOKEN_KEY, tokenResponse.access_token),
      setItemAsync(TOKEN_EXPIRY_KEY, expiryTime.toString()),
    ];
    if (tokenResponse.refresh_token) {
      storagePromises.push(
        setItemAsync(REFRESH_TOKEN_KEY, tokenResponse.refresh_token)
      );
    }
    await Promise.all(storagePromises);

    onTokenUpdate(
      tokenResponse.access_token,
      tokenResponse.refresh_token || currentRefreshToken,
      expiryTime
    );

    return true;
  } catch (error) {
    logError("API: Error during token refresh:", error);

    const isNetworkError =
      error instanceof TypeError ||
      (error as Error)?.message?.includes("Network request failed") ||
      (error as Error)?.message?.includes("fetch");

    if (isNetworkError) {
      log("API: Network error during token refresh, will retry later");
      return false;
    }

    log("API: Authentication error during token refresh, clearing session");
    await deleteItemAsync(AUTH_TOKEN_KEY);
    await deleteItemAsync(REFRESH_TOKEN_KEY);
    await deleteItemAsync(USER_INFO_KEY);
    await deleteItemAsync(TOKEN_EXPIRY_KEY);
    await onLogout();
    return false;
  }
};
