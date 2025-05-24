# Spotify SDK Lifecycle Management

## Overview

The Spotify SDK now properly implements lifecycle management according to the [Spotify Android SDK documentation](https://developer.spotify.com/documentation/android/tutorials/application-lifecycle). This ensures that the Spotify app can properly shut down when your app is not active.

## Key Improvements

### 1. Automatic Disconnect on Background

When your app goes to the background, the SDK automatically disconnects from Spotify App Remote to allow Spotify to shut down properly.

### 2. Smart Reconnection

When your app returns to the foreground, the SDK can automatically reconnect if auto-connect is enabled.

### 3. Authentication-Safe Lifecycle

During authentication flows, the SDK won't disconnect to prevent interference with the auth process.

## Usage Examples

### Basic Connection with Lifecycle Management

```typescript
import SpotifySdk from "./modules/spotify-sdk";

// Connect to Spotify
await SpotifySdk.connect(clientId, redirectUri);

// Enable auto-reconnect (optional, enabled by default)
await SpotifySdk.enableAutoConnect(true);

// The SDK will automatically:
// - Disconnect when app goes to background
// - Reconnect when app returns to foreground (if auto-connect is enabled)
```

### Listening to Lifecycle Events

```typescript
import { useEffect } from "react";
import SpotifySdk from "./modules/spotify-sdk";

useEffect(() => {
	// Listen for activity lifecycle events
	const activityStartedListener = SpotifySdk.addListener(
		"onActivityStarted",
		(event) => {
			console.log("App entered foreground:", event.foreground);
		}
	);

	const activityStoppedListener = SpotifySdk.addListener(
		"onActivityStopped",
		(event) => {
			console.log("App entered background:", event.background);
			if (event.skipDisconnect) {
				console.log(
					"Disconnect skipped due to authentication in progress"
				);
			}
		}
	);

	// Listen for connection state changes
	const connectedListener = SpotifySdk.addListener("onConnected", (event) => {
		console.log("Connected to Spotify:", event.connected);
	});

	const disconnectedListener = SpotifySdk.addListener(
		"onDisconnected",
		(event) => {
			console.log("Disconnected from Spotify:", event.disconnected);
			if (event.forced) {
				console.log("This was a forced disconnect");
			}
		}
	);

	return () => {
		activityStartedListener?.remove();
		activityStoppedListener?.remove();
		connectedListener?.remove();
		disconnectedListener?.remove();
	};
}, []);
```

### Manual Disconnect

```typescript
// Manual disconnect (disables auto-reconnect)
await SpotifySdk.disconnect();

// Force disconnect (clears all state)
await SpotifySdk.forceDisconnect();
```

### Checking Connection Status

```typescript
const isConnected = await SpotifySdk.isConnected();
console.log("Currently connected:", isConnected);
```

## Best Practices

### 1. Don't Keep Connection Active in Background

The SDK handles this automatically, but avoid manually connecting when your app is in the background.

### 2. Handle Connection Errors Gracefully

```typescript
SpotifySdk.addListener("onConnectionError", (event) => {
	console.error("Connection error:", event.error);
	// Handle the error appropriately
});
```

### 3. Use Force Disconnect for Cleanup

When your app is being destroyed or you need to completely reset the connection state:

```typescript
await SpotifySdk.forceDisconnect();
```

### 4. Monitor Authentication State

During authentication flows, the SDK automatically prevents disconnection:

```typescript
SpotifySdk.addListener("onActivityStopped", (event) => {
	if (event.skipDisconnect) {
		// Authentication is in progress, disconnect was skipped
		console.log("Authentication in progress, keeping connection alive");
	}
});
```

## Troubleshooting

### Connection Not Disconnecting

If you notice the Spotify app staying active when your app is in the background:

1. Check if authentication is in progress
2. Verify auto-connect is properly configured
3. Use `forceDisconnect()` to reset all state
4. Check the logs for lifecycle events

### Unexpected Reconnections

If the app reconnects when you don't want it to:

1. Disable auto-connect: `await SpotifySdk.enableAutoConnect(false)`
2. Use manual disconnect: `await SpotifySdk.disconnect()`

### Debug Logging

The SDK provides detailed logging with the tag "SpotifySdkModule". Enable debug logging to see lifecycle events:

```bash
adb logcat | grep SpotifySdkModule
```

## Implementation Details

The lifecycle management follows the Spotify Android SDK recommendations:

-   **OnActivityEntersForeground**: Checks for auto-reconnect and existing connections
-   **OnActivityEntersBackground**: Disconnects unless authentication is in progress
-   **Connection Management**: Prevents duplicate connections and properly cleans up subscriptions
-   **Authentication Safety**: Skips disconnect during auth flows to prevent interference
