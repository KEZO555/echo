# Spotify SDK Refactoring Plan

## Overview

This document outlines a plan to improve the Spotify Android SDK module implementation. The goals are:

1. **Better lifecycle management** — Use native Expo module hooks instead of JS AppState handling
2. **Cleaner TypeScript API** — Wrapper class with automatic connection management
3. **React hooks** — Easy-to-use hooks for connection state and player state
4. **Reduced boilerplate** — Less manual promise juggling and event subscription management

## Current State

### Architecture

```
modules/spotify-sdk/
├── android/src/main/java/expo/modules/spotifysdk/
│   └── SpotifySdkModule.kt          # Native Kotlin module
├── src/
│   ├── SpotifySdkModule.ts          # TypeScript declarations
│   └── SpotifySdk.types.ts          # Type definitions
├── index.ts                          # Module exports
└── expo-module.config.json
```

### Current Issues

| Issue | Location | Impact |
|-------|----------|--------|
| Manual AppState handling | `PlaybackContext.tsx:213-245` | ~30 lines of boilerplate, runs in JS (less reliable) |
| 5-minute disconnect timeout | `PlaybackContext.tsx:225-232` | Based on online/offline status (irrelevant for App Remote) |
| Missing TypeScript declarations | `SpotifySdkModule.ts` | `isConnected()`, `getCurrentTrackImage()` not declared |
| No native lifecycle hooks | `SpotifySdkModule.kt` | No `OnActivityEntersForeground`, `OnActivityEntersBackground`, `OnDestroy` |
| Promise juggling | `SpotifySdkModule.kt:32-33` | `currentAuthPromise` stored as module state, resolved from multiple places |
| Connection logic duplication | `spotifyPlayback.ts:28-63` | `ensureAppRemoteConnection()` called in every service function |

### Spotify App Remote SDK Facts

Important context for design decisions:

- **App Remote uses local IPC** — Communication with Spotify app is local, not over internet
- **Internet NOT required for connection** — Only needed for initial auth and streaming music
- **Disconnect recommended on `onStop`** — Per official SDK docs, disconnect when activity stops
- **`OnActivityEntersForeground`/`OnActivityEntersBackground`** — Maps to Android's `onResume`/`onPause` (not `onStart`/`onStop`, which aren't available in Expo modules)

---

## DeepWiki Verification (Pre-Implementation Check)

Verified implementation details against official documentation via DeepWiki.

### Spotify Android SDK Findings

| Topic | Official Recommendation | Our Approach | Status |
|-------|------------------------|--------------|--------|
| Disconnect timing | Call `disconnect()` in `onStop()` | Use `onPause()` equivalent with 30s delay | ✅ Acceptable (see below) |
| Reconnection | Disconnect existing remote before reconnecting | `connectInternal` already does this | ✅ Correct |
| Subscription cleanup | Cancel subscriptions before disconnect | `disconnectInternal` cancels subscriptions | ✅ Correct |
| Connection in lifecycle | Connect in `onCreate`/when needed | Lazy connect on first operation | ✅ Better approach |

### Expo Modules API Findings

| Topic | Finding | Impact |
|-------|---------|--------|
| `OnActivityEntersForeground` | Maps to Android `onResume()` | ✅ Use for reconnection |
| `OnActivityEntersBackground` | Maps to Android `onPause()` | ⚠️ See lifecycle limitation below |
| `onStart`/`onStop` | NOT available in Expo modules | ⚠️ Must use delay to compensate |
| `OnDestroy` | Module-level cleanup | ✅ Use for final cleanup |
| `OnActivityDestroys` | Activity-level cleanup | ✅ Should also use this |
| `Handler.postDelayed` | Safe to use in lifecycle hooks | ✅ Plan is correct |

### Lifecycle Limitation & Mitigation

**Issue:** Spotify SDK recommends `onStop()` for disconnect, but Expo only provides `onPause()` equivalent.

**Difference:**
- `onPause()` — Activity partially obscured (e.g., dialog opens, split-screen)
- `onStop()` — Activity fully hidden (e.g., user presses home, switches app)

**Risk:** Disconnecting on `onPause()` could cause premature disconnection when:
- A system dialog appears
- Split-screen mode is activated
- Another activity partially covers the app

**Mitigation:** Our 30-second delay prevents premature disconnection:
- If user returns within 30s → pending disconnect is cancelled
- If user fully backgrounds app → disconnect after 30s
- This is MORE conservative than SDK sample (which disconnects immediately in `onStop`)

**Conclusion:** The 30-second delay makes `onPause()`-based disconnect safe and actually provides a better UX than immediate `onStop()` disconnect.

### Additional Recommendation: Add OnActivityDestroys

Based on DeepWiki findings, we should also add `OnActivityDestroys` hook for activity-level cleanup, in addition to `OnDestroy` for module-level cleanup.

```kotlin
OnActivityDestroys {
    Log.d(TAG, "Activity destroying - cleaning up")
    
    // Cancel any pending disconnect
    disconnectRunnable?.let { mainHandler.removeCallbacks(it) }
    disconnectRunnable = null
    
    // Clean up subscriptions
    playerStateSubscription?.cancel()
    playerStateSubscription = null
    
    // Disconnect from Spotify
    spotifyAppRemote?.let { SpotifyAppRemote.disconnect(it) }
    spotifyAppRemote = null
}
```

---

## Implementation Plan

### Phase 1: Native Lifecycle & TypeScript Fixes

**Priority:** High  
**Risk:** Low (additive changes)

#### 1.1 Add Lifecycle Hooks to SpotifySdkModule.kt

Add the following to `ModuleDefinition`:

**New imports:**
```kotlin
import android.os.Handler
import android.os.Looper
```

**New properties:**
```kotlin
private val mainHandler = Handler(Looper.getMainLooper())
private var disconnectRunnable: Runnable? = null
private val DISCONNECT_DELAY_MS = 30_000L // 30 seconds
```

**New lifecycle hooks:**

```kotlin
OnActivityEntersForeground {
    Log.d(TAG, "Activity entered foreground")
    
    // Cancel any pending disconnect
    disconnectRunnable?.let { 
        mainHandler.removeCallbacks(it)
        disconnectRunnable = null
        Log.d(TAG, "Cancelled pending disconnect")
    }
    
    // Auto-reconnect if we have stored connection params and not currently authenticating
    if (!isAuthenticating && lastConnectionParams != null && spotifyAppRemote?.isConnected != true) {
        Log.d(TAG, "Auto-reconnecting to Spotify App Remote")
        connectInternal(lastConnectionParams!!)
    }
    
    sendEvent("onActivityStarted", mapOf("foreground" to true))
}

OnActivityEntersBackground {
    Log.d(TAG, "Activity entered background")
    
    // Schedule delayed disconnect (30 seconds)
    if (!isAuthenticating && spotifyAppRemote?.isConnected == true) {
        disconnectRunnable = Runnable {
            Log.d(TAG, "Executing delayed disconnect")
            disconnectInternal()
            disconnectRunnable = null
        }
        mainHandler.postDelayed(disconnectRunnable!!, DISCONNECT_DELAY_MS)
        Log.d(TAG, "Scheduled disconnect in ${DISCONNECT_DELAY_MS}ms")
    }
    
    sendEvent("onActivityStopped", mapOf("background" to true))
}

OnDestroy {
    Log.d(TAG, "Module destroying - cleaning up")
    
    // Cancel any pending disconnect
    disconnectRunnable?.let { mainHandler.removeCallbacks(it) }
    
    // Clean up subscriptions
    playerStateSubscription?.cancel()
    playerStateSubscription = null
    
    // Disconnect from Spotify
    spotifyAppRemote?.let { SpotifyAppRemote.disconnect(it) }
    spotifyAppRemote = null
}

OnActivityDestroys {
    Log.d(TAG, "Activity destroying - cleaning up")
    
    // Cancel any pending disconnect
    disconnectRunnable?.let { mainHandler.removeCallbacks(it) }
    disconnectRunnable = null
    
    // Clean up subscriptions
    playerStateSubscription?.cancel()
    playerStateSubscription = null
    
    // Disconnect from Spotify  
    spotifyAppRemote?.let { SpotifyAppRemote.disconnect(it) }
    spotifyAppRemote = null
}
```

**Why 30-second delay?**
- Prevents connection churn when quickly switching apps (checking notifications, etc.)
- Immediate disconnect would require reconnection on every brief app switch
- 5 minutes (current) is too long and wastes resources
- 30 seconds covers typical quick app switches
- **Compensates for Expo's `onPause` limitation** — SDK recommends `onStop`, but Expo only has `onPause` equivalent; delay prevents premature disconnect when activity is partially obscured

#### 1.2 Fix Missing TypeScript Declarations

**File:** `modules/spotify-sdk/src/SpotifySdkModule.ts`

Add missing declarations to the `SpotifySdkModule` class:

```typescript
isConnected(): Promise<boolean>;
getCurrentTrackImage(size?: string): Promise<string>;
```

#### 1.3 Files Modified

| File | Changes |
|------|---------|
| `modules/spotify-sdk/android/src/main/java/expo/modules/spotifysdk/SpotifySdkModule.kt` | Add lifecycle hooks, Handler for delayed disconnect |
| `modules/spotify-sdk/src/SpotifySdkModule.ts` | Add `isConnected`, `getCurrentTrackImage` declarations |

---

### Phase 2: TypeScript Wrapper & Hooks

**Priority:** Medium  
**Risk:** Low (new files, no modifications to existing code)

#### 2.1 Create Wrapper Class

**File:** `modules/spotify-sdk/src/spotify.ts`

```typescript
import SpotifySdkNative from './SpotifySdkModule';
import { SPOTIFY_CLIENT_ID, REDIRECT_URI } from '@/constants/spotify';
import type { SpotifyPlayerState } from './SpotifySdk.types';

class SpotifySDK {
    private connectionPromise: Promise<boolean> | null = null;
    
    // Connection management with deduplication
    async connect(): Promise<boolean> {
        if (this.connectionPromise) return this.connectionPromise;
        
        this.connectionPromise = (async () => {
            try {
                if (await this.isConnected()) return true;
                const result = await SpotifySdkNative.connect(SPOTIFY_CLIENT_ID, REDIRECT_URI);
                return result.connected;
            } finally {
                this.connectionPromise = null;
            }
        })();
        
        return this.connectionPromise;
    }
    
    async disconnect(): Promise<void> {
        await SpotifySdkNative.disconnect();
    }
    
    async isConnected(): Promise<boolean> {
        return SpotifySdkNative.isConnected();
    }
    
    // Player controls with auto-connection
    async play(uri?: string): Promise<void> {
        await this.ensureConnected();
        await SpotifySdkNative.play(uri);
    }
    
    async pause(): Promise<void> {
        await this.ensureConnected();
        await SpotifySdkNative.pause();
    }
    
    async resume(): Promise<void> {
        await this.ensureConnected();
        await SpotifySdkNative.resume();
    }
    
    async skipNext(): Promise<void> {
        await this.ensureConnected();
        await SpotifySdkNative.skipNext();
    }
    
    async skipPrevious(): Promise<void> {
        await this.ensureConnected();
        await SpotifySdkNative.skipPrevious();
    }
    
    async seekTo(positionMs: number): Promise<void> {
        await this.ensureConnected();
        await SpotifySdkNative.seekTo(positionMs);
    }
    
    async setShuffle(enabled: boolean): Promise<void> {
        await this.ensureConnected();
        await SpotifySdkNative.setShuffle(enabled);
    }
    
    async setRepeat(mode: number): Promise<void> {
        await this.ensureConnected();
        await SpotifySdkNative.setRepeat(mode);
    }
    
    async getPlayerState(): Promise<SpotifyPlayerState | null> {
        if (!(await this.isConnected())) return null;
        return SpotifySdkNative.getPlayerState();
    }
    
    async getImage(uri: string, size?: string): Promise<string | null> {
        await this.ensureConnected();
        return SpotifySdkNative.getImage(uri, size);
    }
    
    async getCurrentTrackImage(size?: string): Promise<string | null> {
        await this.ensureConnected();
        return SpotifySdkNative.getCurrentTrackImage(size);
    }
    
    // Library methods
    async addToLibrary(uri: string): Promise<boolean> {
        await this.ensureConnected();
        const result = await SpotifySdkNative.addToLibrary(uri);
        return result.added;
    }
    
    async removeFromLibrary(uri: string): Promise<boolean> {
        await this.ensureConnected();
        const result = await SpotifySdkNative.removeFromLibrary(uri);
        return result.removed;
    }
    
    async getLibraryState(uri: string): Promise<{ isAdded: boolean; canAdd: boolean } | null> {
        if (!(await this.isConnected())) return null;
        return SpotifySdkNative.getLibraryState(uri);
    }
    
    // Internal helper
    private async ensureConnected(): Promise<void> {
        if (!(await this.isConnected())) {
            const connected = await this.connect();
            if (!connected) throw new Error('Failed to connect to Spotify');
        }
    }
    
    // Event subscriptions with automatic cleanup
    onPlayerStateChanged(callback: (state: SpotifyPlayerState) => void): () => void {
        const subscription = SpotifySdkNative.addListener('onPlayerStateChanged', 
            (event) => callback(event.playerState)
        );
        return () => subscription.remove();
    }
    
    onConnectionChanged(callback: (connected: boolean) => void): () => void {
        const connectedSub = SpotifySdkNative.addListener('onConnected', () => callback(true));
        const disconnectedSub = SpotifySdkNative.addListener('onDisconnected', () => callback(false));
        return () => {
            connectedSub.remove();
            disconnectedSub.remove();
        };
    }
    
    onError(callback: (error: string) => void): () => void {
        const subscription = SpotifySdkNative.addListener('onConnectionError', 
            (event) => callback(event.error)
        );
        return () => subscription.remove();
    }
}

export const spotify = new SpotifySDK();
```

**Benefits:**
- Single instance (singleton pattern)
- Connection deduplication (prevents multiple simultaneous connect attempts)
- Auto-connection before operations
- No need to pass `clientId`/`redirectUri` everywhere
- Clean subscription management with automatic cleanup functions

#### 2.2 Create useSpotifyConnection Hook

**File:** `modules/spotify-sdk/src/hooks/useSpotifyConnection.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { spotify } from '../spotify';

export function useSpotifyConnection() {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    useEffect(() => {
        // Initial connection check
        spotify.isConnected().then(setIsConnected);
        
        // Subscribe to connection changes
        const unsubscribeConnection = spotify.onConnectionChanged(setIsConnected);
        const unsubscribeError = spotify.onError(setError);
        
        return () => {
            unsubscribeConnection();
            unsubscribeError();
        };
    }, []);
    
    const connect = useCallback(async () => {
        setIsConnecting(true);
        setError(null);
        try {
            const result = await spotify.connect();
            setIsConnected(result);
            return result;
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Connection failed');
            return false;
        } finally {
            setIsConnecting(false);
        }
    }, []);
    
    const disconnect = useCallback(async () => {
        await spotify.disconnect();
        setIsConnected(false);
    }, []);
    
    return { isConnected, isConnecting, error, connect, disconnect };
}
```

#### 2.3 Create usePlayerState Hook

**File:** `modules/spotify-sdk/src/hooks/usePlayerState.ts`

```typescript
import { useState, useEffect } from 'react';
import { spotify } from '../spotify';
import type { SpotifyPlayerState } from '../SpotifySdk.types';

export function usePlayerState() {
    const [playerState, setPlayerState] = useState<SpotifyPlayerState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        // Initial fetch
        spotify.getPlayerState()
            .then(setPlayerState)
            .catch(() => setPlayerState(null))
            .finally(() => setIsLoading(false));
        
        // Subscribe to changes
        return spotify.onPlayerStateChanged(setPlayerState);
    }, []);
    
    return { playerState, isLoading };
}
```

#### 2.4 Create Hooks Index

**File:** `modules/spotify-sdk/src/hooks/index.ts`

```typescript
export { useSpotifyConnection } from './useSpotifyConnection';
export { usePlayerState } from './usePlayerState';
```

#### 2.5 Update Module Exports

**File:** `modules/spotify-sdk/index.ts`

```typescript
// Native module (low-level)
export { default as SpotifySdkNative } from './src/SpotifySdkModule';

// Wrapper (recommended)
export { spotify } from './src/spotify';

// Hooks
export { useSpotifyConnection, usePlayerState } from './src/hooks';

// Types
export * from './src/SpotifySdk.types';
```

#### 2.6 Files Created/Modified

| File | Action |
|------|--------|
| `modules/spotify-sdk/src/spotify.ts` | Create |
| `modules/spotify-sdk/src/hooks/useSpotifyConnection.ts` | Create |
| `modules/spotify-sdk/src/hooks/usePlayerState.ts` | Create |
| `modules/spotify-sdk/src/hooks/index.ts` | Create |
| `modules/spotify-sdk/index.ts` | Modify |

---

### Phase 3: Migrate PlaybackContext

**Priority:** Medium  
**Risk:** Medium (modifying working code)

#### 3.1 Remove Manual AppState Handling

**Current code to remove** (from `PlaybackContext.tsx`):

```typescript
// REMOVE: Lines 213-245
useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (appState.match(/inactive|background/) && nextAppState === "active") {
            // ...
        } else if (appState === "active" && nextAppState.match(/inactive|background/)) {
            // 5-minute timeout logic
        }
        setAppState(nextAppState);
    };

    const appStateSubscription = AppState.addEventListener("change", handleAppStateChange);
    return () => appStateSubscription?.remove();
}, [appState, isOnline]);
```

**Why remove?**
- Native lifecycle hooks now handle connect/disconnect
- 30-second native delay replaces 5-minute JS timeout
- `isOnline` check is irrelevant (App Remote uses local IPC)

#### 3.2 Remove Interval-Based Connection Checking

**Current code to remove** (from `PlaybackContext.tsx`):

```typescript
// REMOVE: Lines 247-264
useEffect(() => {
    if (!accessToken) return;

    const checkRemoteConnection = async () => {
        try {
            const connected = await SpotifySdk.isConnected();
            setIsConnectedToAppRemote(connected);
        } catch (error) {
            setIsConnectedToAppRemote(false);
        }
    };

    checkRemoteConnection();
    const interval = setInterval(checkRemoteConnection, 30000);
    return () => clearInterval(interval);
}, [accessToken]);
```

**Why remove?**
- `useSpotifyConnection` hook handles this via events
- No need for polling — native module emits events on state change

#### 3.3 Use New Hook

**Replace with:**

```typescript
import { useSpotifyConnection } from '@/modules/spotify-sdk';

export const PlaybackProvider = ({ children }: { children: ReactNode }) => {
    const { accessToken, ensureValidToken } = useAuth();
    const { isConnected: isConnectedToAppRemote } = useSpotifyConnection();
    
    // ... rest of context (playback controls, etc.)
};
```

#### 3.4 Simplified PlaybackContext

After changes, `PlaybackContext.tsx` will be significantly smaller:
- Remove `AppState` import and handling (~30 lines)
- Remove `disconnectTimeoutRef` and timeout logic (~15 lines)
- Remove interval-based connection checking (~18 lines)
- Remove `isOnline` dependency
- Remove `appState` from context value (if not needed elsewhere)

**Estimated reduction:** ~60 lines

#### 3.5 Files Modified

| File | Changes |
|------|---------|
| `features/playback/contexts/PlaybackContext.tsx` | Remove AppState handling, remove timeout logic, use hook |

---

### Phase 4: Optional Improvements

**Priority:** Low  
**Risk:** Low

#### 4.1 Add Error Type Handling in Kotlin

Import specific Spotify SDK error types for better error messages:

```kotlin
import com.spotify.android.appremote.api.error.*

// In onFailure callback:
override fun onFailure(error: Throwable) {
    val errorInfo = when (error) {
        is CouldNotFindSpotifyApp -> mapOf(
            "code" to "SPOTIFY_NOT_INSTALLED", 
            "message" to "Spotify app not found"
        )
        is NotLoggedInException -> mapOf(
            "code" to "NOT_LOGGED_IN", 
            "message" to "Please log in to Spotify"
        )
        is UserNotAuthorizedException -> mapOf(
            "code" to "NOT_AUTHORIZED", 
            "message" to "Please authorize this app"
        )
        is AuthenticationFailedException -> mapOf(
            "code" to "AUTH_FAILED", 
            "message" to "Authentication failed"
        )
        is UnsupportedFeatureVersionException -> mapOf(
            "code" to "UPDATE_REQUIRED", 
            "message" to "Please update Spotify"
        )
        is OfflineModeException -> mapOf(
            "code" to "OFFLINE", 
            "message" to "Spotify is in offline mode"
        )
        else -> mapOf(
            "code" to "UNKNOWN", 
            "message" to (error.message ?: "Unknown error")
        )
    }
    
    Log.e(TAG, "Connection failed: ${errorInfo["code"]} - ${errorInfo["message"]}")
    sendEvent("onConnectionError", errorInfo)
    currentAuthPromise?.reject(errorInfo["code"] as String, errorInfo["message"] as String, error)
}
```

**Benefits:**
- User-friendly error messages
- Actionable error codes (can show "Install Spotify" button, etc.)
- Better debugging

#### 4.2 Simplify spotifyPlayback.ts

Once the wrapper is in place, `spotifyPlayback.ts` can be simplified:

**Before:**
```typescript
export const startPlayback = async (): Promise<void> => {
    try {
        const connected = await ensureAppRemoteConnection();
        if (!connected) return;
        const result = await SpotifySdk.resume();
        if (result.resumed) log("Playback: Playback resumed");
    } catch (error) {
        logError("Playback: Error starting playback:", error);
    }
};
```

**After:**
```typescript
import { spotify } from '@/modules/spotify-sdk';

export const startPlayback = async (): Promise<void> => {
    try {
        await spotify.resume(); // Auto-connects if needed
        log("Playback: Playback resumed");
    } catch (error) {
        logError("Playback: Error starting playback:", error);
    }
};
```

**Benefits:**
- Remove `ensureAppRemoteConnection()` calls from every function
- Remove connection caching logic (wrapper handles it)
- Cleaner, more focused service functions

---

## Migration Guide

### For Screens/Components

**Before:**
```typescript
import SpotifySdk from '@/modules/spotify-sdk';

// Manual connection check
const connected = await SpotifySdk.isConnected();
if (!connected) {
    await SpotifySdk.connect(CLIENT_ID, REDIRECT_URI);
}
await SpotifySdk.play(uri);
```

**After:**
```typescript
import { spotify } from '@/modules/spotify-sdk';

// Auto-connects
await spotify.play(uri);
```

### For Hooks

**Before:**
```typescript
const [isConnected, setIsConnected] = useState(false);

useEffect(() => {
    SpotifySdk.isConnected().then(setIsConnected);
    const interval = setInterval(async () => {
        const connected = await SpotifySdk.isConnected();
        setIsConnected(connected);
    }, 30000);
    return () => clearInterval(interval);
}, []);
```

**After:**
```typescript
import { useSpotifyConnection } from '@/modules/spotify-sdk';

const { isConnected } = useSpotifyConnection();
```

### For Event Subscriptions

**Before:**
```typescript
useEffect(() => {
    const sub1 = SpotifySdk.addListener('onPlayerStateChanged', handler);
    const sub2 = SpotifySdk.addListener('onConnected', connectedHandler);
    const sub3 = SpotifySdk.addListener('onDisconnected', disconnectedHandler);
    
    return () => {
        sub1.remove();
        sub2.remove();
        sub3.remove();
    };
}, []);
```

**After:**
```typescript
import { spotify } from '@/modules/spotify-sdk';

useEffect(() => {
    const unsubscribe = spotify.onPlayerStateChanged(handler);
    return unsubscribe;
}, []);

// Or use the hook
import { usePlayerState } from '@/modules/spotify-sdk';
const { playerState } = usePlayerState();
```

---

## Testing Checklist

### Phase 1

- [ ] App connects to Spotify when opened
- [ ] App disconnects ~30s after backgrounding
- [ ] App reconnects when returning to foreground
- [ ] Quick app switch (< 30s) doesn't cause reconnection
- [ ] Auth flow still works (connection preserved during auth)
- [ ] TypeScript types are correct (no TS errors)

### Phase 2

- [ ] `spotify.play()` auto-connects if needed
- [ ] `useSpotifyConnection` reflects actual connection state
- [ ] `usePlayerState` receives player state updates
- [ ] Event subscriptions clean up properly on unmount

### Phase 3

- [ ] PlaybackContext still works
- [ ] No more AppState errors in console
- [ ] Connection state updates in UI

### Phase 4

- [ ] Specific error messages shown for different failure types
- [ ] `spotifyPlayback.ts` functions still work

---

## Rollback Plan

Each phase is independent and can be rolled back:

| Phase | Rollback Method |
|-------|-----------------|
| Phase 1 | Remove lifecycle hooks from Kotlin, revert TS declarations |
| Phase 2 | Delete new files, revert `index.ts` |
| Phase 3 | Restore AppState handling in PlaybackContext |
| Phase 4 | Remove error type handling, restore old service functions |

---

## Timeline Estimate

| Phase | Estimated Time |
|-------|----------------|
| Phase 1 | 30 minutes |
| Phase 2 | 1 hour |
| Phase 3 | 30 minutes |
| Phase 4 | 30 minutes |
| **Total** | **~2.5 hours** |

---

## Open Questions

1. **Should the wrapper be a singleton or factory?** Current plan uses singleton (`export const spotify = new SpotifySDK()`). Factory would allow multiple instances if needed.

2. **Should we expose the native module directly?** Current plan exports both `SpotifySdkNative` (low-level) and `spotify` (wrapper). Could hide native module entirely.

3. **Should hooks live in the module or in features?** Current plan puts them in `modules/spotify-sdk/src/hooks/`. Alternative: `features/playback/hooks/`.
