# Spotify Light

A Spotify client for Light Phone III.

## Setup

After installing, grant the grayscale toggle permission via ADB:

```bash
adb shell pm grant com.vandamd.spotifylight android.permission.WRITE_SECURE_SETTINGS
```

This allows the app to disable grayscale when opened and restore it when closed.
