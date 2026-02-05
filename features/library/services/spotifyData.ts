import AsyncStorage from "@react-native-async-storage/async-storage";
import { ALBUMS_KEY, ARTISTS_KEY, PODCASTS_KEY } from "@/constants/spotify";
import type { SaveCachedDataOptions } from "@/features/library/utils/cache";
import { saveCachedShowDetail } from "@/features/library/utils/cache";
import type {
  SavedTrackObject,
  SpotifyAlbumSimple,
  SpotifyArtist,
  SpotifyPlaylist,
  SpotifySavedAlbum,
  SpotifySavedEpisode,
  SpotifySavedEpisodesResponse,
  SpotifySavedShow,
  SpotifySavedShowsResponse,
  SpotifyShow,
  SpotifyTrack,
} from "@/shared/types/spotify";
import { log, logError } from "@/shared/utils/logger";
import { getValidToken } from "@/shared/utils/token-helper";

export const fetchPlaylists = async (
  accessToken: string | null,
  makeApiRequest: (
    url: string,
    errorMessage: string,
    isRefreshing?: boolean
  ) => Promise<any | null>,
  saveCachedData: (options: SaveCachedDataOptions) => Promise<void>
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
    await saveCachedData({ playlists: data.items });
    return { playlists: data.items, nextUrl: data.next };
  }
  return { playlists: [], nextUrl: null };
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
  saveCachedData: (options: SaveCachedDataOptions) => Promise<void>
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
    await saveCachedData({ albums: data.items });
    return { albums: data.items, nextUrl: data.next };
  }
  return { albums: [], nextUrl: null };
};

export const fetchPodcasts = async (
  accessToken: string | null,
  makeApiRequest: (
    url: string,
    errorMessage: string,
    isRefreshing?: boolean
  ) => Promise<any | null>,
  saveCachedData: (options: SaveCachedDataOptions) => Promise<void>
): Promise<{ podcasts: SpotifySavedShow[] | null; nextUrl: string | null }> => {
  if (!accessToken) {
    return { podcasts: [], nextUrl: null };
  }

  const data: SpotifySavedShowsResponse | null = await makeApiRequest(
    "https://api.spotify.com/v1/me/shows?limit=50",
    "Podcasts",
    true
  );

  if (data) {
    await saveCachedData({ podcasts: data.items });
    return { podcasts: data.items, nextUrl: data.next };
  }
  return { podcasts: [], nextUrl: null };
};

export const fetchMorePodcasts = async (
  nextUrl: string | null,
  isLoadingMore: boolean,
  accessToken: string | null,
  makeApiRequest: (url: string, errorMessage: string) => Promise<any | null>
): Promise<{ podcasts: SpotifySavedShow[] | null; nextUrl: string | null }> => {
  if (!nextUrl || isLoadingMore || !accessToken) {
    return { podcasts: null, nextUrl: null };
  }

  const data = await makeApiRequest(nextUrl, "More Podcasts");

  if (data) {
    return { podcasts: data.items, nextUrl: data.next };
  }

  return { podcasts: null, nextUrl: null };
};

export const fetchSavedEpisodes = async (
  accessToken: string | null,
  makeApiRequest: (
    url: string,
    errorMessage: string,
    isRefreshing?: boolean
  ) => Promise<any | null>,
  saveCachedData: (options: SaveCachedDataOptions) => Promise<void>
): Promise<{
  savedEpisodes: SpotifySavedEpisode[] | null;
  nextUrl: string | null;
}> => {
  if (!accessToken) {
    return { savedEpisodes: [], nextUrl: null };
  }

  const data: SpotifySavedEpisodesResponse | null = await makeApiRequest(
    "https://api.spotify.com/v1/me/episodes?limit=50&market=from_token",
    "Saved Episodes",
    true
  );

  if (data) {
    await saveCachedData({ savedEpisodes: data.items });
    return { savedEpisodes: data.items, nextUrl: data.next };
  }
  return { savedEpisodes: [], nextUrl: null };
};

export const fetchMoreSavedEpisodes = async (
  nextUrl: string | null,
  isLoadingMore: boolean,
  accessToken: string | null,
  makeApiRequest: (url: string, errorMessage: string) => Promise<any | null>
): Promise<{
  savedEpisodes: SpotifySavedEpisode[] | null;
  nextUrl: string | null;
}> => {
  if (!nextUrl || isLoadingMore || !accessToken) {
    return { savedEpisodes: null, nextUrl: null };
  }

  const data = await makeApiRequest(nextUrl, "More Saved Episodes");

  if (data) {
    return { savedEpisodes: data.items, nextUrl: data.next };
  }

  return { savedEpisodes: null, nextUrl: null };
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
  saveCachedData: (options: SaveCachedDataOptions) => Promise<void>
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
    await saveCachedData({ tracks: data.items });
    return { savedTracks: data.items, nextUrl: data.next };
  }
  return { savedTracks: [], nextUrl: null };
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

export const fetchArtists = async (
  accessToken: string | null,
  makeApiRequest: (
    url: string,
    errorMessage: string,
    isRefreshing?: boolean
  ) => Promise<any | null>,
  saveCachedData: (options: SaveCachedDataOptions) => Promise<void>
): Promise<{ artists: SpotifyArtist[] | null; nextUrl: string | null }> => {
  if (!accessToken) {
    return { artists: [], nextUrl: null };
  }

  const data = await makeApiRequest(
    "https://api.spotify.com/v1/me/following?type=artist&limit=50",
    "Artists",
    true
  );

  if (data) {
    await saveCachedData({ artists: data.artists.items });
    return { artists: data.artists.items, nextUrl: data.artists.next };
  }
  return { artists: [], nextUrl: null };
};

export const fetchMoreArtists = async (
  nextUrl: string | null,
  isLoadingMore: boolean,
  accessToken: string | null,
  makeApiRequest: (url: string, errorMessage: string) => Promise<any | null>
): Promise<{ artists: SpotifyArtist[] | null; nextUrl: string | null }> => {
  if (!nextUrl || isLoadingMore || !accessToken) {
    return { artists: null, nextUrl: null };
  }

  const data = await makeApiRequest(nextUrl, "More Albums");

  if (data) {
    return { artists: data.artists.items, nextUrl: data.artists.next };
  }

  return { artists: null, nextUrl: null };
};

export const saveAlbum = async (
  albumId: string,
  accessToken: string | null,
  ensureValidToken?: () => Promise<string | null>
): Promise<boolean> => {
  const validToken = await getValidToken(accessToken, ensureValidToken);
  if (!validToken) {
    logError("Cannot save album - no valid token available");
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
      log(`Album ${albumId} saved successfully`);
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
          const parsedAlbums = cachedAlbums ? JSON.parse(cachedAlbums) : [];

          // Add the new saved album to the beginning of the cache
          const newSavedAlbum = {
            added_at: new Date().toISOString(),
            album: albumData,
          };
          parsedAlbums.unshift(newSavedAlbum);

          await AsyncStorage.setItem(ALBUMS_KEY, JSON.stringify(parsedAlbums));
          log(`Updated cached albums: added album ${albumId}`);
          return true;
        }
      } catch (cacheError) {
        logError("Error updating albums cache:", cacheError);
        return true; // Still return true since the API call succeeded
      }
      return true;
    }
    const errorData = await response.json();
    logError("Failed to save album:", errorData);
    return false;
  } catch (error) {
    logError("Error saving album:", error);
    return false;
  }
};

export const removeAlbum = async (
  albumId: string,
  accessToken: string | null,
  ensureValidToken?: () => Promise<string | null>
): Promise<boolean> => {
  const validToken = await getValidToken(accessToken, ensureValidToken);
  if (!validToken) {
    logError("Cannot remove album - no valid token available");
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
      log(`Album ${albumId} removed successfully`);
      // Update cached albums to remove the deleted album
      try {
        const cachedAlbums = await AsyncStorage.getItem(ALBUMS_KEY);
        if (cachedAlbums) {
          let parsedAlbums = JSON.parse(cachedAlbums);
          parsedAlbums = parsedAlbums.filter(
            (savedAlbum: any) => savedAlbum.album?.id !== albumId
          );
          await AsyncStorage.setItem(ALBUMS_KEY, JSON.stringify(parsedAlbums));
          log(`Updated cached albums: removed album ${albumId}`);
        }
      } catch (cacheError) {
        logError("Error updating albums cache:", cacheError);
      }
      return true;
    }
    const errorData = await response.json();
    logError("Failed to remove album:", errorData);
    return false;
  } catch (error) {
    logError("Error removing album:", error);
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
        log(`Album ${albumId} found in offline cache - it's saved`);
        return true;
      }
    }
  } catch (error) {
    logError("Error checking cached saved albums:", error);
  }

  const validToken = await getValidToken(accessToken, ensureValidToken);
  if (!validToken) return false;

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
      logError("Failed to check if album is saved", await response.json());
      return false;
    }
    const data: boolean[] = await response.json();
    if (data && data.length > 0) {
      log(`Album ${albumId} API check - saved: ${data[0]}`);
      return data[0];
    }
    return false;
  } catch (error) {
    log("Error checking if album is saved (likely offline):", error);
    return false;
  }
};

export const followPodcast = async (
  showId: string,
  accessToken: string | null,
  ensureValidToken?: () => Promise<string | null>
): Promise<boolean> => {
  const validToken = await getValidToken(accessToken, ensureValidToken);
  if (!validToken) {
    logError("Cannot follow podcast - no valid token available");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/me/shows?ids=${showId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      log(`Show ${showId} followed successfully`);
      try {
        const showResponse = await fetch(
          `https://api.spotify.com/v1/shows/${showId}`,
          {
            headers: {
              Authorization: `Bearer ${validToken}`,
            },
          }
        );

        if (showResponse.ok) {
          const showData: SpotifyShow = await showResponse.json();
          await saveCachedShowDetail(showData);
          const cachedShows = await AsyncStorage.getItem(PODCASTS_KEY);
          const parsedShows = cachedShows ? JSON.parse(cachedShows) : [];
          const alreadyExists = parsedShows.some(
            (item: SpotifySavedShow) => item.show.id === showId
          );
          if (!alreadyExists) {
            const newSavedShow: SpotifySavedShow = {
              added_at: new Date().toISOString(),
              show: showData,
            };
            parsedShows.unshift(newSavedShow);
            await AsyncStorage.setItem(
              PODCASTS_KEY,
              JSON.stringify(parsedShows)
            );
            log(`Updated cached podcasts: added show ${showId}`);
          }
        }
      } catch (cacheError) {
        logError("Error updating podcasts cache:", cacheError);
      }
      return true;
    }
    const errorData = await response.json();
    logError("Failed to follow podcast:", errorData);
    return false;
  } catch (error) {
    logError("Error following podcast:", error);
    return false;
  }
};

export const unfollowPodcast = async (
  showId: string,
  accessToken: string | null,
  ensureValidToken?: () => Promise<string | null>
): Promise<boolean> => {
  const validToken = await getValidToken(accessToken, ensureValidToken);
  if (!validToken) {
    logError("Cannot unfollow podcast - no valid token available");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/me/shows?ids=${showId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      log(`Show ${showId} removed successfully`);
      try {
        const cachedShows = await AsyncStorage.getItem(PODCASTS_KEY);
        if (cachedShows) {
          const parsedShows: SpotifySavedShow[] = JSON.parse(cachedShows);
          const filteredShows = parsedShows.filter(
            (item) => item.show.id !== showId
          );
          await AsyncStorage.setItem(
            PODCASTS_KEY,
            JSON.stringify(filteredShows)
          );
          log(`Updated cached podcasts: removed show ${showId}`);
        }
      } catch (cacheError) {
        logError("Error updating podcasts cache after removal:", cacheError);
      }
      return true;
    }
    const errorData = await response.json();
    logError("Failed to unfollow podcast:", errorData);
    return false;
  } catch (error) {
    logError("Error unfollowing podcast:", error);
    return false;
  }
};

export const checkIfFollowingPodcast = async (
  showId: string,
  accessToken: string | null,
  ensureValidToken?: () => Promise<string | null>
): Promise<boolean> => {
  try {
    const cachedShows = await AsyncStorage.getItem(PODCASTS_KEY);
    if (cachedShows) {
      const parsedShows: SpotifySavedShow[] = JSON.parse(cachedShows);
      const exists = parsedShows.some((item) => item.show.id === showId);
      if (exists) {
        return true;
      }
    }
  } catch (error) {
    logError("Error checking podcasts cache:", error);
  }

  const validToken = await getValidToken(accessToken, ensureValidToken);
  if (!validToken) return false;

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/me/shows/contains?ids=${showId}`,
      {
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      }
    );
    if (!response.ok) {
      logError("Failed to check if podcast is followed", await response.json());
      return false;
    }
    const data: boolean[] = await response.json();
    if (data && data.length > 0) {
      log(`Podcast ${showId} API check - followed: ${data[0]}`);
      return data[0];
    }
    return false;
  } catch (error) {
    log("Error checking if podcast is followed (likely offline):", error);
    return false;
  }
};

export const followArtist = async (
  artistId: string,
  accessToken: string | null,
  ensureValidToken?: () => Promise<string | null>
): Promise<boolean> => {
  const validToken = await getValidToken(accessToken, ensureValidToken);
  if (!validToken) {
    logError("Cannot follow artist - no valid token available");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/me/following?type=artist&ids=${artistId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      log(`Artist ${artistId} saved successfully`);
      try {
        const artistResponse = await fetch(
          `https://api.spotify.com/v1/artists/${artistId}`,
          {
            headers: {
              Authorization: `Bearer ${validToken}`,
            },
          }
        );

        if (artistResponse.ok) {
          const artistData = await artistResponse.json();
          const cachedArtists = await AsyncStorage.getItem(ARTISTS_KEY);
          const parsedArtists = cachedArtists ? JSON.parse(cachedArtists) : [];

          const newFollowedArtist = {
            added_at: new Date().toISOString(),
            artist: artistData,
          };
          parsedArtists.unshift(newFollowedArtist);

          await AsyncStorage.setItem(
            ARTISTS_KEY,
            JSON.stringify(parsedArtists)
          );
          log(`Updated cached artists: added artist ${artistId}`);
          return true;
        }
      } catch (cacheError) {
        logError("Error updating artist cache:", cacheError);
        return true;
      }
      return true;
    }
    const errorData = await response.json();
    logError("Failed to save artist:", errorData);
    return false;
  } catch (error) {
    logError("Error saving artist:", error);
    return false;
  }
};

export const unfollowArtist = async (
  artistId: string,
  accessToken: string | null,
  ensureValidToken?: () => Promise<string | null>
): Promise<boolean> => {
  const validToken = await getValidToken(accessToken, ensureValidToken);
  if (!validToken) {
    logError("Cannot remove artist - no valid token available");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/me/following?type=artist&ids=${artistId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      log(`Artist ${artistId} removed successfully`);
      try {
        const cachedArtists = await AsyncStorage.getItem(ARTISTS_KEY);
        if (cachedArtists) {
          let parsedArtists = JSON.parse(cachedArtists);
          parsedArtists = parsedArtists.filter(
            (followedArtist: { artist?: { id?: string } }) =>
              followedArtist.artist?.id !== artistId
          );
          await AsyncStorage.setItem(
            ARTISTS_KEY,
            JSON.stringify(parsedArtists)
          );
          log(`Updated cached artists: removed artist ${artistId}`);
        }
      } catch (cacheError) {
        logError("Error updating artist cache:", cacheError);
      }
      return true;
    }
    const errorData = await response.json();
    logError("Failed to remove artist:", errorData);
    return false;
  } catch (error) {
    logError("Error removing artist:", error);
    return false;
  }
};

export const checkIfFollowingArtist = async (
  artistId: string,
  accessToken: string | null,
  ensureValidToken?: () => Promise<string | null>
): Promise<boolean> => {
  try {
    const cachedFollowedArtists = await AsyncStorage.getItem(ARTISTS_KEY);
    if (cachedFollowedArtists) {
      const parsedArtists = JSON.parse(cachedFollowedArtists);
      const isArtistInCache = parsedArtists.some(
        (followedArtist: any) => followedArtist.artist?.id === artistId
      );
      if (isArtistInCache) {
        log(`Artist ${artistId} found in offline cache - it's saved`);
        return true;
      }
    }
  } catch (error) {
    logError("Error checking cached saved artists:", error);
  }

  const validToken = await getValidToken(accessToken, ensureValidToken);
  if (!validToken) return false;

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/me/following/contains?type=artist&ids=${artistId}`,
      {
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      }
    );
    if (!response.ok) {
      logError("Failed to check if artist is followed", await response.json());
      return false;
    }
    const data: boolean[] = await response.json();
    if (data && data.length > 0) {
      log(`Artist ${artistId} API check - saved: ${data[0]}`);
      return data[0];
    }
    return false;
  } catch (error) {
    log("Error checking if artist is saved (likely offline):", error);
    return false;
  }
};

export const fetchArtistTopTracks = async (
  artistId: string,
  accessToken: string | null,
  ensureValidToken?: () => Promise<string | null>
): Promise<SpotifyTrack[]> => {
  const validToken = await getValidToken(accessToken, ensureValidToken);
  if (!validToken) {
    logError("Cannot fetch artist's top tracks - no valid token available");
    return [];
  }

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}/top-tracks`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      log(`Top tracks for artist ${artistId} fetched successfully`);
      return data.tracks;
    }
    const errorData = await response.json();
    logError("Failed to fetch top tracks for artist:", errorData);
    return [];
  } catch (error) {
    logError("Error fetching top tracks for artist:", error);
    return [];
  }
};

export const fetchArtistAlbums = async (
  artistId: string,
  accessToken: string | null,
  ensureValidToken?: () => Promise<string | null>
): Promise<{ albums: SpotifyAlbumSimple[] | null; nextUrl: string | null }> => {
  const validToken = await getValidToken(accessToken, ensureValidToken);
  if (!validToken) {
    logError("Cannot fetch artist's albums - no valid token available");
    return { albums: [], nextUrl: null };
  }

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&limit=50`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      log(`Albums for artist ${artistId} fetched successfully`);
      return { albums: data.items, nextUrl: data.next };
    }
    const errorData = await response.json();
    logError("Failed to fetch albums for artist:", errorData);
    return { albums: [], nextUrl: null };
  } catch (error) {
    logError("Error fetching albums for artist:", error);
    return { albums: [], nextUrl: null };
  }
};

export const fetchMoreArtistAlbums = async (
  nextUrl: string | null,
  isLoadingMore: boolean,
  accessToken: string | null,
  makeApiRequest: (url: string, errorMessage: string) => Promise<any | null>
): Promise<{ albums: SpotifyAlbumSimple[] | null; nextUrl: string | null }> => {
  if (!nextUrl || isLoadingMore || !accessToken) {
    return { albums: null, nextUrl: null };
  }

  const data = await makeApiRequest(nextUrl, "More Artist Albums");

  if (data) {
    return { albums: data.items, nextUrl: data.next };
  }

  return { albums: null, nextUrl: null };
};
