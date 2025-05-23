# Context-Aware Playback with Spotify Android SDK

**Reliable hybrid solution for playing tracks with proper context support** 🎵

## 🎯 **The Problem**

When using the **Spotify Android Remote SDK**, playing individual tracks lacks context. This means:

-   ❌ **No skip context**: Skipping to next/previous doesn't work as expected
-   ❌ **No album flow**: Playing a track from an album doesn't continue to the next track
-   ❌ **No playlist flow**: Playing from playlists doesn't maintain the playlist order
-   ❌ **No liked songs context**: Liked songs don't flow naturally

## 🔧 **The Hybrid Solution**

Our implementation combines **Web API context setting** with **Native SDK control** for the best of both worlds:

### **Method 1: Web API Context + Native SDK Control** (Primary)

```typescript
// Use Web API to set context and specify starting track
await fetch("https://api.spotify.com/v1/me/player/play", {
	method: "PUT",
	headers: {
		Authorization: `Bearer ${accessToken}`,
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		context_uri: contextUri, // e.g., "spotify:album:4yP0hdKOZPNshxUOjY0cZj"
		offset: {
			uri: trackUri, // Start from this specific track
		},
	}),
});

// Then use Native SDK for immediate control
await SpotifySdk.play();
```

### **Method 2: Native SDK Context + Queue** (Fallback)

```typescript
// Play the context to establish it
await SpotifySdk.play(contextUri);

// Queue the specific track we want
await SpotifySdk.addToQueue(trackUri);

// Skip to the queued track
await SpotifySdk.skipNext();
```

### **Method 3: Queue Building for Liked Songs** (Special Case)

```typescript
// Play the target track first
await SpotifySdk.play(trackUri);

// Queue subsequent tracks for skip-next functionality
const tracksToQueue = tracks.slice(currentIndex + 1, currentIndex + 10);
for (const track of tracksToQueue) {
	await SpotifySdk.addToQueue(track.uri);
}
```

## 📱 **Usage Examples**

### **Enhanced Context-Aware Playback**

```typescript
import { useAuth } from "../contexts/AuthContext";

const { playTrackWithContext } = useAuth();

// 1. Playing from an Album
await playTrackWithContext("spotify:track:4iV5W9uYEdYUVa79Axb7Rh", {
	type: "album",
	uri: "spotify:album:4yP0hdKOZPNshxUOjY0cZj",
});

// 2. Playing from a Playlist
await playTrackWithContext("spotify:track:4iV5W9uYEdYUVa79Axb7Rh", {
	type: "playlist",
	uri: "spotify:playlist:37i9dQZF1DX2sUQwD7tbmL",
});

// 3. Playing from Liked Songs
await playTrackWithContext("spotify:track:4iV5W9uYEdYUVa79Axb7Rh", {
	type: "liked",
	tracks: savedTracks, // Your saved tracks array
	currentIndex: 5, // Index of the track being played
});

// 4. Fallback for Direct Play
await playTrackWithContext("spotify:track:4iV5W9uYEdYUVa79Axb7Rh");
```

### **Legacy Compatibility**

```typescript
// Still works with existing code
await playTrack(
	"spotify:track:4iV5W9uYEdYUVa79Axb7Rh",
	undefined,
	"spotify:album:4yP0hdKOZPNshxUOjY0cZj"
);
```

## 🔄 **Implementation Flow**

### **For Albums & Playlists**

```
1. Check if context URI is provided ✅
2. Use Web API to set context with track offset 📡
3. Wait for Spotify to process context (500ms) ⏱️
4. Use Native SDK for immediate control 📱
5. Fallback to queue method if Web API fails 🔄
6. Final fallback to direct track play 🎵
```

### **For Liked Songs**

```
1. Play target track directly 🎵
2. Queue next 10 tracks from liked songs 📝
3. Enable natural skip-next behavior ⏭️
4. Handle edge cases gracefully 🛡️
```

## 🎨 **Component Integration**

### **Track List Component**

```tsx
const TrackList = ({ tracks, contextUri, contextType }) => {
	const { playTrackWithContext } = useAuth();

	const handleTrackPress = async (track, index) => {
		await playTrackWithContext(track.uri, {
			type: contextType, // 'album' | 'playlist' | 'liked'
			uri: contextUri,
			tracks: contextType === "liked" ? tracks : undefined,
			currentIndex: contextType === "liked" ? index : undefined,
		});
	};

	return (
		<FlatList
			data={tracks}
			renderItem={({ item, index }) => (
				<TouchableOpacity onPress={() => handleTrackPress(item, index)}>
					{/* Track UI */}
				</TouchableOpacity>
			)}
		/>
	);
};
```

### **Album Screen**

```tsx
const AlbumScreen = ({ album }) => {
	const handleTrackPlay = async (track) => {
		await playTrackWithContext(track.uri, {
			type: "album",
			uri: album.uri,
		});
	};

	// ... component implementation
};
```

### **Playlist Screen**

```tsx
const PlaylistScreen = ({ playlist }) => {
	const handleTrackPlay = async (track) => {
		await playTrackWithContext(track.uri, {
			type: "playlist",
			uri: playlist.uri,
		});
	};

	// ... component implementation
};
```

### **Liked Songs Screen**

```tsx
const LikedSongsScreen = () => {
	const { savedTracks, playTrackWithContext } = useAuth();

	const handleTrackPlay = async (track, index) => {
		await playTrackWithContext(track.track.uri, {
			type: "liked",
			tracks: savedTracks,
			currentIndex: index,
		});
	};

	// ... component implementation
};
```

## 🔍 **Context Type Detection**

### **Smart Context Builder**

```typescript
const buildContextUri = (
	trackUri: string,
	sourceContext?: any
): string | null => {
	// Explicit context provided
	if (sourceContext && typeof sourceContext === "string") {
		return sourceContext;
	}

	// Auto-detect from source
	if (sourceContext?.type === "album") {
		return sourceContext.uri;
	}

	if (sourceContext?.type === "playlist") {
		return sourceContext.uri;
	}

	// Liked songs can't use URI context
	return null;
};
```

## 🚀 **Benefits**

### **Reliability**

-   ✅ **Triple fallback system**: Web API → Native SDK → Direct play
-   ✅ **Offline compatibility**: Native SDK works without internet
-   ✅ **Error resilience**: Graceful degradation on failures

### **Performance**

-   ⚡ **Instant control**: Native SDK provides immediate response
-   🔄 **Smart queueing**: Only queue what's needed for context
-   📱 **Battery efficient**: Minimal Web API calls

### **User Experience**

-   🎵 **Natural flow**: Skip next/previous works as expected
-   📱 **Consistent behavior**: Same as Spotify's official app
-   🎯 **Context preservation**: Albums and playlists flow naturally

## 🛡️ **Error Handling**

### **Connection Issues**

```typescript
try {
	// Primary method
	await playTrackWithContext(trackUri, context);
} catch (error) {
	// Automatic fallback to direct play
	console.log("Context playback failed, using direct play");
}
```

### **Web API Failures**

```typescript
// Automatic fallback chain
Web API Context → Native SDK Queue → Direct Play
```

### **Queue Failures**

```typescript
// Individual queue errors don't stop the process
for (const track of tracksToQueue) {
	try {
		await SpotifySdk.addToQueue(track.uri);
	} catch (queueError) {
		console.log("Queue error (continuing):", queueError);
	}
}
```

## 📊 **Debugging & Monitoring**

### **Console Logs**

```
AuthContext: Enhanced playback with context: {trackUri, sourceContext}
AuthContext: Using hybrid approach - Web API for context: {contextUri}
AuthContext: Successfully set context via Web API, now using Native SDK
AuthContext: Hybrid playback started successfully
```

### **Fallback Indicators**

```
AuthContext: Web API context failed, falling back to Native SDK only
AuthContext: Fallback - Playing context and queueing target track
AuthContext: Fallback method completed - context set and track queued
```

## 🔮 **Future Enhancements**

### **Smart Queue Management**

-   Pre-load next tracks based on listening patterns
-   Dynamic queue size based on connection quality
-   Background queue refresh for long sessions

### **Context Caching**

-   Cache frequently used contexts offline
-   Smart context prediction
-   Reduce Web API calls through intelligent caching

### **Advanced Skip Logic**

-   Previous track support for queued contexts
-   Shuffle-aware queueing
-   Cross-context seamless transitions

---

This hybrid approach provides **reliable, context-aware playback** that works both online and offline, giving users the natural Spotify experience they expect! 🎵✨
