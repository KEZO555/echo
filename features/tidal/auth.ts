// TIDAL OAuth2 Authorization Code + PKCE flow.
//
// TIDAL uses a public-client PKCE flow (no client secret), unlike Echo's
// Spotify confidential-client flow. We drive it with expo-auth-session, which
// generates the PKCE verifier/challenge and opens the system browser to
// login.tidal.com, returning to tide://callback.

import {
  AuthRequest,
  type DiscoveryDocument,
  exchangeCodeAsync,
  makeRedirectUri,
  ResponseType,
  refreshAsync,
  type TokenResponse,
} from "expo-auth-session";
import {
  TIDAL_AUTH,
  TIDAL_REDIRECT_PATH,
  TIDAL_REDIRECT_SCHEME,
  TIDAL_SCOPES,
} from "@/constants/tidal";

const discovery: DiscoveryDocument = {
  authorizationEndpoint: TIDAL_AUTH.authorizationEndpoint,
  tokenEndpoint: TIDAL_AUTH.tokenEndpoint,
};

export interface TidalTokens {
  accessToken: string;
  refreshToken?: string;
  // Absolute expiry as epoch milliseconds.
  expiresAt: number;
}

export const getRedirectUri = (): string =>
  makeRedirectUri({
    scheme: TIDAL_REDIRECT_SCHEME,
    path: TIDAL_REDIRECT_PATH,
  });

const toTokens = (token: TokenResponse): TidalTokens => {
  const expiresInSeconds = token.expiresIn ?? 3600;
  const issuedAtMs = (token.issuedAt ?? Date.now() / 1000) * 1000;
  return {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: issuedAtMs + expiresInSeconds * 1000,
  };
};

// Opens the TIDAL login page and exchanges the returned code (with PKCE) for
// tokens. Throws if the user cancels or authorization fails.
export const authorizeWithTidal = async (
  clientId: string
): Promise<TidalTokens> => {
  const redirectUri = getRedirectUri();
  const request = new AuthRequest({
    clientId,
    scopes: TIDAL_SCOPES,
    redirectUri,
    responseType: ResponseType.Code,
    usePKCE: true,
  });

  const result = await request.promptAsync(discovery);
  if (result.type !== "success" || !result.params.code) {
    throw new Error(`TIDAL authorization ${result.type}`);
  }

  const token = await exchangeCodeAsync(
    {
      clientId,
      code: result.params.code,
      redirectUri,
      extraParams: request.codeVerifier
        ? { code_verifier: request.codeVerifier }
        : undefined,
    },
    discovery
  );

  return toTokens(token);
};

// Exchanges a refresh token for a fresh access token. TIDAL may or may not
// return a new refresh token; callers should keep the previous one if absent.
export const refreshTidalTokens = async (
  clientId: string,
  refreshToken: string
): Promise<TidalTokens> => {
  const token = await refreshAsync({ clientId, refreshToken }, discovery);
  const tokens = toTokens(token);
  if (!tokens.refreshToken) {
    tokens.refreshToken = refreshToken;
  }
  return tokens;
};
