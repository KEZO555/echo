// TIDAL official OpenAPI (v2) + OAuth2 configuration.
// Endpoint defaults confirmed from the official @tidal-music/auth and
// @tidal-music/api packages. See docs/TIDAL_API.md for the full spec.

export const TIDAL_AUTH = {
  authorizationEndpoint: "https://login.tidal.com/authorize",
  tokenEndpoint: "https://auth.tidal.com/v1/oauth2/token",
} as const;

export const TIDAL_API_BASE = "https://openapi.tidal.com/v2";

// JSON:API media type used for both Accept and Content-Type.
export const TIDAL_JSON_API_MEDIA_TYPE = "application/vnd.api+json";

// The redirect registered for the native app: tide://callback
export const TIDAL_REDIRECT_SCHEME = "tide";
export const TIDAL_REDIRECT_PATH = "callback";

// Scopes confirmed from the official auth SDK / TIDAL developer discussions.
// Only what the app is approved for in the dashboard is actually granted.
export const TIDAL_SCOPES = [
  "user.read",
  "collection.read",
  "collection.write",
  "playlists.read",
  "playlists.write",
  "entitlements.read",
];

// countryCode is typed optional in the spec but is effectively required for
// catalog resolution; we fall back to this until the user's profile country
// is known.
export const DEFAULT_COUNTRY_CODE = "US";

// Secure-store / async-storage keys.
export const TIDAL_ACCESS_TOKEN_KEY = "tidalAccessToken";
export const TIDAL_REFRESH_TOKEN_KEY = "tidalRefreshToken";
export const TIDAL_TOKEN_EXPIRY_KEY = "tidalTokenExpiry";
export const TIDAL_USER_INFO_KEY = "tidalUserInfo";
export const TIDAL_COUNTRY_KEY = "tidalCountryCode";
