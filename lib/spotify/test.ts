import SpotifySDK from "./index";

export async function testSpotifySDK() {
	try {
		console.log("Testing Spotify SDK module...");

		// Test that the module is accessible
		console.log("SpotifySDK instance:", SpotifySDK);

		// Test a simple function call (should return NOT_IMPLEMENTED error)
		try {
			await SpotifySDK.authorize({
				clientId: "test",
				redirectUri: "test://callback",
				scopes: ["user-read-playback-state"],
			});
		} catch (error) {
			console.log("Expected error from authorize:", error);
		}

		console.log("Spotify SDK module test completed successfully!");
		return true;
	} catch (error) {
		console.error("Spotify SDK module test failed:", error);
		return false;
	}
}
