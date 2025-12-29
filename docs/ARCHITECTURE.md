# Spotify Light - Architecture Guide

## What This App Is

A minimal Spotify client for the Light Phone III built with Expo and React Native. Uses Spotify Web API and Android SDK for playback.

## Architecture Overview

The app follows a **feature-based architecture** with clear separation between features and shared code.

```
features/           # Feature modules (business logic)
├── auth/          # Authentication & tokens
├── library/       # User's saved content (playlists, albums, artists, podcasts, tracks)
├── playback/      # Playback controls & App Remote connection
├── search/        # Search functionality
└── settings/      # User preferences (haptics, colours, tabs)

shared/            # Shared/reusable code
├── components/    # UI components used across features
├── hooks/         # React hooks used across features
├── types/         # TypeScript type definitions
└── utils/         # Utility functions (logger, API client)

app/               # Expo Router pages (screens)
```

## Feature Structure

Each feature follows this pattern:

```
features/[feature-name]/
├── contexts/              # React contexts for state management
│   └── [Feature]Context.tsx
├── services/              # Business logic & API calls
│   └── spotify[Feature].ts
├── utils/                 # Feature-specific utilities (optional)
│   └── *.ts
└── index.ts              # Barrel export (public API)
```

### Feature Contexts

Each feature has ONE context that manages its state:

- **AuthContext**: `accessToken`, `user`, `login()`, `logout()`, `ensureValidToken()`
- **LibraryContext**: `playlists`, `albums`, `artists`, `podcasts`, `savedTracks`, fetch/save methods
- **PlaybackContext**: `isConnectedToAppRemote`, playback controls, `getPlaybackState()`
- **Settings contexts**: `HapticContext`, `InvertColorsContext`, `TabPreferencesContext`

### Context Dependencies

Contexts can depend on other contexts:

```tsx
// LibraryContext depends on AuthContext
import { useAuth } from '@/features/auth';

export const LibraryProvider = ({ children }) => {
  const { ensureValidToken } = useAuth();
  // Use token for API calls
};
```

**Provider order matters:**
```tsx
<AuthProvider>          // Provides tokens
  <LibraryProvider>     // Uses tokens
    <PlaybackProvider>  // Uses tokens
      {children}
```

## Where to Put New Code

### Adding a New Feature

1. Create directory: `features/new-feature/`
2. Add context: `features/new-feature/contexts/NewFeatureContext.tsx`
3. Add services: `features/new-feature/services/spotifyNewFeature.ts`
4. Add barrel export: `features/new-feature/index.ts`
5. Add provider to `app/_layout.tsx`

**Example:**
```typescript
// features/notifications/index.ts
export { NotificationsProvider, useNotifications } from './contexts/NotificationsContext';
export type { NotificationsContextType } from './contexts/NotificationsContext';
```

### Adding a New Screen

Screens go in `app/` directory using Expo Router conventions:

- Tab screens: `app/(tabs)/[name].tsx`
- Detail screens: `app/[feature]/[id].tsx`
- Modal screens: `app/[name].tsx`

Import from features:
```typescript
import { useAuth } from '@/features/auth';
import { useSpotifyLibrary } from '@/features/library';
import { usePlayback } from '@/features/playback';
```

### Adding a New Component

**Shared component** (used across features):
- Location: `shared/components/ComponentName.tsx`
- Export from: `shared/components/index.ts`

**Feature-specific component** (used in one feature only):
- Location: `features/[feature]/components/ComponentName.tsx`
- Not needed for this app yet

### Adding a New Hook

**Shared hook** (used across features):
- Location: `shared/hooks/useHookName.ts`
- Export from: `shared/hooks/index.ts`

**Feature-specific hook**:
- Location: `features/[feature]/hooks/useHookName.ts`

### Adding a New Type

All Spotify API types:
- Location: `shared/types/spotify.ts`
- Import: `import type { SpotifyTrack } from '@/shared/types/spotify';`

Feature-specific types can be colocated with the feature.

### Adding a New Utility

**Shared utility** (used across features):
- Location: `shared/utils/utilName.ts`
- Export from: `shared/utils/index.ts`

**Feature-specific utility**:
- Location: `features/[feature]/utils/utilName.ts`
- Example: `features/library/utils/cache.ts`

## Import Conventions

### Always Use Path Aliases

✅ **Good:**
```typescript
import { useAuth } from '@/features/auth';
import { StyledText } from '@/shared/components';
import type { SpotifyTrack } from '@/shared/types/spotify';
```

❌ **Bad:**
```typescript
import { useAuth } from '../../features/auth/contexts/AuthContext';
import { StyledText } from '../components/StyledText';
```

### Import from Barrel Exports

✅ **Good:**
```typescript
import { useAuth } from '@/features/auth';
import { useSpotifyLibrary } from '@/features/library';
import { StyledText, Header } from '@/shared/components';
```

❌ **Bad:**
```typescript
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { useSpotifyLibrary } from '@/features/library/contexts/LibraryContext';
import { StyledText } from '@/shared/components/StyledText';
```

## Context Usage Patterns

### In Screens

```typescript
export default function AlbumsScreen() {
  const { accessToken, user } = useAuth();              // Auth data only
  const { albums, fetchAlbums } = useSpotifyLibrary();  // Library data
  const { playTrackWithContext } = usePlayback();       // Playback controls
  const { preferences } = useTabPreferences();          // Settings
  
  // ... component logic
}
```

### In Services

Services should NOT use contexts. They receive data as parameters:

```typescript
// ✅ Good
export const fetchPlaylists = async (
  accessToken: string,
  makeApiRequest: MakeApiRequestFunction
) => {
  // Service logic
};

// ❌ Bad - services shouldn't use hooks
export const fetchPlaylists = async () => {
  const { accessToken } = useAuth(); // Don't do this!
};
```

### In Contexts

Contexts can consume other contexts:

```typescript
export const LibraryProvider = ({ children }) => {
  const { ensureValidToken } = useAuth();  // ✅ OK - context using context
  
  const fetchPlaylists = async () => {
    const token = await ensureValidToken();
    // ... fetch logic
  };
};
```

## API Call Patterns

### Using ensureValidToken

Always ensure token is valid before API calls:

```typescript
const { ensureValidToken } = useAuth();

const fetchData = async () => {
  const token = await ensureValidToken();
  if (!token) return;
  
  // Make API call with token
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
};
```

### Using makeApiRequest

For automatic token refresh and retry logic:

```typescript
import { makeApiRequest } from '@/shared/utils/spotifyApi';

const result = await makeApiRequest(
  url,
  errorMessage,
  accessToken,
  refreshToken,
  tokenExpiry,
  handleTokenUpdate,
  logout
);
```

## Common Patterns

### Pagination

```typescript
const [items, setItems] = useState<Item[]>([]);
const [nextUrl, setNextUrl] = useState<string | null>(null);
const [isLoadingMore, setIsLoadingMore] = useState(false);

const fetchMore = async () => {
  if (!nextUrl || isLoadingMore) return;
  
  setIsLoadingMore(true);
  const result = await fetchMoreItems(nextUrl, accessToken);
  setItems(prev => [...prev, ...result.items]);
  setNextUrl(result.nextUrl);
  setIsLoadingMore(false);
};
```

### Cache Management

Library data is cached in AsyncStorage:

```typescript
import { loadCachedData, saveCachedData } from '@/features/library/utils/cache';

// Load cache on mount
useEffect(() => {
  const loadCache = async () => {
    const cached = await loadCachedData();
    setPlaylists(cached.playlists);
  };
  loadCache();
}, []);

// Save after fetch
await saveCachedData(playlists, albums, artists, tracks, podcasts);
```

## Style Conventions

- **No comments** unless absolutely necessary
- **British English** in user-facing text
- **Strict TypeScript** - never use `any`
- **Functional components** with hooks
- **Named exports** for components/hooks/types
- **Default exports** only for screens (Expo Router requirement)

## Testing

Currently no tests. When adding tests:
- Unit tests: `[feature]/__tests__/`
- Integration tests: `app/__tests__/`

## Native Modules

Spotify SDK module: `modules/spotify-sdk/`
- Leave as-is (may be extracted to separate package)
- Only modify if updating SDK functionality

## Common Mistakes to Avoid

❌ **Don't** create type-based directories in features:
```
features/library/
├── components/  # Don't add this
├── hooks/       # Don't add this
└── utils/       # Only if feature-specific
```

❌ **Don't** use relative imports:
```typescript
import { useAuth } from '../../../features/auth';  // Bad
```

❌ **Don't** import from internal paths:
```typescript
import { useAuth } from '@/features/auth/contexts/AuthContext';  // Bad
import { useAuth } from '@/features/auth';  // Good
```

❌ **Don't** add business logic to screens:
```typescript
// Bad - API logic in screen
const albums = await fetch('https://api.spotify.com/...');

// Good - use context
const { albums, fetchAlbums } = useSpotifyLibrary();
```

## Questions?

Check existing code for patterns:
- Auth example: `features/auth/contexts/AuthContext.tsx`
- Library example: `features/library/contexts/LibraryContext.tsx`
- Screen example: `app/(tabs)/albums.tsx`
- Component example: `shared/components/MediaListItem.tsx`
