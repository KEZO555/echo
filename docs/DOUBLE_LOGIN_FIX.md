# Double Login Authentication Fix

## Problem Description

Users had to press the Login button twice to successfully authenticate. This issue was introduced when the lifecycle management was added to properly handle Spotify App Remote connections according to Spotify's guidelines.

## Root Cause Analysis

The issue was caused by a **race condition between authentication flow and lifecycle management**:

1. **User presses Login** → Authentication starts (`isAuthenticating = true`)
2. **Authentication opens Spotify app** → User's app goes to background
3. **App lifecycle automatically disconnects** from App Remote (following Spotify guidelines)
4. **Authentication completes** → Returns `{"disconnected": true}` because App Remote was just disconnected
5. **First login attempt fails** with "Unknown error" due to inconsistent SDK state
6. **Second login attempt works** because app state has settled

### Log Evidence

```
LOG  AuthContext: Starting native Spotify authentication...
LOG  AuthContext: Native SDK disconnected: {"disconnected": true}
LOG  AuthContext: Authentication result: {"disconnected": true}
ERROR  AuthContext: Authentication failed: Unknown error
LOG  AuthContext: Activity stopped (background): {"background": true}
```

## Solution Implementation

### 1. Authentication State Flag

Added `isAuthenticating` flag in `SpotifySdkModule.kt`:

```kotlin
private var isAuthenticating: Boolean = false
```

### 2. Prevent Lifecycle Interference

Modified the background lifecycle handler to skip disconnection during authentication:

```kotlin
OnActivityEntersBackground {
  Log.d(TAG, "Activity entered background - checking if authentication is in progress")
  if (isAuthenticating) {
    Log.d(TAG, "Authentication in progress - skipping disconnect to prevent auth interference")
    sendEvent("onActivityStopped", mapOf("background" to true, "skipDisconnect" to true))
  } else {
    Log.d(TAG, "Disconnecting from Spotify App Remote")
    disconnectInternal()
    sendEvent("onActivityStopped", mapOf("background" to true))
  }
}
```

### 3. Authentication Flag Management

Set the flag when authentication starts in all auth methods:

```kotlin
// In authorizeWithToken, authorizeWithCode, authorize methods
currentAuthPromise = promise
isAuthenticating = true // Set flag to prevent lifecycle disconnection during auth

// ... auth logic ...

} catch (e: Exception) {
  isAuthenticating = false // Clear flag on error
  promise.reject("AUTH_ERROR", e.message, e)
}
```

Clear the flag when authentication completes:

```kotlin
// In handleActivityResult after all auth response handling
// Clear authentication flag after auth completes (success or failure)
isAuthenticating = false
currentAuthPromise = null
```

### 4. React Native Side Handling

Updated `AuthContext.tsx` to handle the skip disconnect flag:

```typescript
const handleActivityStopped = (event: any) => {
	console.log("AuthContext: Activity stopped (background):", event);
	if (event.skipDisconnect) {
		console.log(
			"AuthContext: Skipping connection state reset - authentication in progress"
		);
	} else {
		setIsConnectedToAppRemote(false);
	}
};
```

Added a small delay after authentication to allow state to settle:

```typescript
// Small delay to allow authentication state to settle
await new Promise((resolve) => setTimeout(resolve, 500));

// Enable auto-connect for proper lifecycle management
SpotifySdk.enableAutoConnect(true);
```

## Benefits

1. **Single Login Required** - Authentication now works on the first attempt
2. **Maintains Lifecycle Compliance** - Still follows Spotify's background disconnection guidelines
3. **Race Condition Resolved** - Authentication and lifecycle management no longer conflict
4. **Better User Experience** - No more confusing double-login requirement

## Testing

To verify the fix:

1. **Press Login once** - Should authenticate successfully on first attempt
2. **Check logs** - Should see "Authentication in progress - skipping disconnect" when app goes to background during auth
3. **Verify normal lifecycle** - When not authenticating, app should still disconnect when going to background
4. **Test multiple scenarios** - Login, logout, re-login should all work smoothly

## Additional Fix: Preventing Multiple Authentication Flows

After the initial fix, we discovered a secondary issue where multiple authentication flows were running simultaneously, causing duplicate data fetching and logout conflicts.

### Additional Changes Made:

#### 1. Prevent Duplicate Authentication Attempts

```typescript
const login = useCallback(async () => {
	if (isAuthenticating) {
		console.log(
			"AuthContext: Authentication already in progress, ignoring duplicate request"
		);
		return;
	}

	setIsAuthenticating(true);
	// ... auth logic ...
}, [isAuthenticating]);
```

#### 2. Prevent loadStoredAuth Re-runs During Authentication

```typescript
const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
const [isAuthenticating, setIsAuthenticating] = useState(false);

useEffect(() => {
	// Only run this effect once on mount, not during authentication
	if (hasInitiallyLoaded || isAuthenticating) return;
	// ... load logic ...
}, [isAuthenticating]); // Changed from multiple dependencies to prevent re-runs
```

#### 3. Block Logout During Authentication

```typescript
const logout = useCallback(async () => {
  // Don't logout during authentication
  if (isAuthenticating) {
    console.log("AuthContext: Logout blocked - authentication in progress");
    return;
  }
  // ... logout logic ...
}, [isAuthenticating, ...]);
```

## Technical Details

The complete fix maintains the delicate balance between:

-   **Spotify's requirement**: Disconnect when app goes to background to allow Spotify to shut down
-   **Authentication flow**: Don't interfere with the auth process by disconnecting mid-authentication
-   **Single authentication flow**: Prevent multiple simultaneous authentication attempts
-   **State consistency**: Prevent logout from interfering with active authentication

The dual `isAuthenticating` flags (both native and React Native side) act as guards to ensure authentication flows run cleanly without interference from lifecycle management or competing authentication attempts.
