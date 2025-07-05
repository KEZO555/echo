import SpotifySDK from "./index";

export async function testSpotifySDK() {
	try {
		log("Testing Spotify SDK module...");

		// Test that the module is accessible
		log("SpotifySDK instance:", SpotifySDK);

		// Test a simple function call (should return NOT_IMPLEMENTED error)
		try {
			await SpotifySDK.authorize({
				clientId: "test",
				redirectUri: "test://callback",
				scopes: ["user-read-playback-state"],
			});
		} catch (error) {
			log("Expected error from authorize:", error);
		}

		log("Spotify SDK module test completed successfully!");
		return true;
	} catch (error) {
		logError("Spotify SDK module test failed:", error);
		return false;
	}
}
import { log, logError } from "../utils/logger";
