import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    PLAYLISTS_KEY,
    ALBUMS_KEY,
    ARTISTS_KEY,
    SAVED_TRACKS_KEY,
    ALBUM_DETAIL_KEY_PREFIX,
} from "../constants/spotify";
import { log, logError } from "../utils/logger";
import type {
    SpotifyPlaylist,
    SpotifySavedAlbum,
    SpotifyArtist,
    SavedTrackObject,
    SpotifyAlbum,
} from "../types/spotify";

export const loadCachedData = async () => {
    try {
        let hasAnyCache = false;
        const cachedData = {
            playlists: null as SpotifyPlaylist[] | null,
            albums: null as SpotifySavedAlbum[] | null,
            artists: null as SpotifyArtist[] | null,
            savedTracks: null as SavedTrackObject[] | null,
        };

        const cachedPlaylists = await AsyncStorage.getItem(PLAYLISTS_KEY);
        if (cachedPlaylists) {
            cachedData.playlists = JSON.parse(cachedPlaylists);
            hasAnyCache = true;
        }

        const cachedAlbums = await AsyncStorage.getItem(ALBUMS_KEY);
        if (cachedAlbums) {
            cachedData.albums = JSON.parse(cachedAlbums);
            hasAnyCache = true;
        }

        const cachedArtists = await AsyncStorage.getItem(ARTISTS_KEY);
        if (cachedArtists) {
            cachedData.artists = JSON.parse(cachedArtists);
            hasAnyCache = true;
        }

        const cachedSavedTracks = await AsyncStorage.getItem(SAVED_TRACKS_KEY);
        if (cachedSavedTracks) {
            cachedData.savedTracks = JSON.parse(cachedSavedTracks);
            hasAnyCache = true;
        }

        if (hasAnyCache) {
            log("Cache: Loaded cached data");
        } else {
            log("Cache: No cached data found");
        }

        return cachedData;
    } catch (error) {
        logError("Cache: Error loading cached data:", error);
        return {
            playlists: null,
            albums: null,
            artists: null,
            savedTracks: null,
        };
    }
};

export const saveCachedData = async (
    playlistsData?: SpotifyPlaylist[],
    albumsData?: SpotifySavedAlbum[],
    artistsData?: SpotifyArtist[],
    tracksData?: SavedTrackObject[]
) => {
    try {
        if (playlistsData) {
            await AsyncStorage.setItem(
                PLAYLISTS_KEY,
                JSON.stringify(playlistsData)
            );
        }
        if (albumsData) {
            await AsyncStorage.setItem(ALBUMS_KEY, JSON.stringify(albumsData));
        }
        if (artistsData) {
            await AsyncStorage.setItem(ARTISTS_KEY, JSON.stringify(artistsData));
        }
        if (tracksData) {
            await AsyncStorage.setItem(
                SAVED_TRACKS_KEY,
                JSON.stringify(tracksData)
            );
        }
    } catch (error) {
        logError("Cache: Error saving cached data:", error);
    }
};

export const clearCachedData = async () => {
    try {
        await AsyncStorage.removeItem(PLAYLISTS_KEY);
        await AsyncStorage.removeItem(ALBUMS_KEY);
        await AsyncStorage.removeItem(ARTISTS_KEY);
        await AsyncStorage.removeItem(SAVED_TRACKS_KEY);
        await clearCachedAlbumDetails();
        log("Cache: Cache cleared");
    } catch (error) {
        logError("Cache: Error clearing cache:", error);
    }
};

export const refreshSavedAlbumsFromCache = async () => {
    try {
        const cachedSavedAlbums = await AsyncStorage.getItem(ALBUMS_KEY);
        if (cachedSavedAlbums) {
            const parsedAlbums = JSON.parse(cachedSavedAlbums);
            log(
                `Cache: Refreshed saved albums state from cache - ${parsedAlbums.length} albums`
            );
            return parsedAlbums;
        }
    } catch (error) {
        logError(
            "Cache: Error refreshing saved albums from cache:",
            error
        );
    }
    return null;
};

export const refreshFollowedArtistsFromCache = async () => {
    try {
        const cachedFollowedArtists = await AsyncStorage.getItem(ARTISTS_KEY);
        if (cachedFollowedArtists) {
            const parsedArtists = JSON.parse(cachedFollowedArtists);
            log(
                `Cache: Refreshed followed artists state from cache - ${parsedArtists.length} artists`
            );
            return parsedArtists;
        }
    } catch (error) {
        logError(
            "Cache: Error refreshing followed artists from cache:",
            error
        );
    }
    return null;
};

export const saveCachedAlbumDetail = async (album: SpotifyAlbum) => {
    try {
        const key = `${ALBUM_DETAIL_KEY_PREFIX}${album.id}`;
        await AsyncStorage.setItem(key, JSON.stringify(album));
        log(`Cache: Saved album detail for ${album.name} (${album.id})`);
    } catch (error) {
        logError("Cache: Error saving album detail:", error);
    }
};

export const getCachedAlbumDetail = async (albumId: string): Promise<SpotifyAlbum | null> => {
    try {
        const key = `${ALBUM_DETAIL_KEY_PREFIX}${albumId}`;
        const cachedAlbum = await AsyncStorage.getItem(key);
        if (cachedAlbum) {
            const parsedAlbum = JSON.parse(cachedAlbum);
            log(`Cache: Retrieved cached album detail for ${albumId}`);
            return parsedAlbum;
        }
    } catch (error) {
        logError("Cache: Error retrieving cached album detail:", error);
    }
    return null;
};

export const clearCachedAlbumDetails = async () => {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const albumDetailKeys = keys.filter(key => key.startsWith(ALBUM_DETAIL_KEY_PREFIX));
        if (albumDetailKeys.length > 0) {
            await AsyncStorage.multiRemove(albumDetailKeys);
            log(`Cache: Cleared ${albumDetailKeys.length} cached album details`);
        }
    } catch (error) {
        logError("Cache: Error clearing cached album details:", error);
    }
};


