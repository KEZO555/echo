import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	ReactNode,
	useCallback,
} from "react";
import SpotifySdk from "../modules/spotify-sdk";
import { AppState, AppStateStatus } from "react-native";

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
	const [user, setUser] = useState<any | null>(null);
	const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);

	// Playlists state
	const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null);
	const [playlistsNextUrl, setPlaylistsNextUrl] = useState<string | null>(
		null
	);
	const [isLoadingMorePlaylists, setIsLoadingMorePlaylists] = useState(false);
	const [isRefreshingPlaylists, setIsRefreshingPlaylists] = useState(false);

	// Albums state
	const [albums, setAlbums] = useState<SpotifySavedAlbum[] | null>(null);
	const [albumsNextUrl, setAlbumsNextUrl] = useState<string | null>(null);
	const [isLoadingMoreAlbums, setIsLoadingMoreAlbums] = useState(false);
	const [isRefreshingAlbums, setIsRefreshingAlbums] = useState(false);

	// Saved Tracks state
	const [savedTracks, setSavedTracks] = useState<SavedTrackObject[] | null>(
		null
	);
	const [savedTracksNextUrl, setSavedTracksNextUrl] = useState<string | null>(
		null
	);
	const [isLoadingMoreSavedTracks, setIsLoadingMoreSavedTracks] =
		useState(false);
	const [isRefreshingSavedTracks, setIsRefreshingSavedTracks] =
		useState(false);

	// Loading and connection state
	const [isLoading, setIsLoading] = useState(true);
	const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const [isConnectedToAppRemote, setIsConnectedToAppRemote] = useState(false);
	const [appState, setAppState] = useState<AppStateStatus>(
		AppState.currentState
	);

	// Token update callback
	const handleTokenUpdate = useCallback(
		(newAccessToken: string, newRefreshToken?: string, expiry?: number) => {
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

	// Initial data fetch callback
	const fetchInitialData = useCallback(async (token: string) => {
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
			saveCachedData
		);
		setIsLoading(false);
	}, []);

	// Authentication methods
	const login = useCallback(async () => {
		if (isAuthenticating) {
			console.log("AuthContext: Authentication already in progress");
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
			console.error("AuthContext: Error during authentication:", error);
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
			console.log(
				"AuthContext: Logout blocked - authentication in progress"
			);
			return;
		}

		await logoutFromSpotify(clearState);
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
			const result = await saveAlbumService(albumId, accessToken);
			if (result) {
				// Refresh albums from cache to update UI
				const cachedAlbums = await refreshSavedAlbumsFromCache();
				if (cachedAlbums) setAlbums(cachedAlbums);
			}
			return result;
		},
		[accessToken]
	);

	const removeAlbum = useCallback(
		async (albumId: string): Promise<boolean> => {
			const result = await removeAlbumService(albumId, accessToken);
			if (result) {
				// Refresh albums from cache to update UI
				const cachedAlbums = await refreshSavedAlbumsFromCache();
				if (cachedAlbums) setAlbums(cachedAlbums);
			}
			return result;
		},
		[accessToken]
	);

	const checkIfAlbumIsSaved = useCallback(
		(albumId: string) => checkIfAlbumIsSavedService(albumId, accessToken),
		[accessToken]
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
				await playTrackWithNativeSdk(
					trackUri,
					deviceId,
					contextUri,
					accessToken
				);
			} catch (error) {
				setIsConnectedToAppRemote(false);
				throw error;
			}
		},
		[accessToken]
	);

	const playTrackWithContext = useCallback(
		(
			trackUri: string,
			sourceContext?: {
				type: "album" | "playlist" | "liked" | "artist";
				uri?: string;
				tracks?: any[];
				currentIndex?: number;
			}
		) => playTrackWithContextService(trackUri, accessToken, sourceContext),
		[accessToken]
	);

	const getPlaybackState = useCallback(
		(): Promise<SpotifyCurrentlyPlaying | null> =>
			getPlaybackStateFromNativeSdk(accessToken),
		[accessToken]
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
		(state: "off" | "track") => toggleRepeatService(state),
		[]
	);
	const seekToPosition = useCallback(
		(positionMs: number) => seekToPositionService(positionMs),
		[]
	);

	const searchItems = useCallback(
		(query: string, types: string[]) =>
			searchItemsService(query, types, accessToken),
		[accessToken]
	);

	const addTrackToPlaylist = useCallback(
		(playlistId: string, trackUri: string) =>
			addTrackToPlaylistService(playlistId, trackUri, accessToken),
		[accessToken]
	);

	const forceAppRemoteConnectionMethod =
		useCallback(async (): Promise<boolean> => {
			const result = await forceAppRemoteConnection();
			setIsConnectedToAppRemote(result);
			return result;
		}, []);

	// App state and connection management effects
	useEffect(() => {
		const handleAppStateChange = (nextAppState: AppStateStatus) => {
			if (
				appState.match(/inactive|background/) &&
				nextAppState === "active"
			) {
				console.log(
					"AuthContext: App resumed - relying on auto-connect"
				);
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
			console.log("AuthContext: Connected to Spotify");
			setIsConnectedToAppRemote(true);
		};

		const handleNativeDisconnected = () => {
			console.log("AuthContext: Disconnected from Spotify");
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
		if (hasInitiallyLoaded || isAuthenticating) return;

		const loadInitialAuth = async () => {
			try {
				const authData = await loadStoredAuth();

				if (authData.accessToken) {
					setAccessToken(authData.accessToken);
					setRefreshToken(authData.refreshToken);
					setUser(authData.user);
					setTokenExpiry(authData.tokenExpiry);

					// Load cached data while fetching fresh data
					const cachedData = await loadCachedData();
					setPlaylists(cachedData.playlists);
					setAlbums(cachedData.albums);
					setSavedTracks(cachedData.savedTracks);
					setIsLoading(false);

					// Connection is already established in loadStoredAuth()

					// Fetch fresh data if we have user info, or if we have a token but no user (stored token case)
					if (authData.user) {
						await fetchInitialData(authData.accessToken);
					} else if (authData.accessToken) {
						// Stored token case - fetch user info first, then other data
						console.log(
							"AuthContext: Fetching user info for stored token..."
						);
						try {
							const response = await fetch(
								"https://api.spotify.com/v1/me",
								{
									headers: {
										Authorization: `Bearer ${authData.accessToken}`,
									},
								}
							);
							const userData = await response.json();
							if (response.ok) {
								setUser(userData);
								console.log(
									"AuthContext: User info fetched for stored token"
								);
								await fetchInitialData(authData.accessToken);
							} else {
								console.error(
									"AuthContext: Failed to fetch user info:",
									userData
								);
							}
						} catch (error) {
							console.error(
								"AuthContext: Error fetching user info:",
								error
							);
						}
					}
				} else {
					// No stored auth - load cached data and stay logged out
					const cachedData = await loadCachedData();
					setPlaylists(cachedData.playlists);
					setAlbums(cachedData.albums);
					setSavedTracks(cachedData.savedTracks);
					setIsLoading(false);
				}
			} catch (error) {
				console.error("AuthContext: Failed to load auth state:", error);
				const cachedData = await loadCachedData();
				setPlaylists(cachedData.playlists);
				setAlbums(cachedData.albums);
				setSavedTracks(cachedData.savedTracks);
				setIsLoading(false);
			} finally {
				setHasInitiallyLoaded(true);
			}
		};

		loadInitialAuth();
	}, [isAuthenticating, hasInitiallyLoaded, fetchInitialData]);

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
