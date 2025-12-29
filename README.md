# Echo

A minimal Spotify client for Light Phone III.

## Setup

### 1. Create a Spotify App

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**
3. Fill in the app name and description
4. Set the **Redirect URI** to `echo://callback`
5. Select **Android** under "Which API/SDKs are you planning to use?"
6. Accept the terms and click **Save**
7. Go to **Settings** and note your **Client ID**
8. Under **Basic Information**, add your Android package:
   - **Package Name**: `com.vandam.echo`
   - **SHA1 Fingerprint**: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
9. Click **Save**

### 2. Deploy a Token Exchange Server

See [spotify-token-swap](https://github.com/bih/spotify-token-swap) for an example implementation.

### 3. Configure Echo

1. Open Echo on your device
2. Enter your **Client ID** from the Spotify Dashboard
3. Enter your **Server URL** (e.g. `https://your-server.com`)
4. Tap the arrow to save, then log in with Spotify

### Grayscale Permission

After installing, grant the grayscale toggle permission via ADB:

```bash
adb shell pm grant com.vandam.echo android.permission.WRITE_SECURE_SETTINGS
```

This allows the app to disable grayscale when opened and restore it when closed.
