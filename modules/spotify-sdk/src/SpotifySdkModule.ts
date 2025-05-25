import { NativeModule, requireNativeModule } from "expo";
import {
	SpotifySdkEvents,
	SpotifyPlayerState,
	SpotifyAuthConfig,
	SpotifyAuthResponse,
	SpotifyCapabilities,
	SpotifyListItem,
	SpotifyApiResponse,
} from "./SpotifySdk.types";

declare class SpotifySdkModule extends NativeModule<SpotifySdkEvents> {
	AUTH_TOKEN_REFRESH_REQUEST_CODE: number;
	AUTH_TOKEN_REQUEST_CODE: number;

	// Auth methods - Enhanced
	authorize(
		config: SpotifyAuthConfig
	): Promise<SpotifyApiResponse<SpotifyAuthResponse>>;
	authorizeWithCode(
		clientId: string,
		redirectUri: string,
		scopes: string[],
		state?: string,
		showDialog?: boolean
	): Promise<SpotifyApiResponse<SpotifyAuthResponse>>;
	authorizeWithToken(
		clientId: string,
		redirectUri: string,
		scopes: string[],
		state?: string,
		showDialog?: boolean
	): Promise<SpotifyApiResponse<SpotifyAuthResponse>>;
	clearCookies(): Promise<{ cleared: boolean }>;

	// Auth Session Management
	getAccessToken(): Promise<string | null>;
	clearSession(): Promise<{ cleared: boolean }>;
	isUserLoggedIn(): Promise<boolean>;

	// App Remote Connection methods
	connect(
		clientId: string,
		redirectUri: string
	): Promise<{ connected: boolean }>;
	disconnect(): Promise<{ disconnected: boolean }>;
	forceDisconnect(): Promise<{ disconnected: boolean; forced: boolean }>;
	isConnected(): Promise<boolean>;
	enableAutoConnect(enable: boolean): Promise<{ autoConnect: boolean }>;

	// Playback control methods
	play(uri?: string): Promise<{ playing: boolean }>;
	playWithOptions(
		uri: string,
		startPosition?: number
	): Promise<{ playing: boolean }>;
	pause(): Promise<{ paused: boolean }>;
	resume(): Promise<{ resumed: boolean }>;
	skipNext(): Promise<{ skipped: boolean }>;
	skipPrevious(): Promise<{ skipped: boolean }>;
	seekTo(positionMs: number): Promise<{ seeked: boolean }>;
	setShuffle(shuffle: boolean): Promise<{ shuffleSet: boolean }>;
	setRepeat(repeatMode: number): Promise<{ repeatSet: boolean }>;

	// Queue Management
	queue(uri: string): Promise<{ queued: boolean }>;
	addToQueue(uri: string): Promise<{ added: boolean }>;

	// State methods
	getPlayerState(): Promise<SpotifyPlayerState>;
	subscribeToPlayerState(): Promise<{ subscribed: boolean }>;
	unsubscribeFromPlayerState(): Promise<{ unsubscribed: boolean }>;

	// User methods
	getUserCapabilities(): Promise<SpotifyCapabilities>;
	subscribeToCapabilities(): Promise<{ subscribed: boolean }>;

	// Content API methods
	getRecommendedContentItems(
		contentType?: string
	): Promise<SpotifyListItem[]>;
	getChildrenOfItem(
		uri: string,
		perPage?: number,
		offset?: number
	): Promise<SpotifyListItem[]>;
	playContentItem(item: SpotifyListItem): Promise<{ playing: boolean }>;

	// Images API methods
	getImage(uri: string, size?: string): Promise<string>;

	// User API methods (additional)
	addToLibrary(uri: string): Promise<{ added: boolean }>;
	removeFromLibrary(uri: string): Promise<{ removed: boolean }>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<SpotifySdkModule>("SpotifySdk");
