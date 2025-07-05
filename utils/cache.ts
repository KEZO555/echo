import AsyncStorage from "@react-native-async-storage/async-storage";
import {
	PLAYLISTS_KEY,
	ALBUMS_KEY,
	SAVED_TRACKS_KEY,
	ALBUM_ART_CACHE_KEY,
} from "../constants/spotify";
import { log, logError } from "../utils/logger";
import type {
	SpotifyPlaylist,
	SpotifySavedAlbum,
	SavedTrackObject,
	SpotifyImage,
} from "../types/spotify";

export const loadCachedData = async () => {
	try {
		let hasAnyCache = false;
		const cachedData = {
			playlists: null as SpotifyPlaylist[] | null,
			albums: null as SpotifySavedAlbum[] | null,
			savedTracks: null as SavedTrackObject[] | null,
		};

		// Load cached playlists
		const cachedPlaylists = await AsyncStorage.getItem(PLAYLISTS_KEY);
		if (cachedPlaylists) {
			cachedData.playlists = JSON.parse(cachedPlaylists);
			hasAnyCache = true;
		}

		// Load cached albums
		const cachedAlbums = await AsyncStorage.getItem(ALBUMS_KEY);
		if (cachedAlbums) {
			cachedData.albums = JSON.parse(cachedAlbums);
			hasAnyCache = true;
		}

		// Load cached saved tracks
		const cachedSavedTracks = await AsyncStorage.getItem(SAVED_TRACKS_KEY);
		if (cachedSavedTracks) {
			cachedData.savedTracks = JSON.parse(cachedSavedTracks);
			hasAnyCache = true;
		}

		// Only log cache loading message if we actually found cached data
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
			savedTracks: null,
		};
	}
};

export const saveCachedData = async (
	playlistsData?: SpotifyPlaylist[],
	albumsData?: SpotifySavedAlbum[],
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

export const loadCachedAlbumArt = async (
	albumId: string
): Promise<SpotifyImage[] | null> => {
	try {
		const cachedAlbumArt = await AsyncStorage.getItem(ALBUM_ART_CACHE_KEY);
		if (cachedAlbumArt) {
			const albumArtCache = JSON.parse(cachedAlbumArt);
			return albumArtCache[albumId] || null;
		}
	} catch (error) {
		logError("Cache: Error loading cached album art:", error);
	}
	return null;
};

export const saveCachedAlbumArt = async (
	albumId: string,
	images: SpotifyImage[]
) => {
	try {
		const cachedAlbumArt = await AsyncStorage.getItem(ALBUM_ART_CACHE_KEY);
		const albumArtCache = cachedAlbumArt ? JSON.parse(cachedAlbumArt) : {};
		albumArtCache[albumId] = images;
		await AsyncStorage.setItem(
			ALBUM_ART_CACHE_KEY,
			JSON.stringify(albumArtCache)
		);
	} catch (error) {
		logError("Cache: Error saving cached album art:", error);
	}
};

export const clearCachedData = async () => {
	try {
		await AsyncStorage.removeItem(PLAYLISTS_KEY);
		await AsyncStorage.removeItem(ALBUMS_KEY);
		await AsyncStorage.removeItem(SAVED_TRACKS_KEY);
		await AsyncStorage.removeItem(ALBUM_ART_CACHE_KEY);
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

export const refreshSavedTracksFromCache = async () => {
	try {
		const cachedSavedTracks = await AsyncStorage.getItem(SAVED_TRACKS_KEY);
		if (cachedSavedTracks) {
			const parsedTracks = JSON.parse(cachedSavedTracks);
			log(
				`Cache: Refreshed saved tracks state from cache - ${parsedTracks.length} tracks`
			);
			return parsedTracks;
		}
	} catch (error) {
		logError(
			"Cache: Error refreshing saved tracks from cache:",
			error
		);
	}
	return null;
};
