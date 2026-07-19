# TIDAL Official API Reference (for Tide)

The reference this port is built against. Source of truth: the official
`@tidal-music/api` (v0.34.0, OpenAPI-generated types) and `@tidal-music/auth`
(v1.6.1) npm packages, plus the TIDAL SDK docs and developer discussions.
`developer.tidal.com` itself is not fetchable from CI, so a few dashboard
details (exact scope descriptions, rate-limit numbers) are flagged as
to-confirm.

## OAuth2

Two flows:
- **Authorization Code + PKCE** — user context (favorites, playlists, playback).
  Public client, no secret. This is what Tide uses.
- **Client Credentials** — app-only catalog access (needs a secret).

Endpoints (SDK defaults):
- Authorization: `https://login.tidal.com/authorize`
- Token: `https://auth.tidal.com/v1/oauth2/token`

Authorization request (`GET /authorize`): `response_type=code`, `client_id`,
`redirect_uri`, `scope` (space-separated), `code_challenge_method=S256`,
`code_challenge`, `state`.

Token request (`POST /oauth2/token`, `application/x-www-form-urlencoded`):
- Auth-code exchange: `grant_type=authorization_code`, `code`, `redirect_uri`,
  `client_id`, `code_verifier`.
- Refresh: `grant_type=refresh_token`, `refresh_token`, `client_id`.
- Client credentials: `grant_type=client_credentials` (+ client_id/secret).

Token response: `access_token`, `refresh_token` (auth-code/refresh only),
`expires_in` (seconds), `token_type` = `Bearer`, `scope`. Refresh proactively
(~60s before expiry).

Scopes (confirmed): `user.read`, `collection.read`, `collection.write`,
`playlists.read`, `playlists.write`, `entitlements.read`. Search/recommendation
scope strings were not confirmed from official docs — verify in the dashboard.

Redirect URI: registered per-app in the dashboard. Tide uses `tide://callback`.

## API transport

- Base URL: `https://openapi.tidal.com/v2/`
- Format: **JSON:API** (`data` / `attributes` / `relationships` / `included` /
  `links`).
- Headers: `Authorization: Bearer <token>`, `Accept: application/vnd.api+json`;
  for POST/PATCH/DELETE also `Content-Type: application/vnd.api+json`; optional
  `Idempotency-Key` on mutations.
- `countryCode` (ISO 3166-1 alpha-2): typed optional but effectively required
  on catalog endpoints — always send it.
- `locale`: BCP-47, defaults to `en-US`.
- `include`: array selecting related resources to sideload.
- Pagination: **cursor-based** via `page[cursor]`; follow `links.next`. No
  page/offset. Some list endpoints accept `sort` (prefix `-` for descending).
- Errors: JSON:API error docs; `400, 403, 404, 405, 406, 415, 429, 500, 503`.
  Rate limits enforced (429) but exact numbers not published — back off and
  respect `Retry-After`.

## Key endpoints

All relative to `https://openapi.tidal.com/v2/`.

- **Current user**: `GET /users/{id}` with `id=me`.
- **Search**: `GET /searchResults/{query}` (query is URL-encoded). Params:
  `countryCode`, `explicitFilter` (`INCLUDE`|`EXCLUDE`), `include`
  (`albums, artists, playlists, topHits, tracks, videos`). Typed relationships:
  `GET /searchResults/{query}/relationships/{albums|artists|tracks|playlists|videos|topHits}`.
  Also `GET /searchSuggestions/{query}`.
- **Catalog by id** (+ `/relationships/...`):
  - `GET /tracks/{id}` — rel: `albums`, `artists`, `credits`, `genres`,
    `lyrics`, `radio`, `similarTracks`, `providers`, `usageRules`.
  - `GET /albums/{id}` — rel: `items` (tracks), `artists`, `coverArt`,
    `similarAlbums`, `genres`.
  - `GET /artists/{id}` — rel: `albums`, `tracks`, `videos`, `radio`,
    `similarArtists`, `biography`, `roles`.
  - `GET /playlists/{id}` — rel: `items`, `coverArt`, `owners`.
- **Multiple by ids**: `GET /tracks?filter[id]=ID1&filter[id]=ID2&countryCode=US`
  (also `filter[isrc]`). Same for `/albums`, `/artists`, `/playlists`.
- **Favorites / collection** (`{id}=me`, GET/POST/DELETE on `items`):
  - `/userCollectionTracks/me/relationships/items`
  - `/userCollectionAlbums/me/relationships/items`
  - `/userCollectionArtists/me/relationships/items`
  - `/userCollectionPlaylists/me/relationships/items`
  POST adds, DELETE removes; body is a JSON:API relationship doc (array of
  `{type, id}`). The aggregate `GET /userCollections/{id}` is deprecated.
- **User playlists**: list `GET /playlists?filter[owners.id]=me`; get
  `GET /playlists/{id}`; create `POST /playlists`; update `PATCH /playlists/{id}`;
  delete `DELETE /playlists/{id}`; items
  `GET|POST|PATCH|DELETE /playlists/{id}/relationships/items` (PATCH reorders).
- **Recommendations**: `GET /userRecommendations/me` (rel: `discoveryMixes`,
  `myMixes`, `newArrivalMixes`); plus `/userDailyMixes/{id}` etc.

## Playback / streaming

Official entry point is the track manifest (v2 replacement for the legacy
internal `playbackinfo`):

- **`GET /trackManifests/{id}`** (also `GET /videoManifests/{id}`).
- Query: `manifestType` (`HLS`|`MPEG_DASH`), `formats`
  (`HEAACV1|AACLC|FLAC|FLAC_HIRES|EAC3_JOC`), `uriScheme` (`HTTPS`|`DATA`),
  `usage` (`PLAYBACK`|`DOWNLOAD`), `adaptive` (boolean), optional `shareCode`.
- Response (`type: trackManifests`) attributes: `uri` (HTTPS URL or inline
  `data:` URI), `formats`, `hash`, `drmData`, `trackPresentation`
  (`FULL`|`PREVIEW`), `previewReason`
  (`FULL_REQUIRES_SUBSCRIPTION`|`FULL_REQUIRES_PURCHASE`|`FULL_REQUIRES_HIGHER_ACCESS_TIER`),
  audio-normalization data.
- The manifest itself is HLS or MPEG-DASH.
- **Access**: dedicated `403` response. Full playback requires an entitled user
  (subscription / access tier); otherwise a `PREVIEW` manifest is returned.
  Broad full-stream access is gated — generally requires TIDAL approval. Send a
  user token carrying `entitlements.read`.

## Building the client

The official packages generate their types from the OpenAPI spec via
`openapi-typescript` + `openapi-fetch`. For a fuller/authoritative path list,
vendor the spec from `@tidal-music/api` (`dist/src/allAPI.generated.d.ts`) or
the API reference page. `features/tidal/` currently hand-rolls the subset Tide
needs.

## Sources
- `@tidal-music/api` v0.34.0 (npm) — generated OpenAPI types.
- `@tidal-music/auth` v1.6.1 (npm) — auth endpoints, grants, PKCE.
- https://github.com/tidal-music/tidal-sdk/blob/main/Auth.md
- https://tidal-music.github.io/tidal-api-reference/
- TIDAL GitHub discussions #78 / #84 / #90 — scopes, collection endpoints.
