# Album Save/Remove Feature

## Overview

This feature allows users to save and remove albums from their Spotify library directly from the album detail view. The implementation follows the same pattern as the existing liked songs feature, using the Spotify Web API for saving/removing and local caching for offline support.

## Features

-   **Save Album**: Add albums to user's library with the '+' icon
-   **Remove Album**: Remove albums from user's library with the '-' icon
-   **Offline Support**: Check saved status from cached data when offline
-   **Real-time Updates**: Cache updates immediately after save/remove operations
-   **Visual Feedback**: Icon changes based on save status

## Implementation Details

### Components Modified

#### `app/album/[id].tsx`

-   Added album save status state (`isAlbumSaved`)
-   Added loading state for save status checks (`isCheckingAlbumSaved`)
-   Added `checkAlbumSavedStatus()` function to check if album is saved
-   Added `handleToggleAlbumSave()` function to save/remove albums
-   Updated `ItemHeader` to show appropriate icon and handle save/remove actions

#### `contexts/AuthContext.tsx`

-   Added `saveAlbum(albumId: string)` function
-   Added `removeAlbum(albumId: string)` function
-   Added `checkIfAlbumIsSaved(albumId: string)` function
-   Added `refreshSavedAlbumsFromCache()` function
-   Updated AuthContextType interface
-   Updated context value exports

### API Endpoints Used

-   **Save Album**: `PUT /v1/me/albums?ids={albumId}`
-   **Remove Album**: `DELETE /v1/me/albums?ids={albumId}`
-   **Check Saved**: `GET /v1/me/albums/contains?ids={albumId}`
-   **Get Album Details**: `GET /v1/albums/{albumId}` (for cache updates)

### Caching Strategy

The implementation uses a multi-layered caching approach:

1. **Cache-First Check**: When checking if an album is saved, first check local cache
2. **API Fallback**: If not found in cache and online, check via API
3. **Optimistic Updates**: When saving/removing, update cache immediately
4. **Graceful Degradation**: Falls back to full refresh if cache update fails

### User Experience

-   **Loading States**: Icon is hidden while checking save status
-   **Immediate Feedback**: Icon changes immediately after successful save/remove
-   **Offline Support**: Shows correct save status from cache when offline
-   **Error Handling**: Graceful error handling with console logging

## Usage

### In Album Detail View

1. Navigate to any album detail page
2. Look for the icon in the top-right corner of the header:
    - **Plus (+) icon**: Album is not saved - tap to save
    - **Minus (-) icon**: Album is saved - tap to remove
3. Icon changes immediately after successful operation

### Technical Integration

```typescript
// Check if album is saved
const isSaved = await checkIfAlbumIsSaved(albumId);

// Save an album
const success = await saveAlbum(albumId);

// Remove an album
const success = await removeAlbum(albumId);

// Refresh albums from cache
await refreshSavedAlbumsFromCache();
```

## Error Handling

-   Network errors are logged and handled gracefully
-   Offline scenarios use cached data
-   Failed operations don't change UI state
-   Cache update failures fall back to full refresh

## Testing

Test the feature by:

1. Navigating to an album detail page
2. Tapping the save button (+ icon)
3. Verifying the icon changes to remove (- icon)
4. Checking the Albums tab to see the saved album
5. Tapping remove button and verifying removal
6. Testing offline behavior with airplane mode

## Future Enhancements

-   Add haptic feedback for save/remove actions
-   Add visual animations for state changes
-   Implement bulk save/remove operations
-   Add save status indicators in album lists
-   Add confirmation dialogs for remove operations
