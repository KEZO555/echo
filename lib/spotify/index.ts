import SpotifySdkModule from "../../modules/spotify-sdk";
import {
	SpotifyAuthConfig,
	SpotifyPlayerState,
	SpotifyConnectionParams,
	SpotifySdkEvents,
} from "../../modules/spotify-sdk/src/SpotifySdk.types";

export class SpotifySDK {
	private static instance: SpotifySDK;

	public static getInstance(): SpotifySDK {
		if (!SpotifySDK.instance) {
			SpotifySDK.instance = new SpotifySDK();
		}
		return SpotifySDK.instance;
	}

	// Auth methods
	async authorize(config: SpotifyAuthConfig): Promise<{ success: boolean }> {
		return SpotifySdkModule.authorize(
			config.clientId,
			config.redirectUri,
			config.scopes
		);
	}

	// Connection methods
	async connect(
		params: SpotifyConnectionParams
	): Promise<{ connected: boolean }> {
		return SpotifySdkModule.connect(params.clientId, params.redirectUri);
	}

	async disconnect(): Promise<{ disconnected: boolean }> {
		return SpotifySdkModule.disconnect();
	}

	// Playback control methods
	async play(uri: string): Promise<{ playing: boolean }> {
		return SpotifySdkModule.play(uri);
	}

	async pause(): Promise<{ paused: boolean }> {
		return SpotifySdkModule.pause();
	}

	async resume(): Promise<{ resumed: boolean }> {
		return SpotifySdkModule.resume();
	}

	async skipNext(): Promise<{ skipped: boolean }> {
		return SpotifySdkModule.skipNext();
	}

	async skipPrevious(): Promise<{ skipped: boolean }> {
		return SpotifySdkModule.skipPrevious();
	}

	async seekTo(positionMs: number): Promise<{ seeked: boolean }> {
		return SpotifySdkModule.seekTo(positionMs);
	}

	async setShuffle(shuffle: boolean): Promise<{ shuffleSet: boolean }> {
		return SpotifySdkModule.setShuffle(shuffle);
	}

	async setRepeat(repeatMode: number): Promise<{ repeatSet: boolean }> {
		return SpotifySdkModule.setRepeat(repeatMode);
	}

	// State methods
	async getPlayerState(): Promise<SpotifyPlayerState> {
		return SpotifySdkModule.getPlayerState();
	}

	// Event listeners
	addListener<K extends keyof SpotifySdkEvents>(
		eventName: K,
		listener: SpotifySdkEvents[K]
	) {
		return SpotifySdkModule.addListener(eventName, listener);
	}

	removeListener<K extends keyof SpotifySdkEvents>(
		eventName: K,
		listener: SpotifySdkEvents[K]
	) {
		SpotifySdkModule.removeListener(eventName, listener);
	}

	removeAllListeners(eventName?: keyof SpotifySdkEvents) {
		SpotifySdkModule.removeAllListeners(eventName as any);
	}
}

// Export types and the SDK instance
export * from "../../modules/spotify-sdk/src/SpotifySdk.types";
export { SpotifySdkModule };
export default SpotifySDK.getInstance();
