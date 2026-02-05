import React, {
	createContext,
	useContext,
	ReactNode,
	useCallback,
	useMemo,
} from "react";
import { useSpotifyConnection, spotify } from "@/modules/spotify-sdk";
import { useAuth } from "@/features/auth/contexts/AuthContext";

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
	playTrackWithContext as playTrackWithContextService,
	skipToIndex as skipToIndexService,
	addToLibrary as addToLibraryService,
	removeFromLibrary as removeFromLibraryService,
	getLibraryState as getLibraryStateService,
} from "../services/spotifyPlayback";

export interface PlaybackContextType {
	isConnectedToAppRemote: boolean;

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

	forceAppRemoteConnection: () => Promise<boolean>;
}

const PlaybackContext = createContext<PlaybackContextType | undefined>(undefined);

export const PlaybackProvider = ({ children }: { children: ReactNode }) => {
	const { accessToken, ensureValidToken } = useAuth();
	const { isConnected: isConnectedToAppRemote } = useSpotifyConnection();

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
		return await startPlaybackService();
	}, []);

	const pausePlayback = useCallback(async () => {
		return await pausePlaybackService();
	}, []);

	const skipToNext = useCallback(async () => {
		return await skipToNextService();
	}, []);

	const skipToPrevious = useCallback(async () => {
		return await skipToPreviousService();
	}, []);

	const toggleShuffle = useCallback((state: boolean) => toggleShuffleService(state), []);

	const toggleRepeat = useCallback(
		(state: "off" | "context" | "track") => toggleRepeatService(state),
		[]
	);

	const seekToPosition = useCallback((positionMs: number) => seekToPositionService(positionMs), []);

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
		return await forceAppRemoteConnectionService();
	}, []);

	const value: PlaybackContextType = useMemo(() => ({
		isConnectedToAppRemote,
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
		seekToPosition,
		addToLibrary,
		removeFromLibrary,
		getLibraryState,
		forceAppRemoteConnection: forceAppRemoteConnectionMethod,
	}), [isConnectedToAppRemote, playTracksWithWebApi, playTrackWithContext, skipToIndex, getPlaybackState, getCurrentTrack, getAlbumArt, startPlayback, pausePlayback, skipToNext, skipToPrevious, toggleShuffle, toggleRepeat, seekToPosition, addToLibrary, removeFromLibrary, getLibraryState, forceAppRemoteConnectionMethod]);

	return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
};

export const usePlayback = () => {
	const context = useContext(PlaybackContext);
	if (context === undefined) {
		throw new Error("usePlayback must be used within a PlaybackProvider");
	}
	return context;
};
