import { NativeModule, requireNativeModule } from "expo";
import { SpotifySdkEvents, SpotifyPlayerState } from "./SpotifySdk.types";

declare class SpotifySdkModule extends NativeModule<SpotifySdkEvents> {
	AUTH_TOKEN_REFRESH_REQUEST_CODE: number;
	AUTH_TOKEN_REQUEST_CODE: number;

	// Auth methods
	authorize(
		clientId: string,
		redirectUri: string,
		scopes: string[]
	): Promise<{ success: boolean }>;

	// App Remote methods
	connect(
		clientId: string,
		redirectUri: string
	): Promise<{ connected: boolean }>;
	disconnect(): Promise<{ disconnected: boolean }>;

	// Playback control methods
	play(uri: string): Promise<{ playing: boolean }>;
	pause(): Promise<{ paused: boolean }>;
	resume(): Promise<{ resumed: boolean }>;
	skipNext(): Promise<{ skipped: boolean }>;
	skipPrevious(): Promise<{ skipped: boolean }>;
	seekTo(positionMs: number): Promise<{ seeked: boolean }>;
	setShuffle(shuffle: boolean): Promise<{ shuffleSet: boolean }>;
	setRepeat(repeatMode: number): Promise<{ repeatSet: boolean }>;

	// State methods
	getPlayerState(): Promise<SpotifyPlayerState>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<SpotifySdkModule>("SpotifySdk");
