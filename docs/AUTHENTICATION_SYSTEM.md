# Spotify Authentication System Documentation

## Overview

The Spotify app implements a sophisticated authentication system that combines native Android SDK authentication with Web API token management. This hybrid approach provides the best of both worlds: native SDK integration for seamless playback control and Web API access for comprehensive data management.

## Architecture Components

### 1. Authentication Flow

-   **Primary Method**: Native Android SDK Token Flow (`authorizeWithToken`)
-   **Token Types**: Access tokens with 1-hour expiration
-   **Storage**: Expo SecureStore for secure token persistence
-   **Session Management**: Automatic token refresh and proactive expiration handling

### 2. Key Components

#### AuthContext (`contexts/AuthContext.tsx`)

-   Central authentication state management
-   Token lifecycle management
-   API request handling with automatic refresh
-   Native SDK connection management

#### Storage Keys

```typescript
const AUTH_TOKEN_KEY = "spotifyAuthToken";
const REFRESH_TOKEN_KEY = "spotifyRefreshToken";
const USER_INFO_KEY = "spotifyUserInfo";
const TOKEN_EXPIRY_KEY = "spotifyTokenExpiry";
```

## Authentication Flow Details

### Initial Authentication

1. **User Login Trigger**

    ```typescript
    const login = useCallback(async () => {
    	setIsAuthenticating(true);
    	const authResult = await SpotifySdk.authorizeWithToken(
    		SPOTIFY_CLIENT_ID,
    		REDIRECT_URI,
    		SPOTIFY_SCOPES
    	);
    });
    ```

2. **Token Storage**

    - Access token stored securely in Expo SecureStore
    - Expiry time calculated (50 minutes for conservative handling)
    - User info fetched and cached
    - Auto-connect enabled for native SDK

3. **Initial Data Loading**
    - Cache-first strategy for instant UI updates
    - Parallel fetching of playlists, albums, and saved tracks
    - Background refresh with fresh API data

### Token Management

#### Proactive Token Refresh

```typescript
useEffect(() => {
	if (!accessToken || !tokenExpiry) return;

	const checkAndRefreshToken = async () => {
		const timeUntilExpiry = tokenExpiry - Date.now();
		const fifteenMinutes = 15 * 60 * 1000;

		// Refresh 15 minutes before expiry
		if (timeUntilExpiry < fifteenMinutes && timeUntilExpiry > 0) {
			await refreshAccessToken();
		}
	};

	// Check every 5 minutes
	const interval = setInterval(checkAndRefreshToken, 5 * 60 * 1000);
}, [accessToken, tokenExpiry, refreshAccessToken]);
```

#### Web API Token Refresh

The system implements proper Web API token refresh (though currently limited by TOKEN flow):

```typescript
const refreshAccessToken = useCallback(async (currentRefreshToken?: string) => {
	const response = await fetch("https://accounts.spotify.com/api/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(
			tokenToUse
		)}&client_id=${SPOTIFY_CLIENT_ID}`,
	});

	if (response.ok) {
		const data = await response.json();
		setAccessToken(data.access_token);
		// Update stored tokens and expiry
	}
});
```

### API Request Handling

#### Smart API Request Wrapper

All Web API calls go through `makeApiRequest` which provides:

1. **Automatic Token Refresh**
2. **Retry Logic**
3. **Error Handling**
4. **Proactive Expiry Checks**

```typescript
const makeApiRequest = useCallback(
	async (
		url: string,
		errorMessage: string,
		isRefreshing = false,
		retryCount = 0
	): Promise<any | null> => {
		// Proactive refresh if token expires within 5 minutes
		if (accessToken && tokenExpiry && refreshToken && retryCount === 0) {
			const timeUntilExpiry = tokenExpiry - Date.now();
			if (timeUntilExpiry < 5 * 60 * 1000) {
				await refreshAccessToken(refreshToken);
			}
		}

		// Make API request with Authorization header
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});

		// Handle 401 errors with automatic token refresh
		if (response.status === 401 && retryCount < 1 && refreshToken) {
			const refreshed = await refreshAccessToken(refreshToken);
			if (refreshed) {
				return makeApiRequest(url, errorMessage, isRefreshing, 1);
			}
		}

		return response.ok ? await response.json() : null;
	}
);
```

## Native SDK Integration

### Connection Management

```typescript
const ensureAppRemoteConnection = useCallback(async (): Promise<boolean> => {
	const connected = await SpotifySdk.isConnected();
	if (!connected) {
		const connectionResult = await SpotifySdk.connect(
			SPOTIFY_CLIENT_ID,
			REDIRECT_URI
		);
		return connectionResult.connected;
	}
	return true;
});
```

### Lifecycle Management

-   **App State Monitoring**: Automatic reconnection when app becomes active
-   **Background Handling**: Graceful disconnection when app goes to background
-   **Auto-Connect**: Enabled after successful authentication

## Security Features

### Secure Storage

-   **Expo SecureStore**: Hardware-backed storage on supported devices
-   **Token Encryption**: Automatic encryption of stored tokens
-   **Automatic Cleanup**: Tokens cleared on logout or authentication failure

### Token Security

-   **Limited Scope**: Only requests necessary permissions
-   **Expiry Handling**: Conservative 50-minute expiry (vs 60-minute actual)
-   **Automatic Refresh**: Minimizes exposure time of tokens
-   **Secure Transmission**: HTTPS for all API communications

### Session Management

```typescript
const logout = useCallback(async () => {
	// Clear native SDK session
	await SpotifySdk.enableAutoConnect(false);
	await SpotifySdk.disconnect();
	await SpotifySdk.clearSession();

	// Clear stored tokens
	await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
	await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
	await SecureStore.deleteItemAsync(USER_INFO_KEY);

	// Clear application state
	setAccessToken(null);
	setRefreshToken(null);
	setUser(null);

	// Clear cached data
	await clearCachedData();
});
```

## Offline Support

### Cache-First Strategy

1. **Immediate UI**: Load cached data instantly on app start
2. **Background Sync**: Fetch fresh data in background
3. **Graceful Degradation**: Continue working offline with cached data

### Cached Data Types

-   User playlists and metadata
-   Saved albums and tracks
-   Album artwork (data URIs from native SDK)
-   User profile information

## Error Handling

### Network Errors

-   Graceful handling of offline scenarios
-   Automatic retry for temporary network issues
-   Fallback to cached data when API unavailable

### Authentication Errors

-   **401 Errors**: Automatic token refresh attempt
-   **Invalid Tokens**: Force re-authentication
-   **Network Timeouts**: Retry with exponential backoff

### User Experience

-   Loading states for all authentication operations
-   Clear error messages for user-facing issues
-   Seamless background token refresh (user unaware)

## Configuration

### Required Permissions (Scopes)

```typescript
const SPOTIFY_SCOPES = [
	"user-read-email", // User profile access
	"user-library-read", // Saved tracks/albums
	"user-library-modify", // Save/unsave functionality
	"user-read-recently-played", // Recent playback
	"user-top-read", // Top tracks/artists
	"playlist-read-private", // Private playlists
	"playlist-read-collaborative", // Collaborative playlists
	"playlist-modify-public", // Modify public playlists
	"playlist-modify-private", // Modify private playlists
	"user-modify-playback-state", // Control playback
	"user-read-playback-state", // Read playback state
	"streaming", // Native SDK playback
];
```

### Client Configuration

```typescript
const SPOTIFY_CLIENT_ID = "2f20bc972e764706956ba7b59648b707";
const REDIRECT_URI = "spotify-light://callback";
```

## Future Improvements

### Planned Enhancements

1. **PKCE Implementation**: Migrate to Authorization Code Flow with PKCE for enhanced security
2. **Refresh Token Support**: Full refresh token implementation (requires CODE flow)
3. **Token Rotation**: Implement proper token rotation strategies
4. **Background Refresh**: Implement background token refresh for longer sessions

### Known Limitations

1. **TOKEN Flow**: Limited to 1-hour sessions without refresh tokens
2. **Manual Re-auth**: Users must re-authenticate after extended periods
3. **Client Secret**: Cannot use CODE flow without PKCE due to mobile security constraints

## Troubleshooting

### Common Issues

#### "Token Expired" Errors

-   **Cause**: Token expiry after 1 hour of inactivity
-   **Solution**: Automatic refresh implemented in `makeApiRequest`
-   **User Action**: None required (handled automatically)

#### Connection Issues

-   **Cause**: Native SDK connection failures
-   **Solution**: Automatic retry with `forceAppRemoteConnection`
-   **Fallback**: Web API for essential functionality

#### Storage Issues

-   **Cause**: SecureStore access failures
-   **Solution**: Graceful fallback to logged-out state
-   **Recovery**: User re-authentication required

### Debugging

#### Authentication State

```typescript
// Check current auth state
console.log("Access Token:", accessToken ? "Present" : "Missing");
console.log("Token Expiry:", new Date(tokenExpiry || 0));
console.log("User:", user?.display_name || "Not logged in");
```

#### Connection State

```typescript
// Check native SDK connection
const connected = await SpotifySdk.isConnected();
console.log("Native SDK Connected:", connected);
```

This authentication system provides a robust, secure, and user-friendly experience while handling the complexities of OAuth token management and native SDK integration.
