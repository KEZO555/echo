import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useRef,
    useMemo,
    ReactNode,
    useCallback,
} from "react";
import * as SecureStore from "expo-secure-store";
import { AppState, AppStateStatus } from "react-native";
import { AUTH_TOKEN_KEY, TOKEN_EXPIRY_KEY, REFRESH_TOKEN_KEY } from "@/constants/spotify";
import { useCredentials } from "@/features/credentials";
import { logWarn, logError, logInfo } from "@/shared/utils/logger";

import { loginWithSpotify, logoutFromSpotify, loadStoredAuth } from "../services/spotifyAuth";

export interface AuthError {
    title: string;
    message: string;
}

export interface AuthContextType {
    accessToken: string | null;
    refreshToken: string | null;
    user: any | null;
    tokenExpiry: number | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    appState: AppStateStatus;
    authError: AuthError | null;
    clearAuthError: () => void;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    ensureValidToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [user, setUser] = useState<any>(null);
    const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [initialAuthProcessed, setInitialAuthProcessed] = useState(false);
    const [appState, setAppState] = useState(AppState.currentState);
    const appStateRef = useRef(AppState.currentState);
    const [authError, setAuthError] = useState<AuthError | null>(null);

    const clearAuthError = useCallback(() => {
        setAuthError(null);
    }, []);

    const handleTokenUpdate = useCallback(
        (newAccessToken: string, newRefreshToken?: string, expiry?: number) => {
            logInfo("AuthContext: Token update", {
                hasNewAccessToken: !!newAccessToken,
                hasNewRefreshToken: !!newRefreshToken,
                newExpiry: expiry ? new Date(expiry).toISOString() : null,
            });
            setAccessToken(newAccessToken);
            if (newRefreshToken) setRefreshToken(newRefreshToken);
            if (expiry) setTokenExpiry(expiry);
        },
        []
    );

    const handleUserUpdate = useCallback((userData: any) => {
        setUser(userData);
    }, []);

    const clearState = useCallback(() => {
        logInfo("AuthContext: Clearing all state (logout)");
        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
        setTokenExpiry(null);
        setIsLoading(false);
        setIsAuthenticating(false);
        setInitialAuthProcessed(false);
        logInfo("AuthContext: State cleared");
    }, []);

    const ensureValidToken = useCallback(async (): Promise<string | null> => {
        const [latestAccessToken, latestRefreshToken, latestTokenExpiry] = await Promise.all([
            SecureStore.getItemAsync(AUTH_TOKEN_KEY),
            SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
            SecureStore.getItemAsync(TOKEN_EXPIRY_KEY)
        ]);

        if (!latestAccessToken || !latestRefreshToken || !latestTokenExpiry) {
            logInfo("AuthContext: Missing token data for validation", {
                hasAccessToken: !!latestAccessToken,
                hasRefreshToken: !!latestRefreshToken,
                hasTokenExpiry: !!latestTokenExpiry,
            });
            return null;
        }

        const expiryTimestamp = parseInt(latestTokenExpiry, 10);
        const timeUntilExpiry = expiryTimestamp - Date.now();
        const needsRefresh = timeUntilExpiry < 5 * 60 * 1000;

        if (needsRefresh) {
            const isAlreadyExpired = timeUntilExpiry < 0;
            logInfo(
                isAlreadyExpired
                    ? "AuthContext: Token already expired, refreshing..."
                    : "AuthContext: Token expires soon, refreshing...",
                { timeUntilExpiry }
            );

            try {
                const { refreshAccessToken } = await import("@/shared/utils/spotifyApi");
                const refreshed = await refreshAccessToken(
                    latestRefreshToken,
                    handleTokenUpdate,
                    async () => {
                        await logoutFromSpotify(clearState);
                    }
                );
                if (refreshed) {
                    const updatedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
                    logInfo("AuthContext: Token refresh successful", {
                        hasUpdatedToken: !!updatedToken,
                    });
                    return updatedToken || latestAccessToken;
                } else {
                    logWarn("AuthContext: Token refresh failed, but will try to use current token");
                    return latestAccessToken;
                }
            } catch (error) {
                logError("AuthContext: Token refresh failed:", error);
                return latestAccessToken;
            }
        }

        return latestAccessToken;
    }, [handleTokenUpdate, clearState]);

    const { credentials, redirectUri } = useCredentials();

    const login = useCallback(async () => {
        if (isAuthenticating) {
            logInfo("AuthContext: Authentication already in progress");
            return;
        }

        if (!credentials) {
            logError("AuthContext: No credentials configured");
            return;
        }

        setIsAuthenticating(true);
        setIsLoading(true);

        try {
            await loginWithSpotify(credentials, redirectUri, handleTokenUpdate, handleUserUpdate, async () => {});
        } catch (error: any) {
            logError("AuthContext: Error during authentication:", error);
            
            const errorMessage = error?.message || String(error);
            if (
                errorMessage.includes("invalid_client") ||
                errorMessage.includes("Invalid client secret") ||
                errorMessage.includes("AUTHENTICATION_SERVICE_UNKNOWN_ERROR")
            ) {
                setAuthError({
                    title: "Invalid Credentials",
                    message: "Your Client ID or Secret is incorrect.\n\nPlease check your Spotify Dashboard and try again.",
                });
            } else {
                setAuthError({
                    title: "Login Failed",
                    message: errorMessage,
                });
            }
        } finally {
            setIsAuthenticating(false);
            setIsLoading(false);
        }
    }, [isAuthenticating, credentials, redirectUri, handleTokenUpdate, handleUserUpdate]);

    const logout = useCallback(async () => {
        if (isAuthenticating) {
            logWarn("AuthContext: Logout blocked - authentication in progress");
            return;
        }

        logInfo("AuthContext: Logout initiated");
        await logoutFromSpotify(clearState);
        logInfo("AuthContext: Logout completed");
    }, [isAuthenticating, clearState]);

    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (appStateRef.current.match(/inactive|background/) && nextAppState === "active") {
                logInfo("AuthContext: App resumed");
            }
            appStateRef.current = nextAppState;
            setAppState(nextAppState);
        };

        const appStateSubscription = AppState.addEventListener("change", handleAppStateChange);

        return () => {
            appStateSubscription?.remove();
        };
    }, []);

    useEffect(() => {
        if (initialAuthProcessed || isAuthenticating) {
            return;
        }

        logInfo("AuthContext: Starting initial auth load...");

        const loadInitialAuth = async () => {
            try {
                const authData = await loadStoredAuth();

                if (authData.accessToken) {
                    setAccessToken(authData.accessToken);
                    setRefreshToken(authData.refreshToken);
                    setUser(authData.user);
                    setTokenExpiry(authData.tokenExpiry);
                }
            } catch (error) {
                logError("AuthContext: Failed to load auth state:", error);
            } finally {
                setIsLoading(false);
                setInitialAuthProcessed(true);
                logInfo("AuthContext: Initial auth load completed");
            }
        };

        loadInitialAuth();
    }, [isAuthenticating, initialAuthProcessed]);

    const isAuthenticated = !!accessToken && !!user;

    const value: AuthContextType = useMemo(() => ({
        accessToken,
        refreshToken,
        user,
        tokenExpiry,
        isLoading,
        isAuthenticated,
        appState,
        authError,
        clearAuthError,
        login,
        logout,
        ensureValidToken,
    }), [accessToken, refreshToken, user, tokenExpiry, isLoading, isAuthenticated, appState, authError, clearAuthError, login, logout, ensureValidToken]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
