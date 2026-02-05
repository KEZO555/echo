# Echo - Codebase Audit & Improvement Plan

Full codebase audit across 8 dimensions: simplification, performance, patterns, architecture, TypeScript quality, security, useEffect compliance, and component reusability.

**Codebase**: ~12,600 lines | **Date**: February 2026

---

## Phase 1: Dead Code Removal

Zero-risk removals. No behaviour change.

### 1.1 Remove `fetchInitialDataInParallel`

136-line function exported but never imported anywhere.

- **File**: `features/auth/services/spotifyAuth.ts` lines 238-374
- **Why dead**: `LibraryContext` handles initial data fetching directly

### 1.2 Remove stale `AuthContextType`

115-line interface from pre-split monolithic architecture. References methods like `playTracksWithWebApi`, `forceAppRemoteConnection` that no longer exist.

- **File**: `shared/types/spotify.ts` lines 399-513
- **Why dead**: Real `AuthContextType` lives in `features/auth/contexts/AuthContext.tsx`

### 1.3 Remove duplicate `searchItems` and `addTrackToPlaylist`

Near-identical copies that live in the playback service but are only ever imported from their canonical locations.

- **File**: `features/playback/services/spotifyPlayback.ts` lines 457-540
- **Canonical**: `features/search/services/spotifySearch.ts` and `features/library/services/spotifyData.ts`
- Also remove the unused wrappers in `features/playback/contexts/PlaybackContext.tsx`

### 1.4 Remove `deduplicatedRequest`

Exported function with supporting `pendingRequests` Map. Never imported.

- **File**: `shared/utils/spotifyApi.ts` lines 19-48

### 1.5 Remove no-op `handleTokenUpdate`

Empty callback with a comment. Still wired into dependency arrays.

- **File**: `features/library/contexts/LibraryContext.tsx` lines 162-167
- Also remove references at lines 183, 189

### 1.6 Remove invisible `loadingOverlay`

`backgroundColor: "rgba(0, 0, 0, 0)"` - fully transparent overlay. The `isLoading` prop is never set to `true` by any consumer.

- **File**: `shared/components/MediaListItem.tsx` lines 51, 60, 116-125

### 1.7 Remove unused `getDensityNormalization`

Only referenced in a docs/plans markdown file. No runtime usage.

- **File**: `shared/utils/scaling.ts` line 7

### 1.8 Remove unused `isInitialLoading` state

State is set but never read.

- **File**: `app/playing.tsx` line 129

**Total: ~407 lines removed**

---

## Phase 2: Quick Performance Wins

Low-risk changes with high performance impact.

### 2.1 Replace sort `useEffect` + `setState` with `useMemo`

Current pattern causes a double render on every data change (first render with stale data, then re-render with sorted data). Also violates the project's useEffect guidelines.

**Files** (6 screens):
- `app/(tabs)/albums.tsx` lines 46-57
- `app/(tabs)/artists.tsx` lines 32-45
- `app/(tabs)/playlists.tsx` lines 51-72
- `app/(tabs)/podcasts.tsx` lines 55-66
- `app/add-to-playlist.tsx` lines 40-62
- `app/(tabs)/index.tsx` line 198 (inline filter)

```typescript
// Before
const [sortedAlbums, setSortedAlbums] = useState(null);
useEffect(() => {
    if (albums) {
        const sorted = [...albums].sort((a, b) => {
            const nameA = a.album.artists[0]?.name.toLowerCase() || "";
            const nameB = b.album.artists[0]?.name.toLowerCase() || "";
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return 0;
        });
        setSortedAlbums(sorted);
    }
}, [albums]);

// After
const sortedAlbums = useMemo(() =>
    albums?.toSorted((a, b) =>
        (a.album.artists[0]?.name ?? "").localeCompare(b.album.artists[0]?.name ?? "")
    ) ?? null
, [albums]);
```

Also removes the duplicated sort logic inside `handleRefresh` callbacks in each file.

### 2.2 Batch AsyncStorage cache checks with `multiGet`

Currently iterates all items with sequential `await` per item. 50 albums = 50 native bridge calls on every tab focus.

**Files**:
- `app/(tabs)/albums.tsx` lines 59-68
- `app/(tabs)/playlists.tsx` lines 74-83
- `app/(tabs)/podcasts.tsx` lines 68-77

```typescript
// Before
for (const album of sortedAlbums) {
    const isCached = await isAlbumCached(album.album.id);  // await in loop
    if (isCached) cachedIds.add(album.album.id);
}

// After
const keys = sortedAlbums.map(a => `${ALBUM_DETAIL_KEY_PREFIX}${a.album.id}`);
const results = await AsyncStorage.multiGet(keys);
const cachedIds = new Set(
    results.filter(([, v]) => v !== null).map(([, ], i) => sortedAlbums[i].album.id)
);
```

### 2.3 Batch AsyncStorage writes with `multiSet`

Sequential `await` per data type when saving cache. 6 bridge calls that should be 1.

- **File**: `features/library/utils/cache.ts` lines 75-117
- Same for `clearCachedData` (lines 119-134) - use `multiRemove`

### 2.4 Extract inline `ItemSeparatorComponent`

Creates a new component type on every render, forcing React to unmount/remount separators. Appears in 10+ files.

```typescript
// Before (everywhere)
ItemSeparatorComponent={() => <View style={{ height: n(8) }} />}

// After (module-level constant)
const SEPARATOR_STYLE = { height: n(8) } as const;
const ItemSeparator = () => <View style={SEPARATOR_STYLE} />;
```

### 2.5 Add `React.memo` to leaf components

`StyledText`, `HapticPressable`, `MediaListItem`, `TrackListItem`, `FallbackImage`, `Header` all subscribe to `SettingsContext`. In a list of 100 items, that's 300+ context subscriptions re-rendering on any settings change.

- **Files**: All files in `shared/components/`

### 2.6 Increase playing screen poll interval

1-second polling makes SDK calls + state updates every tick.

- **File**: `app/playing.tsx` line 413
- Change `setInterval(fetchAll, 1000)` to `setInterval(fetchAll, 3000)`

### 2.7 Fix AppState listener recreation

Dependency on `appState` tears down and recreates the listener on every state change. Use a ref instead.

- **File**: `features/auth/contexts/AuthContext.tsx` lines 195-208

### 2.8 Wrap context value objects in `useMemo`

All 4 context providers recreate their value object every render.

- `features/library/contexts/LibraryContext.tsx` line 579
- `features/auth/contexts/AuthContext.tsx` line 239
- `features/settings/contexts/SettingsContext.tsx` line 255
- `features/playback/contexts/PlaybackContext.tsx` line 172

### 2.9 Switch to `expo-image`

Stock RN `Image` has no disk cache. Hundreds of album covers refetched on every cold start.

- **Files**: `shared/components/FallbackImage.tsx`, `shared/components/MediaListItem.tsx`
- Use `cachePolicy="disk"` and `transition={200}`

### 2.10 Add `getItemLayout` to FlatLists

All items are fixed height (`n(50)`). Enables FlatList to skip off-screen measurement.

### 2.11 Wrap `renderItem` functions in `useCallback`

Unstable function references prevent FlatList from optimising item renders.

- **Files**: All screen files with `renderItem` definitions

---

## Phase 3: Simplification & Type Safety

Medium-risk refactors that reduce code and improve correctness.

### 3.1 Consolidate SettingsContext

9 identical `useState` + `useCallback` + `AsyncStorage` pairs. 294 lines that could be ~80.

- **File**: `features/settings/contexts/SettingsContext.tsx`

```typescript
// Before: 9 separate states + 9 setters + 9 AsyncStorage calls

// After: single state object + generic setter + multiGet on load
const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

const setSetting = useCallback(async <K extends keyof AppSettings>(
    key: K, value: AppSettings[K]
) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    await AsyncStorage.setItem(key, value.toString());
}, []);
```

### 3.2 Extract `getValidToken` helper

7-line token validation block repeated 20+ times across `spotifyData.ts` and `spotifyPlayback.ts`.

- **Files**: `features/library/services/spotifyData.ts`, `features/playback/services/spotifyPlayback.ts`

```typescript
export const getValidToken = async (
    accessToken: string | null,
    ensureValidToken?: () => Promise<string | null>
): Promise<string | null> => {
    if (ensureValidToken) {
        return (await ensureValidToken()) ?? accessToken;
    }
    return accessToken;
};
```

### 3.3 Merge create/rename playlist screens

`create-playlist.tsx` (151 lines) and `rename-playlist.tsx` (147 lines) are 90% identical. Single screen with a `mode` parameter.

### 3.4 Fix `SpotifyArtist.external_urls` type bug

Typed as `string` but should be `{ spotify: string }` (matching all other types).

- **File**: `shared/types/spotify.ts` line 72

### 3.5 Type the user object

`user: any | null` flows through the entire auth chain. Replace with a proper `SpotifyUser` interface.

- **Files**: `AuthContext.tsx:25,42,68`, `spotifyAuth.ts:31,196,228`

### 3.6 Add discriminated union for tracks vs episodes

Forces unsafe `(item as any).isEpisode` casts everywhere. Make `SpotifyTrackSimple.type` a literal `"track"` and `SpotifyEpisode.type` a literal `"episode"`.

- **File**: `shared/types/spotify.ts`
- **Consumers**: `app/playing.tsx` lines 153-157, 326-331, 370-374, 426-435

### 3.7 Create generic `SpotifyPaginatedResponse<T>`

8+ near-identical paginated response interfaces. Replace with:

```typescript
interface SpotifyPaginatedResponse<T> {
    href: string;
    items: T[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
}
```

### 3.8 Replace `saveCachedData` positional args with options object

```typescript
// Before
saveCachedData(data.items, undefined, undefined, undefined);

// After
saveCachedData({ playlists: data.items });
```

### 3.9 Use string literal types for Spotify enums

Replace `string` with proper unions for `album_type`, `release_date_precision`, `type` fields.

```typescript
type AlbumType = "album" | "single" | "compilation";
type ReleaseDatePrecision = "year" | "month" | "day";
```

### 3.10 Fix barrel export violations

~15 files import from internal context paths instead of barrels.

```typescript
// Before (everywhere)
import { useAuth } from "@/features/auth/contexts/AuthContext";

// After
import { useAuth } from "@/features/auth";
```

### 3.11 Fix remaining useEffect violations

5 conditional data fetching effects should use `useFocusEffect`. 3 state-from-state effects should calculate during render.

**State-from-state**:
- `app/podcast/[id].tsx:52` - use `const currentShow = show ?? initialShow`
- `app/playlist/[id].tsx:85` - use `const currentPlaylist = playlist ?? initialPlaylist`
- `app/artist/[id].tsx:59` - use `const currentArtist = artist ?? initialArtist`

---

## Phase 4: Architecture

Biggest effort, biggest long-term payoff.

### 4.1 Split LibraryContext into per-entity contexts

The 646-line god object with 35+ state variables. Every consumer subscribes to everything. Albums loading triggers re-renders on podcast screens.

Split into:
- `useAlbums()` - albums, fetchAlbums, fetchMore, save, remove
- `useArtists()` - artists, fetchArtists, fetchMore, follow, unfollow
- `usePlaylists()` - playlists, fetchPlaylists, fetchMore
- `usePodcasts()` - podcasts, fetchPodcasts, fetchMore, follow, unfollow
- `useSavedTracks()` - savedTracks, fetchSavedTracks, fetchMore
- `useSavedEpisodes()` - savedEpisodes, fetchSavedEpisodes, fetchMore

### 4.2 Break circular dependencies

- **auth -> library**: `spotifyAuth.ts` imports `clearCachedData` from library. Move cache clearing to the logout handler in `_layout.tsx` or settings screen.
- **playback -> library/cache**: `spotifyPlayback.ts` imports `isTrackInSavedCache`, `addTrackToSavedCache`, `removeTrackFromSavedCache`. Access through context or a shared cache abstraction.

### 4.3 Extract `<ListScreen>` wrapper component

5 tab screens share identical structure: fetch, sort, refresh, empty state, loading state, pagination, ContentContainer + CustomScrollView.

```typescript
interface ListScreenProps<T> {
    title: string;
    items: T[] | null;
    isLoading: boolean;
    isRefreshing: boolean;
    onRefresh: () => void;
    renderItem: (props: { item: T; index: number }) => ReactElement;
    keyExtractor: (item: T) => string;
    emptyMessage: string;
    onLoadMore?: () => void;
    isLoadingMore?: boolean;
}
```

### 4.4 Extract `<DetailScreen>` wrapper component

Album, playlist, podcast, and artist detail screens share: cache check, API fetch, cover image, save/follow toggle, track list with pagination.

### 4.5 Create proper API client

Replace the 10-parameter `makeApiRequest` function and repeated `ensureValidToken` boilerplate with a closure-based client:

```typescript
const api = useApiClient();
const data = await api.get<SpotifyPaginatedResponse<SpotifyPlaylist>>("/me/playlists?limit=50");
```

### 4.6 Remove `makeApiRequest` from LibraryContext public interface

Leaks infrastructure concerns through the domain layer. Screens like `album/[id].tsx` use it for ad-hoc API calls - these should go through services.

---

## Security Fixes

Separate from the phases above - address based on risk tolerance.

### HIGH

| Issue | File | Fix |
|-------|------|-----|
| Client secret on device, no PKCE | `features/auth/services/tokenExchange.ts` | Implement PKCE (S256) |
| Plaintext token in SharedPreferences | `modules/spotify-sdk/android/.../SpotifySdkModule.kt` | Use `EncryptedSharedPreferences` or remove |

### MEDIUM

| Issue | File | Fix |
|-------|------|-----|
| `allowBackup="true"` with missing rules | `android/app/src/main/AndroidManifest.xml` | Set `false` or create XML rules |
| Raw response bodies logged | `features/auth/services/tokenExchange.ts` | Log error codes only |
| No OAuth `state` parameter | `features/auth/services/spotifyAuth.ts` | Generate + validate random state |

### LOW

| Issue | File | Fix |
|-------|------|-----|
| Client secret not masked | `app/login.tsx` | Add `secureTextEntry={true}` |
| Custom URI scheme hijackable | `android/app/.../AndroidManifest.xml` | Implement Android App Links |
| Overly broad Android permissions | `android/app/.../AndroidManifest.xml` | Audit and remove unused |
