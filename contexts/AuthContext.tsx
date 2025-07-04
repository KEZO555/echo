import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	ReactNode,
	useCallback,
} from "react";
import * as SecureStore from "expo-secure-store";
import SpotifySdk from "../modules/spotify-sdk";
import { AppState, AppStateStatus } from "react-native";
import { AUTH_TOKEN_KEY, TOKEN_EXPIRY_KEY, REFRESH_TOKEN_KEY } from "../constants/spotify";
import { log, logWarn, logError, logInfo } from "../utils/logger";

// Import types
import type {
	AuthContextType,
	SpotifyPlaylist,
	SpotifySavedAlbum,
	SavedTrackObject,
	SpotifyCurrentlyPlaying,
} from "../types/spotify";

// Import services
import {
	loginWithSpotify,
	logoutFromSpotify,
	loadStoredAuth,
	fetchInitialDataInParallel,
} from "../services/spotifyAuth";
import {
	fetchPlaylists as fetchPlaylistsService,
	fetchMorePlaylists as fetchMorePlaylistsService,
	fetchAlbums as fetchAlbumsService,
	fetchMoreAlbums as fetchMoreAlbumsService,
	fetchSavedTracks as fetchSavedTracksService,
	fetchMoreSavedTracks as fetchMoreSavedTracksService,
	saveAlbum as saveAlbumService,
	removeAlbum as removeAlbumService,
	checkIfAlbumIsSaved as checkIfAlbumIsSavedService,
} from "../services/spotifyData";
import {
	ensureAppRemoteConnection,
	forceAppRemoteConnection,
	playTrackWithNativeSdk,
	getPlaybackStateFromNativeSdk,
	startPlayback as startPlaybackService,
	pausePlayback as pausePlaybackService,
	skipToNext as skipToNextService,
	skipToPrevious as skipToPreviousService,
	toggleShuffle as toggleShuffleService,
	toggleRepeat as toggleRepeatService,
	seekToPosition as seekToPositionService,
	getCurrentTrack as getCurrentTrackService,
	getAlbumArt as getAlbumArtService,
	searchItems as searchItemsService,
	addTrackToPlaylist as addTrackToPlaylistService,
	playTrackWithContext as playTrackWithContextService,
} from "../services/spotifyPlayback";

// Import utilities
import {
	loadCachedData,
	saveCachedData,
	clearCachedData,
	refreshSavedAlbumsFromCache,
	refreshSavedTracksFromCache,
} from "../utils/cache";
import { makeApiRequest } from "../utils/spotifyApi";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	// Authentication state
	const [accessToken, setAccessToken] = useState<string | null>(null);
	const [refreshToken, setRefreshToken] = useState<string | null>(null);
	const [user, setUser] = useState<any>(null);
	const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);

	// Data state
	const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null);
	const [playlistsNextUrl, setPlaylistsNextUrl] = useState<string | null>(
		null
	);
	const [albums, setAlbums] = useState<SpotifySavedAlbum[] | null>(null);
	const [albumsNextUrl, setAlbumsNextUrl] = useState<string | null>(null);
	const [savedTracks, setSavedTracks] = useState<SavedTrackObject[] | null>(
		null
	);
	const [savedTracksNextUrl, setSavedTracksNextUrl] = useState<string | null>(
		null
	);

	// Loading states
	const [isLoading, setIsLoading] = useState(true);
	const [isLoadingMorePlaylists, setIsLoadingMorePlaylists] = useState(false);
	const [isLoadingMoreAlbums, setIsLoadingMoreAlbums] = useState(false);
	const [isLoadingMoreSavedTracks, setIsLoadingMoreSavedTracks] =
		useState(false);
	const [isRefreshingPlaylists, setIsRefreshingPlaylists] = useState(false);
	const [isRefreshingAlbums, setIsRefreshingAlbums] = useState(false);
	const [isRefreshingSavedTracks, setIsRefreshingSavedTracks] =
		useState(false);

	// Connection state
	const [isConnectedToAppRemote, setIsConnectedToAppRemote] = useState(false);

	// Control flags
	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
	const [isFetchingInitialData, setIsFetchingInitialData] = useState(false);
	const [initialAuthProcessed, setInitialAuthProcessed] = useState(false);
	const [initialDataFetchTriggered, setInitialDataFetchTriggered] =
		useState(false);

	// App state for lifecycle management
	const [appState, setAppState] = useState(AppState.currentState);

	// Token update callback
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

	// User update callback
	const handleUserUpdate = useCallback((userData: any) => {
		setUser(userData);
	}, []);

	// Clear state callback for logout
	const clearState = useCallback(() => {
		logInfo("AuthContext: Clearing all state (logout)");
		setAccessToken(null);
		setRefreshToken(null);
		setUser(null);
		setTokenExpiry(null);
		setPlaylists(null);
		setPlaylistsNextUrl(null);
		setAlbums(null);
		setAlbumsNextUrl(null);
		setSavedTracks(null);
		setSavedTracksNextUrl(null);
		setIsConnectedToAppRemote(false);
		setIsLoading(false);
		// Reset auth flow control flags
		setIsFetchingInitialData(false);
		setInitialAuthProcessed(false);
		setInitialDataFetchTriggered(false);
		logInfo("AuthContext: State cleared");
	}, []);

	// Wrapped makeApiRequest with context
	const makeApiRequestWithContext = useCallback(
		(
			url: string,
			errorMessage: string,
			isRefreshing = false,
			retryCount = 0
		) =>
			makeApiRequest(
				url,
				errorMessage,
				accessToken,
				refreshToken,
				tokenExpiry,
				handleTokenUpdate,
				logout,
				isRefreshing,
				retryCount
			),
		[accessToken, refreshToken, tokenExpiry, handleTokenUpdate]
	);

	// Token refresh lock at context level
	const [isRefreshingToken, setIsRefreshingToken] = useState(false);
	const [refreshPromise, setRefreshPromise] = useState<Promise<string | null> | null>(null);

	// Token validation method
	const ensureValidToken = useCallback(async (): Promise<string | null> => {
		// Always get the latest token data from secure storage to avoid stale state
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
		
		// Check if token expires within 5 minutes
		const timeUntilExpiry = expiryTimestamp - Date.now();
		const needsRefresh = timeUntilExpiry < 5 * 60 * 1000;

		if (needsRefresh) {
			// If a refresh is already in progress, wait for it
			if (isRefreshingToken && refreshPromise) {
				logInfo("AuthContext: Token refresh already in progress, waiting...");
				return await refreshPromise;
			}

			const isAlreadyExpired = timeUntilExpiry < 0;
			logInfo(
				isAlreadyExpired
					? "AuthContext: Token already expired, refreshing..."
					: "AuthContext: Token expires soon, refreshing...",
				{ timeUntilExpiry }
			);

			// Create refresh promise and set lock
			const currentRefreshPromise = (async (): Promise<string | null> => {
				try {
					setIsRefreshingToken(true);
					
					// Import refreshAccessToken directly to avoid circular dependency
					const { refreshAccessToken } = await import(
						"../utils/spotifyApi"
					);
					const refreshed = await refreshAccessToken(
						latestRefreshToken,
						handleTokenUpdate,
						async () => {
							// Use logoutFromSpotify directly to avoid circular dependency
							await logoutFromSpotify(clearState);
						}
					);
					if (refreshed) {
						// Get the updated token from secure storage after refresh
						const updatedToken = await SecureStore.getItemAsync(
							AUTH_TOKEN_KEY
						);
						logInfo("AuthContext: Token refresh successful", {
							hasUpdatedToken: !!updatedToken,
						});
						return updatedToken || latestAccessToken;
					} else {
						// If refresh failed but we still have a token, try to use it
						// This prevents immediate logout on temporary network issues
						logWarn(
							"AuthContext: Token refresh failed, but will try to use current token"
						);
						return latestAccessToken;
					}
				} catch (error) {
					logError("AuthContext: Token refresh failed:", error);
					// Return current token instead of null to avoid immediate logout
					// The actual API call will handle the 401 and trigger logout if needed
					return latestAccessToken;
				} finally {
					setIsRefreshingToken(false);
					setRefreshPromise(null);
				}
			})();

			setRefreshPromise(currentRefreshPromise);
			return await currentRefreshPromise;
		}

		return latestAccessToken;
	}, [handleTokenUpdate, clearState, isRefreshingToken, refreshPromise]);

	// Initial data fetch callback
	const fetchInitialData = useCallback(
		async (token: string) => {
			// Prevent multiple simultaneous initial data fetches
			if (isFetchingInitialData) {
				logInfo(
					"AuthContext: Initial data fetch already in progress, skipping..."
				);
				return;
			}

			setIsFetchingInitialData(true);
			logInfo("AuthContext: Starting initial data fetch...");

			try {
				await fetchInitialDataInParallel(
					token,
					(playlists, nextUrl) => {
						setPlaylists(playlists);
						setPlaylistsNextUrl(nextUrl);
					},
					(albums, nextUrl) => {
						setAlbums(albums);
						setAlbumsNextUrl(nextUrl);
					},
					(tracks, nextUrl) => {
						setSavedTracks(tracks);
						setSavedTracksNextUrl(nextUrl);
					},
					saveCachedData,
					makeApiRequestWithContext
				);
				logInfo(
					"AuthContext: Initial data fetch completed successfully"
				);
			} catch (error) {
				logError(
					"AuthContext: Error during initial data fetch:",
					error
				);
			} finally {
				setIsLoading(false);
				setIsFetchingInitialData(false);
			}
		},
		[
			isFetchingInitialData,
			ensureValidToken,
			accessToken,
			refreshToken,
			tokenExpiry,
			makeApiRequestWithContext,
		]
	);

	// Authentication methods
	const login = useCallback(async () => {
		if (isAuthenticating) {
			logInfo("AuthContext: Authentication already in progress");
			return;
		}

		setIsAuthenticating(true);
		setIsLoading(true);

		try {
			await loginWithSpotify(
				handleTokenUpdate,
				handleUserUpdate,
				fetchInitialData
			);
		} catch (error) {
			logError("AuthContext: Error during authentication:", error);
			setIsLoading(false);
		} finally {
			setIsAuthenticating(false);
		}
	}, [
		isAuthenticating,
		handleTokenUpdate,
		handleUserUpdate,
		fetchInitialData,
	]);

	const logout = useCallback(async () => {
		if (isAuthenticating) {
			logWarn("AuthContext: Logout blocked - authentication in progress");
			return;
		}

		logInfo("AuthContext: Logout initiated");
		await logoutFromSpotify(clearState);
		logInfo("AuthContext: Logout completed");
	}, [isAuthenticating, clearState]);

	// Data fetching methods
	const fetchPlaylists = useCallback(async () => {
		if (!accessToken) return;
		setIsRefreshingPlaylists(true);

		const result = await fetchPlaylistsService(
			accessToken,
			makeApiRequestWithContext,
			saveCachedData
		);

		setPlaylists(result.playlists || []);
		setPlaylistsNextUrl(result.nextUrl);
		setIsRefreshingPlaylists(false);
	}, [accessToken, makeApiRequestWithContext]);

	const fetchMorePlaylists = useCallback(async () => {
		setIsLoadingMorePlaylists(true);

		const result = await fetchMorePlaylistsService(
			playlistsNextUrl,
			isLoadingMorePlaylists,
			accessToken,
			makeApiRequestWithContext
		);

		if (result.playlists) {
			setPlaylists((prev) => [...(prev || []), ...result.playlists!]);
			setPlaylistsNextUrl(result.nextUrl);
		}
		setIsLoadingMorePlaylists(false);
	}, [
		playlistsNextUrl,
		isLoadingMorePlaylists,
		accessToken,
		makeApiRequestWithContext,
	]);

	const fetchAlbums = useCallback(async () => {
		if (!accessToken) return;
		setIsRefreshingAlbums(true);

		const result = await fetchAlbumsService(
			accessToken,
			makeApiRequestWithContext,
			saveCachedData
		);

		setAlbums(result.albums || []);
		setAlbumsNextUrl(result.nextUrl);
		setIsRefreshingAlbums(false);
	}, [accessToken, makeApiRequestWithContext]);

	const fetchMoreAlbums = useCallback(async () => {
		setIsLoadingMoreAlbums(true);

		const result = await fetchMoreAlbumsService(
			albumsNextUrl,
			isLoadingMoreAlbums,
			accessToken,
			makeApiRequestWithContext
		);

		if (result.albums) {
			setAlbums((prev) => [...(prev || []), ...result.albums!]);
			setAlbumsNextUrl(result.nextUrl);
		}
		setIsLoadingMoreAlbums(false);
	}, [
		albumsNextUrl,
		isLoadingMoreAlbums,
		accessToken,
		makeApiRequestWithContext,
	]);

	const fetchSavedTracks = useCallback(async () => {
		if (!accessToken) return;
		setIsRefreshingSavedTracks(true);

		const result = await fetchSavedTracksService(
			accessToken,
			makeApiRequestWithContext,
			saveCachedData
		);

		setSavedTracks(result.savedTracks || []);
		setSavedTracksNextUrl(result.nextUrl);
		setIsRefreshingSavedTracks(false);
	}, [accessToken, makeApiRequestWithContext]);

	const fetchMoreSavedTracks = useCallback(async () => {
		setIsLoadingMoreSavedTracks(true);

		const result = await fetchMoreSavedTracksService(
			savedTracksNextUrl,
			isLoadingMoreSavedTracks,
			accessToken,
			makeApiRequestWithContext
		);

		if (result.savedTracks) {
			setSavedTracks((prev) => [...(prev || []), ...result.savedTracks!]);
			setSavedTracksNextUrl(result.nextUrl);
		}
		setIsLoadingMoreSavedTracks(false);
	}, [
		savedTracksNextUrl,
		isLoadingMoreSavedTracks,
		accessToken,
		makeApiRequestWithContext,
	]);

	// Album management methods
	const saveAlbum = useCallback(
		async (albumId: string): Promise<boolean> => {
			const result = await saveAlbumService(
				albumId,
				accessToken,
				ensureValidToken
			);
			if (result) {
				// Refresh albums from cache to update UI
				const cachedAlbums = await refreshSavedAlbumsFromCache();
				if (cachedAlbums) setAlbums(cachedAlbums);
			}
			return result;
		},
		[accessToken, ensureValidToken]
	);

	const removeAlbum = useCallback(
		async (albumId: string): Promise<boolean> => {
			const result = await removeAlbumService(
				albumId,
				accessToken,
				ensureValidToken
			);
			if (result) {
				// Refresh albums from cache to update UI
				const cachedAlbums = await refreshSavedAlbumsFromCache();
				if (cachedAlbums) setAlbums(cachedAlbums);
			}
			return result;
		},
		[accessToken, ensureValidToken]
	);

	const checkIfAlbumIsSaved = useCallback(
		(albumId: string) =>
			checkIfAlbumIsSavedService(albumId, accessToken, ensureValidToken),
		[accessToken, ensureValidToken]
	);

	// Cache refresh methods
	const refreshSavedAlbumsFromCacheMethod = useCallback(async () => {
		const cachedAlbums = await refreshSavedAlbumsFromCache();
		if (cachedAlbums) setAlbums(cachedAlbums);
	}, []);

	const refreshSavedTracksFromCacheMethod = useCallback(async () => {
		const cachedTracks = await refreshSavedTracksFromCache();
		if (cachedTracks) setSavedTracks(cachedTracks);
	}, []);

	// Playback methods
	const playTrack = useCallback(
		async (trackUri: string, deviceId?: string, contextUri?: string) => {
			try {
				// Ensure we have a valid token before playback
				const validToken = await ensureValidToken();
				await playTrackWithNativeSdk(
					trackUri,
					deviceId,
					contextUri,
					validToken,
					ensureValidToken
				);
			} catch (error) {
				setIsConnectedToAppRemote(false);
				throw error;
			}
		},
		[accessToken, ensureValidToken]
	);

	const playTrackWithContext = useCallback(
		async (
			trackUri: string,
			sourceContext?: {
				type: "album" | "playlist" | "liked" | "artist";
				uri?: string;
				tracks?: any[];
				currentIndex?: number;
			}
		) => {
			// Ensure we have a valid token before playback and wait for any state updates
			const validToken = await ensureValidToken();
			
			// Additional wait to ensure context state is updated after token refresh
			await new Promise(resolve => setTimeout(resolve, 100));
			
			return playTrackWithContextService(
				trackUri,
				validToken,
				sourceContext,
				ensureValidToken
			);
		},
		[ensureValidToken]
	);

	const getPlaybackState = useCallback(
		(): Promise<SpotifyCurrentlyPlaying | null> =>
			getPlaybackStateFromNativeSdk(accessToken, ensureValidToken),
		[accessToken, ensureValidToken]
	);

	const getCurrentTrack = useCallback(() => getCurrentTrackService(), []);

	const getAlbumArt = useCallback(
		(uri?: string, size?: string) => getAlbumArtService(uri, size),
		[]
	);

	const startPlayback = useCallback(() => startPlaybackService(), []);
	const pausePlayback = useCallback(() => pausePlaybackService(), []);
	const skipToNext = useCallback(() => skipToNextService(), []);
	const skipToPrevious = useCallback(() => skipToPreviousService(), []);
	const toggleShuffle = useCallback(
		(state: boolean) => toggleShuffleService(state),
		[]
	);
	const toggleRepeat = useCallback(
		(state: "off" | "context" | "track") => toggleRepeatService(state),
		[]
	);
	const seekToPosition = useCallback(
		(positionMs: number) => seekToPositionService(positionMs),
		[]
	);

	const searchItems = useCallback(
		(query: string, types: string[]) =>
			searchItemsService(query, types, accessToken, ensureValidToken),
		[accessToken, ensureValidToken]
	);

	const addTrackToPlaylist = useCallback(
		(playlistId: string, trackUri: string) =>
			addTrackToPlaylistService(
				playlistId,
				trackUri,
				accessToken,
				ensureValidToken
			),
		[accessToken, ensureValidToken]
	);

	const forceAppRemoteConnectionMethod =
		useCallback(async (): Promise<boolean> => {
			const result = await forceAppRemoteConnection();
			setIsConnectedToAppRemote(result);
			return result;
		}, []);

	// Development/testing method to force token expiry
	const forceTokenExpiryMethod = useCallback(async (): Promise<void> => {
		if (!__DEV__) {
			logWarn("forceTokenExpiry is only available in development mode");
			return;
		}

		logInfo("Forcing token expiry for testing...");

		// Set token expiry to 1 minute ago to force refresh on next API call
		const expiredTime = Date.now() - 60 * 1000;
		setTokenExpiry(expiredTime);

		// Also update it in secure storage
		await SecureStore.setItemAsync(
			TOKEN_EXPIRY_KEY,
			expiredTime.toString()
		);

		logInfo(
			"Token expiry set to past time. Next API call should trigger refresh."
		);
	}, []);

	// App state and connection management effects
	useEffect(() => {
		const handleAppStateChange = (nextAppState: AppStateStatus) => {
			if (
				appState.match(/inactive|background/) &&
				nextAppState === "active"
			) {
				logInfo("AuthContext: App resumed - relying on auto-connect");
				// Just ensure auto-connect is enabled, let native SDK handle connection
				if (accessToken) {
					SpotifySdk.enableAutoConnect(true);
				}
			} else if (
				appState === "active" &&
				nextAppState.match(/inactive|background/)
			) {
				setIsConnectedToAppRemote(false);
			}
			setAppState(nextAppState);
		};

		const handleNativeConnected = () => {
			logInfo("AuthContext: Connected to Spotify");
			setIsConnectedToAppRemote(true);
		};

		const handleNativeDisconnected = () => {
			logInfo("AuthContext: Disconnected from Spotify");
			setIsConnectedToAppRemote(false);
		};

		const appStateSubscription = AppState.addEventListener(
			"change",
			handleAppStateChange
		);
		const connectedSubscription = SpotifySdk.addListener(
			"onConnected",
			handleNativeConnected
		);
		const disconnectedSubscription = SpotifySdk.addListener(
			"onDisconnected",
			handleNativeDisconnected
		);

		return () => {
			appStateSubscription?.remove();
			connectedSubscription?.remove();
			disconnectedSubscription?.remove();
		};
	}, [appState, accessToken]);

	// Initial load effect
	useEffect(() => {
		if (initialAuthProcessed || isAuthenticating) {
			return;
		}

		logInfo("AuthContext: Starting initial auth load...");

		const loadInitialAuth = async () => {
			try {
				const authData = await loadStoredAuth();

				// Load cached data first for a responsive UI
				const cachedData = await loadCachedData();
				setPlaylists(cachedData.playlists);
				setAlbums(cachedData.albums);
				setSavedTracks(cachedData.savedTracks);

				if (authData.accessToken) {
					// Set auth state from stored data
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

	// Effect to fetch initial data once tokens are loaded
	useEffect(() => {
		const triggerInitialDataFetch = async () => {
			if (
				accessToken &&
				!initialDataFetchTriggered &&
				initialAuthProcessed
			) {
				// Mark as triggered immediately to prevent re-fetching
				setInitialDataFetchTriggered(true);

				logInfo(
					"AuthContext: Auth state loaded, proceeding with data fetch..."
				);

				const validToken = await ensureValidToken();

				if (validToken) {
					await fetchInitialData(validToken);
				} else {
					logWarn(
						"AuthContext: Token validation failed, skipping initial data fetch."
					);
				}
			}
		};

		triggerInitialDataFetch();
	}, [
		accessToken,
		initialDataFetchTriggered,
		initialAuthProcessed,
		ensureValidToken,
		fetchInitialData,
	]);

	// Provide context value
	const value: AuthContextType = {
		accessToken,
		refreshToken,
		user,
		playlists,
		playlistsNextUrl,
		isLoadingMorePlaylists,
		fetchMorePlaylists,
		albums,
		albumsNextUrl,
		isLoadingMoreAlbums,
		fetchMoreAlbums,
		savedTracks,
		savedTracksNextUrl,
		isLoadingMoreSavedTracks,
		fetchMoreSavedTracks,
		isLoading,
		isRefreshingPlaylists,
		isRefreshingAlbums,
		isRefreshingSavedTracks,
		isConnectedToAppRemote,
		login,
		logout,
		fetchPlaylists,
		fetchAlbums,
		fetchSavedTracks,
		refreshSavedTracksFromCache: refreshSavedTracksFromCacheMethod,
		saveAlbum,
		removeAlbum,
		checkIfAlbumIsSaved,
		refreshSavedAlbumsFromCache: refreshSavedAlbumsFromCacheMethod,
		playTrack,
		playTrackWithContext,
		getPlaybackState,
		getCurrentTrack,
		getAlbumArt,
		startPlayback,
		pausePlayback,
		skipToNext,
		skipToPrevious,
		toggleShuffle,
		toggleRepeat,
		addTrackToPlaylist,
		seekToPosition,
		searchItems,
		clearCachedData,
		forceAppRemoteConnection: forceAppRemoteConnectionMethod,
		makeApiRequest: makeApiRequestWithContext,
		ensureValidToken,
		// Development/testing methods
		...(__DEV__ && { forceTokenExpiry: forceTokenExpiryMethod }),
	};

	return (
		<AuthContext.Provider value={value}>{children}</AuthContext.Provider>
	);
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
};

// Re-export types for backwards compatibility
export type {
	SpotifyImage,
	SpotifyPlaylist,
	SpotifyPlaylistOwner,
	SpotifyPlaylistsResponse,
	SpotifyArtistSimple,
	SpotifyAlbum,
	SpotifyAlbumTracks,
	SpotifyTrackSimple,
	SpotifySavedAlbum,
	SpotifySavedAlbumsResponse,
	SavedTrackObject,
	SavedTracksResponse,
	SpotifyDevice,
	SpotifyDevicesResponse,
	SpotifyRepeatState,
	SpotifyCurrentlyPlaying,
	SpotifyPlaybackContext,
	SpotifyAlbumSimple,
	SpotifyTrack,
	SpotifyPlaylistSimple,
	SpotifySearchResults,
} from "../types/spotify";
