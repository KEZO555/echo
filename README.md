<p>A minimal TIDAL client for the Light Phone III.</p>

> [!WARNING]
> Tide is a work in progress. It is a fork of [Echo](https://github.com/vandamd/echo)
> (a Spotify client) being migrated to TIDAL's official API. The data and
> playback layers are still being ported — see [Status](#status) below.

## About
Tide reuses Echo's minimal, Light-Phone-friendly UI and rebuilds the backend on
[TIDAL's official OpenAPI (v2)](https://developer.tidal.com) with an OAuth2
PKCE login. It is designed primarily for the Light Phone III.

## Setup
### Prerequisites
- An active TIDAL subscription (HiFi or HiFi Plus for full-quality playback).
- A TIDAL developer app (free to create — see below).

### 1. Create a TIDAL Developer App
1. Go to [developer.tidal.com](https://developer.tidal.com) and sign in with
   your TIDAL account.
2. Open the **Dashboard** and **Create App**.
3. Give it a name and description.
4. Add a **Redirect URI** of `tide://callback`.
5. Note your **Client ID**. (The PKCE flow Tide uses does **not** require a
   client secret.)
6. Under the app's scopes, request at least: `user.read`, `collection.read`,
   `collection.write`, `playlists.read`, `playlists.write`, `entitlements.read`.

> [!NOTE]
> Full-quality streaming through the official API is access-gated. Standard
> developer apps get catalog + user data; streaming manifests may return a
> **preview** until your app/account is approved for full playback. Tide
> surfaces the `previewReason` when that happens.

### 2. Configure Tide
1. Open Tide on your device.
2. Enter your **Client ID** from the TIDAL developer dashboard.
3. Tap **Login** — you'll be taken to TIDAL's login page in the browser and
   returned to Tide (`tide://callback`) on success.
4. If it worked, you'll see your TIDAL collection.

## Status
Tide is being ported from Echo in phases:

- [x] **Phase 0** — Rebrand Echo → Tide (app identity, package, scheme).
- [x] **Phase 0** — TIDAL API client core (`features/tidal/`): OAuth2 PKCE
      auth, JSON:API request layer, and typed endpoints (user, search,
      catalog, favorites, playlists, track manifest).
- [ ] **Phase 1** — Wire the auth flow + credentials screen to TIDAL.
- [ ] **Phase 2** — Migrate the data layer screen-by-screen (library, search,
      albums, artists, playlists) off the Spotify Web API.
- [ ] **Phase 3** — Playback via TIDAL's official streaming API
      (`/trackManifests/{id}`).
- [ ] **Phase 4** — Remove the legacy Spotify SDK module and Spotify code.

See [`docs/TIDAL_API.md`](docs/TIDAL_API.md) for the API reference this port is
built against.

## Credits
Forked from [Echo](https://github.com/vandamd/echo) by vandamd. Tide adapts it
for TIDAL.
