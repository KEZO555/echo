import type { StyleProp, ViewStyle } from "react-native";

export type OnLoadEventPayload = {
	url: string;
};

export type SpotifySdkModuleEvents = {
	onChange: (params: ChangeEventPayload) => void;
};

export type ChangeEventPayload = {
	value: string;
};

export type SpotifySdkViewProps = {
	url: string;
	onLoad: (event: { nativeEvent: OnLoadEventPayload }) => void;
	style?: StyleProp<ViewStyle>;
};

// Spotify Android SDK Types

// Auth Library Types
export interface SpotifyAuthConfig {
	clientId: string;
	redirectUri: string;
	scopes: string[];
}

export interface SpotifyAuthResponse {
	accessToken?: string;
	authorizationCode?: string;
	error?: string;
	state?: string;
}

// App Remote Library Types
export interface SpotifyConnectionParams {
	clientId: string;
	redirectUri: string;
}

export interface SpotifyTrack {
	uri: string;
	name: string;
	artist: {
		name: string;
		uri: string;
	};
	album: {
		name: string;
		uri: string;
	};
	imageUri: string;
	duration: number;
	isPodcast: boolean;
	isEpisode: boolean;
}

export interface SpotifyPlayerState {
	track: SpotifyTrack;
	playbackPosition: number;
	playbackSpeed: number;
	isPaused: boolean;
	playbackOptions: {
		isShuffling: boolean;
		repeatMode: number;
	};
	playbackRestrictions: {
		canSkipNext: boolean;
		canSkipPrev: boolean;
		canRepeatTrack: boolean;
		canRepeatContext: boolean;
		canToggleShuffle: boolean;
		canSeek: boolean;
	};
}

export interface SpotifyPlaybackOptions {
	isShuffling?: boolean;
	repeatMode?: number; // 0 = off, 1 = context, 2 = track
}

// Error types
export interface SpotifyError {
	message: string;
	code?: string;
}

// Event types
export type SpotifyPlayerStateCallback = (
	playerState: SpotifyPlayerState
) => void;
export type SpotifyErrorCallback = (error: SpotifyError) => void;
export type SpotifyConnectionCallback = () => void;

// Module Events
export interface SpotifySdkEvents {
	onPlayerStateChanged: (event: { playerState: SpotifyPlayerState }) => void;
	onConnectionError: (event: { error: string }) => void;
	onConnected: (event: { connected: boolean }) => void;
	onDisconnected: (event: { disconnected: boolean }) => void;
	[key: string]: (...args: any[]) => void;
}
