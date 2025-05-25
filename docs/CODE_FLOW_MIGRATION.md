# Migration to CODE Flow with Server-Side Token Exchange

## Overview

This document outlines the migration from Spotify's TOKEN flow to the CODE flow with server-side token exchange to enable proper token refresh functionality.

## Problem with TOKEN Flow

The previous implementation used the TOKEN flow (`AuthorizationResponse.Type.TOKEN`), which has several limitations:

1. **No Refresh Tokens**: TOKEN flow only provides access tokens without refresh tokens
2. **Short-lived Tokens**: Access tokens expire after 1 hour with no way to refresh
3. **Forced Re-authentication**: Users must re-authenticate every hour
4. **Poor User Experience**: Frequent login prompts interrupt the user experience

## Solution: CODE Flow with Server-Side Exchange

The new implementation uses the CODE flow (`AuthorizationResponse.Type.CODE`) with server-side token exchange, which provides:

1. **Refresh Tokens**: Long-lived tokens that can refresh access tokens
2. **Seamless Token Refresh**: Automatic token refresh without user intervention
3. **Enhanced Security**: Client secret stored securely on server, refresh tokens encrypted
4. **Better UX**: Users stay logged in for extended periods
5. **Production Ready**: Follows OAuth 2.0 best practices for mobile apps

## Implementation Details

### 1. PKCE Generation (`utils/pkce.ts`)

```typescript
// Generate cryptographically secure code verifier
const codeVerifier = generateCodeVerifier(128);

// Generate SHA256-based code challenge
const codeChallenge = generateCodeChallenge(codeVerifier);
```

### 2. Authorization Request

```typescript
// Store code verifier securely for later use
await SecureStore.setItemAsync(CODE_VERIFIER_KEY, codeVerifier);

// Request authorization code with PKCE
const authResult = await SpotifySdk.authorizeWithCode(
	SPOTIFY_CLIENT_ID,
	REDIRECT_URI,
	SPOTIFY_SCOPES,
	undefined, // state
	false, // showDialog
	codeChallenge
);
```

### 3. Token Exchange (`services/tokenExchange.ts`)

```typescript
// Exchange authorization code for tokens
const tokenResponse = await exchangeCodeForTokens(
	authorizationCode,
	codeVerifier,
	REDIRECT_URI
);

// Store both access and refresh tokens
await SecureStore.setItemAsync(AUTH_TOKEN_KEY, tokenResponse.access_token);
await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokenResponse.refresh_token);
```

### 4. Automatic Token Refresh

```typescript
// Proactive refresh 15 minutes before expiry
if (timeUntilExpiry < 15 * 60 * 1000) {
	const newTokens = await refreshAccessToken(refreshToken);
	// Update stored tokens automatically
}
```

## Security Enhancements

### PKCE Flow Security

1. **Code Verifier**: 128-character random string stored securely
2. **Code Challenge**: SHA256 hash of code verifier, sent to authorization server
3. **Verification**: Authorization server verifies code verifier matches challenge
4. **Protection**: Prevents authorization code interception attacks

### Token Storage

-   **Expo SecureStore**: Hardware-backed encryption on supported devices
-   **Automatic Cleanup**: Code verifiers deleted after use
-   **Secure Transmission**: All API calls use HTTPS

## Migration Benefits

### For Users

-   **Seamless Experience**: No frequent re-authentication required
-   **Offline Capability**: Cached data remains accessible during token refresh
-   **Faster App Startup**: Stored tokens enable immediate functionality

### For Developers

-   **Reliable API Access**: Automatic token refresh prevents API failures
-   **Better Error Handling**: Graceful degradation when tokens expire
-   **Enhanced Security**: PKCE protection against common OAuth attacks

## API Changes

### Android SDK Module

```kotlin
// New method signature with PKCE support
AsyncFunction("authorizeWithCode") {
  clientId: String,
  redirectUri: String,
  scopes: Array<String>,
  state: String?,
  showDialog: Boolean?,
  codeChallenge: String?, // New PKCE parameter
  promise: Promise ->

  // Add PKCE parameters to authorization request
  if (codeChallenge != null) {
    builder.setCustomParam("code_challenge", codeChallenge)
    builder.setCustomParam("code_challenge_method", "S256")
  }
}
```

### TypeScript Interface

```typescript
interface SpotifyAuthConfig {
	clientId: string;
	redirectUri: string;
	scopes: string[];
	showDialog?: boolean;
	state?: string;
	responseType?: "code" | "token";
	codeChallenge?: string; // New PKCE parameter
}
```

## Error Handling

### Token Refresh Failures

1. **Network Errors**: Retry with exponential backoff
2. **Invalid Refresh Token**: Clear session and require re-authentication
3. **Server Errors**: Log error and attempt fallback strategies

### Graceful Degradation

1. **Offline Mode**: Continue with cached data when API unavailable
2. **Token Expiry**: Proactive refresh prevents service interruption
3. **Authentication Errors**: Clear invalid tokens and prompt re-login

## Testing Strategy

### Unit Tests

-   PKCE generation and validation
-   Token exchange functionality
-   Error handling scenarios

### Integration Tests

-   End-to-end authentication flow
-   Token refresh scenarios
-   Offline/online transitions

### Manual Testing

-   Fresh installation authentication
-   Token expiry and refresh
-   Network interruption handling

## Monitoring and Logging

### Key Metrics

-   Token refresh success rate
-   Authentication failure reasons
-   API request success/failure rates

### Debug Logging

```typescript
console.log("Auth: Starting authentication with CODE flow + PKCE...");
console.log("Auth: Authorization code received, exchanging for tokens...");
console.log("Auth: Authentication successful with refresh token");
```

## Rollback Plan

If issues arise with the CODE flow implementation:

1. **Immediate**: Revert to TOKEN flow for critical functionality
2. **Short-term**: Fix identified issues while maintaining TOKEN fallback
3. **Long-term**: Complete migration to CODE flow once stable

## Future Enhancements

### Planned Improvements

1. **Token Rotation**: Implement refresh token rotation for enhanced security
2. **Biometric Authentication**: Add biometric unlock for stored tokens
3. **Multi-Account Support**: Support multiple Spotify accounts
4. **Background Refresh**: Refresh tokens in background service

### Performance Optimizations

1. **Caching Strategy**: Optimize token storage and retrieval
2. **Network Efficiency**: Batch API requests when possible
3. **Memory Management**: Efficient token lifecycle management

## Conclusion

The migration to CODE flow with PKCE significantly improves the authentication experience by providing:

-   **Reliable token refresh** without user intervention
-   **Enhanced security** through PKCE protection
-   **Better user experience** with seamless authentication
-   **Robust error handling** for various failure scenarios

This implementation follows OAuth 2.1 best practices and provides a solid foundation for future authentication enhancements.
