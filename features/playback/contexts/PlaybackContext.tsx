import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	ReactNode,
	useCallback,
	useRef,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import SpotifySdk from "@/modules/spotify-sdk";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { logInfo } from "@/shared/utils/logger";
import { useNetworkState } from "@/shared/hooks/useNetworkState";

import type { SpotifyCurrentlyPlaying } from "@/shared/types/spotify";

import {
	forceAppRemoteConnection as forceAppRemoteConnectionService,
	playTracksWithWebApi as playTracksWithWebApiService,
	getPlaybackState as getPlaybackStateService,
	startPlayback as startPlaybackService,
	pausePlayback as pausePlaybackService,
	skipToNext as skipToNextService,
	skipToPrevious as skipToPreviousService,
	toggleShuffle as toggleShuffleService,
	toggleRepeat as toggleRepeatService,
	seekToPosition as seekToPositionService,
	getCurrentTrack as getCurrentTrackService,
	getAlbumArt as getAlbumArtService,
	addTrackToPlaylist as addTrackToPlaylistService,
	playTrackWithContext as playTrackWithContextService,
	skipToIndex as skipToIndexService,
	addToLibrary as addToLibraryService,
	removeFromLibrary as removeFromLibraryService,
	getLibraryState as getLibraryStateService,
} from "../services/spotifyPlayback";

export interface PlaybackContextType {
	isConnectedToAppRemote: boolean;
	appState: AppStateStatus;

	startPlayback: () => Promise<void>;
	pausePlayback: () => Promise<void>;
	skipToNext: () => Promise<void>;
	skipToPrevious: () => Promise<void>;
	seekToPosition: (positionMs: number) => Promise<void>;
	toggleShuffle: (state: boolean) => Promise<void>;
	toggleRepeat: (state: "off" | "context" | "track") => Promise<void>;

	getPlaybackState: () => Promise<SpotifyCurrentlyPlaying | null>;
	getCurrentTrack: () => Promise<any | null>;
	getAlbumArt: (uri?: string, size?: string) => Promise<string | null>;

	playTrackWithContext: (
		trackUri: string,
		sourceContext?: {
			type: "album" | "playlist" | "liked" | "artist" | "podcast";
			uri?: string;
			tracks?: any[];
			currentIndex?: number;
		}
	) => Promise<void>;
	playTracksWithWebApi: (uris: string[]) => Promise<void>;
	skipToIndex: (sourceContext: {
		type: "album" | "playlist" | "liked" | "artist" | "podcast";
		uri?: string;
		tracks?: any[];
		currentIndex?: number;
	}) => Promise<void>;

	addToLibrary: (uri: string) => Promise<boolean>;
	removeFromLibrary: (uri: string) => Promise<boolean>;
	getLibraryState: (uri: string) => Promise<{ isAdded: boolean; canAdd: boolean } | null>;

	addTrackToPlaylist: (playlistId: string, trackUri: string) => Promise<boolean>;

	forceAppRemoteConnection: () => Promise<boolean>;
}

const PlaybackContext = createContext<PlaybackContextType | undefined>(undefined);

export const PlaybackProvider = ({ children }: { children: ReactNode }) => {
	const { accessToken, ensureValidToken } = useAuth();
	const { isOnline } = useNetworkState();

	const [isConnectedToAppRemote, setIsConnectedToAppRemote] = useState(false);
	const [appState, setAppState] = useState(AppState.currentState);
	const disconnectTimeoutRef = useRef<number | null>(null);

	const playTracksWithWebApi = useCallback(
		async (uris: string[]) => {
			return playTracksWithWebApiService(uris, accessToken, ensureValidToken);
		},
		[accessToken, ensureValidToken]
	);

	const playTrackWithContext = useCallback(
		async (
			trackUri: string,
			sourceContext?: {
				type: "album" | "playlist" | "liked" | "artist" | "podcast";
				uri?: string;
				tracks?: any[];
				currentIndex?: number;
			}
		) => {
			const validToken = await ensureValidToken();

			return playTrackWithContextService(trackUri, validToken, sourceContext, ensureValidToken);
		},
		[ensureValidToken]
	);

	const skipToIndex = useCallback(
		async (sourceContext: {
			type: "album" | "playlist" | "liked" | "artist" | "podcast";
			uri?: string;
			tracks?: any[];
			currentIndex?: number;
		}) => {
			return skipToIndexService(sourceContext);
		},
		[]
	);

	const getPlaybackState = useCallback(
		(): Promise<SpotifyCurrentlyPlaying | null> => getPlaybackStateService(),
		[]
	);

	const getCurrentTrack = useCallback(() => getCurrentTrackService(), []);

	const getAlbumArt = useCallback((uri?: string, size?: string) => getAlbumArtService(uri, size), []);

	const startPlayback = useCallback(async () => {
		const result = await startPlaybackService();
		try {
			const connected = await SpotifySdk.isConnected();
			setIsConnectedToAppRemote(connected);
		} catch (error) {
			// Ignore
		}
		return result;
	}, []);

	const pausePlayback = useCallback(async () => {
		const result = await pausePlaybackService();
		try {
			const connected = await SpotifySdk.isConnected();
			setIsConnectedToAppRemote(connected);
		} catch (error) {
			// Ignore
		}
		return result;
	}, []);

	const skipToNext = useCallback(async () => {
		const result = await skipToNextService();
		try {
			const connected = await SpotifySdk.isConnected();
			setIsConnectedToAppRemote(connected);
		} catch (error) {
			// Ignore
		}
		return result;
	}, []);

	const skipToPrevious = useCallback(async () => {
		const result = await skipToPreviousService();
		try {
			const connected = await SpotifySdk.isConnected();
			setIsConnectedToAppRemote(connected);
		} catch (error) {
			// Ignore
		}
		return result;
	}, []);

	const toggleShuffle = useCallback((state: boolean) => toggleShuffleService(state), []);

	const toggleRepeat = useCallback(
		(state: "off" | "context" | "track") => toggleRepeatService(state),
		[]
	);

	const seekToPosition = useCallback((positionMs: number) => seekToPositionService(positionMs), []);

	const addTrackToPlaylist = useCallback(
		(playlistId: string, trackUri: string) =>
			addTrackToPlaylistService(playlistId, trackUri, accessToken, ensureValidToken),
		[accessToken, ensureValidToken]
	);

	const addToLibrary = useCallback(
		(uri: string) => addToLibraryService(uri, accessToken),
		[accessToken]
	);

	const removeFromLibrary = useCallback(
		(uri: string) => removeFromLibraryService(uri, accessToken),
		[accessToken]
	);

	const getLibraryState = useCallback((uri: string) => getLibraryStateService(uri), []);

	const forceAppRemoteConnectionMethod = useCallback(async (): Promise<boolean> => {
		const result = await forceAppRemoteConnectionService();
		setIsConnectedToAppRemote(result);
		return result;
	}, []);

	useEffect(() => {
		const handleAppStateChange = (nextAppState: AppStateStatus) => {
			if (appState.match(/inactive|background/) && nextAppState === "active") {
				logInfo("PlaybackContext: App resumed");
				if (disconnectTimeoutRef.current) {
					clearTimeout(disconnectTimeoutRef.current);
					disconnectTimeoutRef.current = null;
					logInfo("PlaybackContext: Cancelled pending disconnect timeout");
				}
			} else if (appState === "active" && nextAppState.match(/inactive|background/)) {
				if (isOnline) {
					logInfo("PlaybackContext: App suspended (online) - scheduling disconnect in 5 minutes");
					disconnectTimeoutRef.current = setTimeout(() => {
						try {
							SpotifySdk.disconnect();
							logInfo("PlaybackContext: Remote disconnected after 5 minute delay");
						} catch (e) {}
						setIsConnectedToAppRemote(false);
						disconnectTimeoutRef.current = null;
					}, 5 * 60 * 1000);
				} else {
					logInfo("PlaybackContext: App suspended (offline) - keeping remote connection");
				}
			}
			setAppState(nextAppState);
		};

		const appStateSubscription = AppState.addEventListener("change", handleAppStateChange);

		return () => {
			appStateSubscription?.remove();
		};
	}, [appState, isOnline]);

	useEffect(() => {
		if (!accessToken) return;

		const checkRemoteConnection = async () => {
			try {
				const connected = await SpotifySdk.isConnected();
				setIsConnectedToAppRemote(connected);
			} catch (error) {
				setIsConnectedToAppRemote(false);
			}
		};

		checkRemoteConnection();

		const interval = setInterval(checkRemoteConnection, 30000);

		return () => clearInterval(interval);
	}, [accessToken]);

	const value: PlaybackContextType = {
		isConnectedToAppRemote,
		appState,
		playTracksWithWebApi,
		playTrackWithContext,
		skipToIndex,
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
		addToLibrary,
		removeFromLibrary,
		getLibraryState,
		forceAppRemoteConnection: forceAppRemoteConnectionMethod,
	};

	return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
};

export const usePlayback = () => {
	const context = useContext(PlaybackContext);
	if (context === undefined) {
		throw new Error("usePlayback must be used within a PlaybackProvider");
	}
	return context;
};
