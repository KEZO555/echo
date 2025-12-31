<img src="assets/images/example.png" alt="Echo Screenshots">

<p>A minimal Spotify client for the Light Phone III.</p>

![GitHub License](https://img.shields.io/github/license/vandamd/echo)
![GitHub Release](https://img.shields.io/github/v/release/vandamd/echo)

## Installation
NOTE: There are a few steps required to do before you can use Echo. Please read the [Setup](#setup) section below.

The lastest .apk file is available in [releases](https://github.com/vandamd/echo/releases/latest).

I recommend using [Obtainium](https://github.com/ImranR98/Obtainium) and adding the repository's URL to receive updates.

## Setup

### Prerequisites
- Spotify installed on your device
- Logged in to your Spotify account in the Spotify app

### 1. Create a Spotify Developer App

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**
3. Fill in the app name and description
4. Set the **Redirect URI** to `echo://callback`
5. Select **Android** and **Web API** under "Which API/SDKs are you planning to use?"
6. Accept the terms and click **Save**
7. Go to **Settings** and note your **Client ID** and **Client Secret**
8. Under **Basic Information**, add your Android package:
   - **Package Name**: `com.vandam.echo`
   - **SHA1 Fingerprint**: `73:25:19:F7:40:25:9D:F2:B0:B2:CC:C1:5D:09:D6:7E:72:20:C2:64`
9. Click **Save**

### 2. Deploy a Token Exchange Server

See [echo-token-server](https://github.com/vandamd/echo-token-server) for setup instructions.

### 3. Configure Echo

1. Open Echo on your device
2. Enter your **Client ID** from the Spotify Dashboard
3. Enter your **Server URL** (e.g. `https://your-server.com`)
4. Tap the arrow to save, then log in with Spotify

## Features

- Song library with full playback
- Browse artists, albums, playlists and podcasts
- Playback controls (play/pause, skip, seek, shuffle, repeat)
- Save and unsave tracks
- Add tracks to playlists
- Device selection for remote playback

## Limitations

- Requires the Spotify app to be installed
- No Spotify owned content (e.g. Radio, Daylist, Playlists like "Discover Weekly")
- No queue management
- Limited offline functionality

## Greyscale Toggle

Echo can automatically disable greyscale while the app is open and restore it when you leave.

This requires granting the app special permission via ADB:

```bash
adb shell pm grant com.vandam.echo android.permission.WRITE_SECURE_SETTINGS
```

## Support
Echo is developed and maintained in my free time.

If you find it useful, please [consider sponsoring](https://github.com/sponsors/vandamd)! :)
