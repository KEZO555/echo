# Spotify App Remote Lifecycle Management Fix

## Overview

This document explains the critical fix for Spotify App Remote connection lifecycle management, which addresses the issue where **Spotify app couldn't shutdown properly when your app was keeping the connection alive in the background**.

## The Problem

According to [Spotify Android SDK documentation](https://developer.spotify.com/documentation/android/tutorials/application-lifecycle):

> **"Do not keep the connection alive when your app is in the background, otherwise Spotify will not be able to shutdown when it's inactive"**

### What Was Wrong

1. **Missing Activity Lifecycle Integration** - The native SDK module didn't implement proper Android Activity lifecycle callbacks
2. **Connection Persisted in Background** - React Native `AppState` changes weren't properly managing the native connection
3. **No Automatic Disconnection** - App only reconnected on foreground but never disconnected on background

## The Solution

### 1. Native Android Lifecycle Integration

Added proper Activity lifecycle handlers in `SpotifySdkModule.kt`:

```kotlin
// Activity lifecycle handlers for proper connection management
OnActivityEntersForeground {
  Log.d(TAG, "Activity entered foreground - checking for auto-reconnect")
  if (shouldAutoConnect && lastConnectionParams != null) {
    Log.d(TAG, "Auto-reconnecting to Spotify App Remote")
    connectInternal(lastConnectionParams!!)
  }
}

OnActivityEntersBackground {
  Log.d(TAG, "Activity entered background - disconnecting from Spotify App Remote")
  disconnectInternal()
  sendEvent("onActivityStopped", mapOf("background" to true))
}
```

### 2. Auto-Connect Flag Management

Introduced `shouldAutoConnect` flag and connection parameter storage:

```kotlin
// Connection parameters for lifecycle management
private var lastConnectionParams: ConnectionParams? = null
private var shouldAutoConnect: Boolean = false
```

### 3. Proper Connection/Disconnection Flow

**When App Comes to Foreground:**

-   ✅ Check if auto-connect is enabled
-   ✅ Automatically reconnect using stored parameters

**When App Goes to Background:**

-   ✅ Automatically disconnect from Spotify App Remote
-   ✅ This allows Spotify to shutdown when inactive

### 4. React Native Integration

Updated `AuthContext.tsx` to work with the new lifecycle:

```typescript
// Enable auto-connect when user is logged in
SpotifySdk.enableAutoConnect(true);

// Listen to native lifecycle events
const connectedSubscription = SpotifySdk.addListener(
	"onConnected",
	handleNativeConnected
);
const disconnectedSubscription = SpotifySdk.addListener(
	"onDisconnected",
	handleNativeDisconnected
);
const activityStoppedSubscription = SpotifySdk.addListener(
	"onActivityStopped",
	handleActivityStopped
);
```

### 5. New API Methods

Added `enableAutoConnect(enable: boolean)` method to control the lifecycle behavior:

```typescript
// Enable auto-connect (typically after login)
await SpotifySdk.enableAutoConnect(true);

// Disable auto-connect (during logout)
await SpotifySdk.enableAutoConnect(false);
```

## Key Benefits

1. **Spotify Can Shutdown Properly** - When your app goes to background, Spotify is allowed to shutdown
2. **Seamless Reconnection** - When your app comes back to foreground, it automatically reconnects
3. **Battery Life** - Prevents keeping unnecessary connections alive
4. **User Experience** - Users can properly close Spotify when not in use

## Implementation Details

### Connection States

| App State           | Connection State | Auto-Connect | Behavior                |
| ------------------- | ---------------- | ------------ | ----------------------- |
| Foreground          | Connected        | Enabled      | Normal playback control |
| Background          | Disconnected     | Enabled      | Spotify can shutdown    |
| Foreground (return) | Auto-Reconnected | Enabled      | Seamless resume         |
| Logged Out          | Disconnected     | Disabled     | No connection attempts  |

### Event Flow

1. **User logs in** → `enableAutoConnect(true)` → Initial connection
2. **App goes to background** → Activity lifecycle triggers → Auto-disconnect
3. **App returns to foreground** → Activity lifecycle triggers → Auto-reconnect
4. **User logs out** → `enableAutoConnect(false)` → Permanent disconnect

## Breaking Changes

### For Developers

-   ⚠️ Connection state may now change automatically based on app lifecycle
-   ⚠️ Need to handle `onConnected`/`onDisconnected` events properly
-   ⚠️ `ensureAppRemoteConnection()` calls should account for lifecycle management

### Migration Guide

If you were manually managing connections:

```typescript
// ❌ Old approach - manual connection management
const connectToSpotify = async () => {
	await SpotifySdk.connect(clientId, redirectUri);
};

// ✅ New approach - lifecycle-aware management
const setupSpotifyConnection = async () => {
	await SpotifySdk.enableAutoConnect(true);
	await SpotifySdk.connect(clientId, redirectUri); // Initial connection
	// Lifecycle handles the rest automatically
};
```

## Testing

To verify the fix works:

1. **Login to your app** - Should see "Auto-connect enabled" logs
2. **Play music** - Verify playback works normally
3. **Put app in background** - Should see "Activity entered background" and disconnect logs
4. **Check Spotify app** - Should be able to close/shutdown Spotify normally
5. **Return to your app** - Should see "Activity entered foreground" and reconnect logs
6. **Verify playback** - Controls should work immediately

## References

-   [Spotify Android SDK Application Lifecycle](https://developer.spotify.com/documentation/android/tutorials/application-lifecycle)
-   [Android Activity Lifecycle](https://developer.android.com/guide/components/activities/activity-lifecycle)
-   [Expo Modules Activity Lifecycle](https://docs.expo.dev/modules/module-api/#onactivityentersfore-ground)
