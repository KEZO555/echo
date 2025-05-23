# Fresh App Load Playback Fix

## Overview

This document explains the fix for the issue where tracks would not play on the first attempt after a fresh app load (when the app has been destroyed), but would work on the second attempt.

## The Problem

### Symptoms

-   On fresh app loads, clicking a track would navigate to the playing screen but not actually play the track
-   The second click would work properly
-   This only happened when the app had been completely destroyed and restarted
-   Logs showed the error: `"Explicit user authorization is required to use Spotify"`

### Root Cause Analysis

The issue was caused by a **race condition between connection establishment and playback initiation**:

1. **App starts up** → `enableAutoConnect(true)` is called
2. **User clicks track** → `playTrack()` is called immediately
3. **Connection check** → `ensureAppRemoteConnection()` reports "connected" but connection isn't fully stable
4. **Playback attempt** → Fails with authorization error because connection isn't actually ready
5. **Second attempt** → Works because connection has had time to fully establish

The lifecycle management introduced proper connection/disconnection cycles, but the timing of initial connection establishment wasn't robust enough for immediate playback requests.

## The Solution

### 1. Connection Stabilization

Added a stabilization delay after successful connection to ensure it's fully ready:

```typescript
if (connectionResult.connected) {
	setIsConnectedToAppRemote(true);
	console.log("AuthContext: Successfully connected to App Remote");

	// Give the connection a moment to fully stabilize before returning
	// This helps with fresh app loads where the connection might report as connected
	// but not be fully ready for playback operations
	await new Promise((resolve) => setTimeout(resolve, 250));

	return true;
}
```

### 2. Proactive Initial Connection

Added proactive connection establishment during app startup:

```typescript
// Enable auto-connect for proper lifecycle management
console.log("AuthContext: Found stored token, enabling auto-connect");
await SpotifySdk.enableAutoConnect(true);

// Establish initial connection to prevent first-play issues
setTimeout(async () => {
	console.log("AuthContext: Establishing initial App Remote connection...");
	await ensureAppRemoteConnection();
}, 100); // Small delay to ensure the context is fully set up
```

### 3. Enhanced Force Connection Recovery

Added extra stabilization time when force connection is used:

```typescript
// If still not connected, try force connection as last resort
if (!connected) {
	console.log(
		"AuthContext: Normal connection failed, trying force connection..."
	);
	connected = await forceAppRemoteConnection();

	// For fresh app loads, give extra time for the forced connection to stabilize
	if (connected) {
		console.log(
			"AuthContext: Force connection succeeded, allowing stabilization time..."
		);
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
}
```

### 4. Foreground Connection Establishment

Added proactive connection when app comes to foreground:

```typescript
if (appState.match(/inactive|background/) && nextAppState === "active") {
	console.log("AuthContext: App came to foreground - enabling auto-connect");
	if (accessToken) {
		SpotifySdk.enableAutoConnect(true);

		// Proactively establish connection after coming to foreground
		setTimeout(async () => {
			console.log(
				"AuthContext: Proactively establishing connection after foreground..."
			);
			await ensureAppRemoteConnection();
		}, 200); // Slight delay to ensure lifecycle events are processed
	}
}
```

## Key Benefits

### ✅ **Eliminates First-Play Failures**

-   Tracks now play reliably on the first attempt after fresh app loads
-   No more "click twice to play" behavior

### ✅ **Maintains Lifecycle Benefits**

-   Preserves proper background/foreground connection management
-   Spotify can still shutdown properly when app is backgrounded

### ✅ **Robust Connection Management**

-   Multiple fallback layers for connection establishment
-   Proper timing for connection stabilization

### ✅ **Improved User Experience**

-   Consistent playback behavior regardless of app state
-   Reduces user frustration with failed playback attempts

## Implementation Details

### Connection Timing Strategy

| Scenario              | Timing                   | Purpose                                         |
| --------------------- | ------------------------ | ----------------------------------------------- |
| **Normal Connection** | 250ms stabilization      | Ensure connection is fully ready                |
| **App Startup**       | 100ms delay + connection | Proactive establishment after enableAutoConnect |
| **Force Connection**  | 500ms stabilization      | Extra time for complex reconnection scenarios   |
| **Foreground Return** | 200ms delay + connection | Account for lifecycle event processing          |

### Error Recovery Flow

```
1. Normal connection attempt
   ↓ (if fails)
2. Retry with 1-second delay
   ↓ (if fails)
3. Force connection with clean disconnect
   ↓ (if succeeds)
4. Additional stabilization time
   ↓
5. Playback attempt
```

## Testing

### Verification Steps

1. **Fresh App Load Test**

    - Kill the app completely
    - Restart the app
    - Immediately try to play a track
    - ✅ Should play on first attempt

2. **Background/Foreground Test**

    - Put app in background
    - Return to foreground
    - Try to play a track
    - ✅ Should work immediately

3. **Connection Recovery Test**
    - Simulate connection issues
    - Try to play tracks
    - ✅ Should recover gracefully with force connection

### Expected Logs

**Successful fresh load:**

```
LOG  AuthContext: Found stored token, enabling auto-connect
LOG  AuthContext: Establishing initial App Remote connection...
LOG  AuthContext: Successfully connected to App Remote
LOG  AuthContext: Playing track with hybrid approach: spotify:track:...
LOG  AuthContext: Hybrid playback started successfully
```

**Force connection recovery:**

```
LOG  AuthContext: Normal connection failed, trying force connection...
LOG  AuthContext: Force connection succeeded, allowing stabilization time...
LOG  AuthContext: Hybrid playback started successfully
```

## Impact

This fix resolves the most common user frustration with the app - the need to click tracks twice after app restarts. It maintains all the benefits of the lifecycle management while ensuring reliable first-attempt playback in all scenarios.

The solution is backwards compatible and doesn't affect existing functionality, only improves the reliability of connection establishment timing.
