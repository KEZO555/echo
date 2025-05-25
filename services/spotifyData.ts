import AsyncStorage from "@react-native-async-storage/async-storage";
import { ALBUMS_KEY, SAVED_TRACKS_KEY } from "../constants/spotify";
import type {
	SpotifyPlaylist,
	SpotifySavedAlbum,
	SavedTrackObject,
	SpotifyPlaylistsResponse,
	SpotifySavedAlbumsResponse,
	SavedTracksResponse,
} from "../types/spotify";

export const fetchPlaylists = async (
	accessToken: string | null,
	makeApiRequest: (
		url: string,
		errorMessage: string,
		isRefreshing?: boolean
	) => Promise<any | null>,
	saveCachedData: (
		playlists?: SpotifyPlaylist[],
		albums?: SpotifySavedAlbum[],
		tracks?: SavedTrackObject[]
	) => Promise<void>
): Promise<{ playlists: SpotifyPlaylist[] | null; nextUrl: string | null }> => {
	if (!accessToken) {
		return { playlists: [], nextUrl: null };
	}

	const data = await makeApiRequest(
		"https://api.spotify.com/v1/me/playlists?limit=50",
		"Playlists",
		true
	);

	if (data) {
		await saveCachedData(data.items, undefined, undefined);
		return { playlists: data.items, nextUrl: data.next };
	} else {
		return { playlists: [], nextUrl: null };
	}
};

export const fetchMorePlaylists = async (
	nextUrl: string | null,
	isLoadingMore: boolean,
	accessToken: string | null,
	makeApiRequest: (url: string, errorMessage: string) => Promise<any | null>
): Promise<{ playlists: SpotifyPlaylist[] | null; nextUrl: string | null }> => {
	if (!nextUrl || isLoadingMore || !accessToken) {
		return { playlists: null, nextUrl: null };
	}

	const data = await makeApiRequest(nextUrl, "More Playlists");

	if (data) {
		return { playlists: data.items, nextUrl: data.next };
	}

	return { playlists: null, nextUrl: null };
};

export const fetchAlbums = async (
	accessToken: string | null,
	makeApiRequest: (
		url: string,
		errorMessage: string,
		isRefreshing?: boolean
	) => Promise<any | null>,
	saveCachedData: (
		playlists?: SpotifyPlaylist[],
		albums?: SpotifySavedAlbum[],
		tracks?: SavedTrackObject[]
	) => Promise<void>
): Promise<{ albums: SpotifySavedAlbum[] | null; nextUrl: string | null }> => {
	if (!accessToken) {
		return { albums: [], nextUrl: null };
	}

	const data = await makeApiRequest(
		"https://api.spotify.com/v1/me/albums?limit=50",
		"Albums",
		true
	);

	if (data) {
		await saveCachedData(undefined, data.items, undefined);
		return { albums: data.items, nextUrl: data.next };
	} else {
		return { albums: [], nextUrl: null };
	}
};

export const fetchMoreAlbums = async (
	nextUrl: string | null,
	isLoadingMore: boolean,
	accessToken: string | null,
	makeApiRequest: (url: string, errorMessage: string) => Promise<any | null>
): Promise<{ albums: SpotifySavedAlbum[] | null; nextUrl: string | null }> => {
	if (!nextUrl || isLoadingMore || !accessToken) {
		return { albums: null, nextUrl: null };
	}

	const data = await makeApiRequest(nextUrl, "More Albums");

	if (data) {
		return { albums: data.items, nextUrl: data.next };
	}

	return { albums: null, nextUrl: null };
};

export const fetchSavedTracks = async (
	accessToken: string | null,
	makeApiRequest: (
		url: string,
		errorMessage: string,
		isRefreshing?: boolean
	) => Promise<any | null>,
	saveCachedData: (
		playlists?: SpotifyPlaylist[],
		albums?: SpotifySavedAlbum[],
		tracks?: SavedTrackObject[]
	) => Promise<void>
): Promise<{
	savedTracks: SavedTrackObject[] | null;
	nextUrl: string | null;
}> => {
	if (!accessToken) {
		return { savedTracks: [], nextUrl: null };
	}

	const data = await makeApiRequest(
		"https://api.spotify.com/v1/me/tracks?limit=50",
		"Saved Tracks",
		true
	);

	if (data) {
		await saveCachedData(undefined, undefined, data.items);
		return { savedTracks: data.items, nextUrl: data.next };
	} else {
		return { savedTracks: [], nextUrl: null };
	}
};

export const fetchMoreSavedTracks = async (
	nextUrl: string | null,
	isLoadingMore: boolean,
	accessToken: string | null,
	makeApiRequest: (url: string, errorMessage: string) => Promise<any | null>
): Promise<{
	savedTracks: SavedTrackObject[] | null;
	nextUrl: string | null;
}> => {
	if (!nextUrl || isLoadingMore || !accessToken) {
		return { savedTracks: null, nextUrl: null };
	}

	const data = await makeApiRequest(nextUrl, "More Saved Tracks");

	if (data) {
		return { savedTracks: data.items, nextUrl: data.next };
	}

	return { savedTracks: null, nextUrl: null };
};

export const saveAlbum = async (
	albumId: string,
	accessToken: string | null,
	ensureValidToken?: () => Promise<string | null>
): Promise<boolean> => {
	// Use token validation if available
	const validToken = ensureValidToken
		? await ensureValidToken()
		: accessToken;
	if (!validToken) {
		console.warn("Cannot save album - no valid token available");
		return false;
	}

	try {
		const response = await fetch(
			`https://api.spotify.com/v1/me/albums?ids=${albumId}`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${validToken}`,
					"Content-Type": "application/json",
				},
			}
		);

		if (response.ok) {
			console.log(`Album ${albumId} saved successfully`);
			// Update local cache to reflect the change
			try {
				// First, we need to get the album details to add to cache
				const albumResponse = await fetch(
					`https://api.spotify.com/v1/albums/${albumId}`,
					{
						headers: {
							Authorization: `Bearer ${validToken}`,
						},
					}
				);

				if (albumResponse.ok) {
					const albumData = await albumResponse.json();
					const cachedAlbums = await AsyncStorage.getItem(ALBUMS_KEY);
					let parsedAlbums = cachedAlbums
						? JSON.parse(cachedAlbums)
						: [];

					// Add the new saved album to the beginning of the cache
					const newSavedAlbum = {
						added_at: new Date().toISOString(),
						album: albumData,
					};
					parsedAlbums.unshift(newSavedAlbum);

					await AsyncStorage.setItem(
						ALBUMS_KEY,
						JSON.stringify(parsedAlbums)
					);
					console.log(
						`Updated cached albums: added album ${albumId}`
					);
					return true;
				}
			} catch (cacheError) {
				console.error("Error updating albums cache:", cacheError);
				return true; // Still return true since the API call succeeded
			}
			return true;
		} else {
			const errorData = await response.json();
			console.error("Failed to save album:", errorData);
			return false;
		}
	} catch (error) {
		console.error("Error saving album:", error);
		return false;
	}
};

export const removeAlbum = async (
	albumId: string,
	accessToken: string | null,
	ensureValidToken?: () => Promise<string | null>
): Promise<boolean> => {
	// Use token validation if available
	const validToken = ensureValidToken
		? await ensureValidToken()
		: accessToken;
	if (!validToken) {
		console.warn("Cannot remove album - no valid token available");
		return false;
	}

	try {
		const response = await fetch(
			`https://api.spotify.com/v1/me/albums?ids=${albumId}`,
			{
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${validToken}`,
					"Content-Type": "application/json",
				},
			}
		);

		if (response.ok) {
			console.log(`Album ${albumId} removed successfully`);
			// Update cached albums to remove the deleted album
			try {
				const cachedAlbums = await AsyncStorage.getItem(ALBUMS_KEY);
				if (cachedAlbums) {
					let parsedAlbums = JSON.parse(cachedAlbums);
					parsedAlbums = parsedAlbums.filter(
						(savedAlbum: any) => savedAlbum.album?.id !== albumId
					);
					await AsyncStorage.setItem(
						ALBUMS_KEY,
						JSON.stringify(parsedAlbums)
					);
					console.log(
						`Updated cached albums: removed album ${albumId}`
					);
				}
			} catch (cacheError) {
				console.error("Error updating albums cache:", cacheError);
			}
			return true;
		} else {
			const errorData = await response.json();
			console.error("Failed to remove album:", errorData);
			return false;
		}
	} catch (error) {
		console.error("Error removing album:", error);
		return false;
	}
};

export const checkIfAlbumIsSaved = async (
	albumId: string,
	accessToken: string | null,
	ensureValidToken?: () => Promise<string | null>
): Promise<boolean> => {
	// First, check cached saved albums (works offline)
	try {
		const cachedSavedAlbums = await AsyncStorage.getItem(ALBUMS_KEY);
		if (cachedSavedAlbums) {
			const parsedAlbums = JSON.parse(cachedSavedAlbums);
			const isAlbumInCache = parsedAlbums.some(
				(savedAlbum: any) => savedAlbum.album?.id === albumId
			);
			if (isAlbumInCache) {
				console.log(
					`Album ${albumId} found in offline cache - it's saved`
				);
				return true;
			}
		}
	} catch (error) {
		console.error("Error checking cached saved albums:", error);
	}

	// Only make API call if we have access token and the album wasn't found in cache
	const validToken = ensureValidToken
		? await ensureValidToken()
		: accessToken;
	if (!validToken) {
		// No valid token and not in cache - assume not saved
		return false;
	}

	try {
		const response = await fetch(
			`https://api.spotify.com/v1/me/albums/contains?ids=${albumId}`,
			{
				headers: {
					Authorization: `Bearer ${validToken}`,
				},
			}
		);
		if (!response.ok) {
			console.error(
				"Failed to check if album is saved",
				await response.json()
			);
			return false;
		}
		const data: boolean[] = await response.json();
		if (data && data.length > 0) {
			console.log(`Album ${albumId} API check - saved: ${data[0]}`);
			return data[0];
		}
		return false;
	} catch (error) {
		console.log(
			"Error checking if album is saved (likely offline):",
			error
		);
		return false;
	}
};
