import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	ReactNode,
	useCallback,
} from "react";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { useNetworkState } from "@/shared/hooks";
import { logInfo } from "@/shared/utils/logger";

import type {
	SpotifyPlaylist,
	SpotifySavedAlbum,
	SpotifySavedShow,
	SpotifySavedEpisode,
	SpotifyArtist,
	SavedTrackObject,
	SpotifyTrack,
	SpotifyAlbum,
	SpotifyAlbumSimple,
} from "@/shared/types/spotify";

import {
	fetchPlaylists as fetchPlaylistsService,
	fetchMorePlaylists as fetchMorePlaylistsService,
	fetchAlbums as fetchAlbumsService,
	fetchMoreAlbums as fetchMoreAlbumsService,
	fetchPodcasts as fetchPodcastsService,
	fetchMorePodcasts as fetchMorePodcastsService,
	fetchSavedEpisodes as fetchSavedEpisodesService,
	fetchMoreSavedEpisodes as fetchMoreSavedEpisodesService,
	fetchArtists as fetchArtistsService,
	fetchMoreArtists as fetchMoreArtistsService,
	fetchSavedTracks as fetchSavedTracksService,
	fetchMoreSavedTracks as fetchMoreSavedTracksService,
	saveAlbum as saveAlbumService,
	removeAlbum as removeAlbumService,
	checkIfAlbumIsSaved as checkIfAlbumIsSavedService,
	followPodcast as followPodcastService,
	unfollowPodcast as unfollowPodcastService,
	checkIfFollowingPodcast as checkIfFollowingPodcastService,
	followArtist as followArtistService,
	unfollowArtist as unfollowArtistService,
	checkIfFollowingArtist as checkIfFollowingArtistService,
	fetchArtistTopTracks as fetchArtistTopTracksService,
	fetchArtistAlbums as fetchArtistAlbumsService,
	fetchMoreArtistAlbums as fetchMoreArtistAlbumsService,
} from "../services/spotifyData";

import {
	loadCachedData,
	saveCachedData,
	clearCachedData,
	refreshSavedAlbumsFromCache,
	refreshFollowedPodcastsFromCache,
	refreshFollowedArtistsFromCache,
	refreshSavedEpisodesFromCache,
} from "../utils/cache";
import { makeApiRequest } from "@/shared/utils/spotifyApi";

export interface LibraryContextType {
	playlists: SpotifyPlaylist[] | null;
	playlistsNextUrl: string | null;
	isLoadingMorePlaylists: boolean;
	isRefreshingPlaylists: boolean;
	fetchPlaylists: () => Promise<void>;
	fetchMorePlaylists: () => Promise<void>;

	albums: SpotifySavedAlbum[] | null;
	albumsNextUrl: string | null;
	isLoadingMoreAlbums: boolean;
	isRefreshingAlbums: boolean;
	fetchAlbums: () => Promise<void>;
	fetchMoreAlbums: () => Promise<void>;
	saveAlbum: (albumId: string) => Promise<boolean>;
	removeAlbum: (albumId: string) => Promise<boolean>;
	checkIfAlbumIsSaved: (albumId: string) => Promise<boolean>;

	artists: SpotifyArtist[] | null;
	artistsNextUrl: string | null;
	isLoadingMoreArtists: boolean;
	isRefreshingArtists: boolean;
	fetchArtists: () => Promise<void>;
	fetchMoreArtists: () => Promise<void>;
	followArtist: (artistId: string) => Promise<boolean>;
	unfollowArtist: (artistId: string) => Promise<boolean>;
	checkIfFollowingArtist: (artistId: string) => Promise<boolean>;
	fetchArtistTopTracks: (artistId: string) => Promise<SpotifyTrack[]>;
	fetchArtistAlbums: (artistId: string) => Promise<{ albums: SpotifyAlbumSimple[] | null; nextUrl: string | null }>;
	fetchMoreArtistAlbums: (nextUrl: string | null, isLoadingMore: boolean) => Promise<{ albums: SpotifyAlbumSimple[] | null; nextUrl: string | null }>;

	podcasts: SpotifySavedShow[] | null;
	podcastsNextUrl: string | null;
	isLoadingMorePodcasts: boolean;
	isRefreshingPodcasts: boolean;
	fetchPodcasts: () => Promise<void>;
	fetchMorePodcasts: () => Promise<void>;
	followPodcast: (showId: string) => Promise<boolean>;
	unfollowPodcast: (showId: string) => Promise<boolean>;
	checkIfFollowingPodcast: (showId: string) => Promise<boolean>;

	savedEpisodes: SpotifySavedEpisode[] | null;
	savedEpisodesNextUrl: string | null;
	isLoadingMoreSavedEpisodes: boolean;
	isRefreshingSavedEpisodes: boolean;
	fetchSavedEpisodes: () => Promise<void>;
	fetchMoreSavedEpisodes: () => Promise<void>;
	refreshSavedEpisodesFromCache: () => Promise<void>;

	savedTracks: SavedTrackObject[] | null;
	savedTracksNextUrl: string | null;
	isLoadingMoreSavedTracks: boolean;
	isRefreshingSavedTracks: boolean;
	fetchSavedTracks: () => Promise<void>;
	fetchMoreSavedTracks: () => Promise<void>;

	refreshSavedAlbumsFromCache: () => Promise<void>;
	refreshFollowedPodcastsFromCache: () => Promise<void>;
	refreshFollowedArtistsFromCache: () => Promise<void>;
	clearCachedData: () => Promise<void>;
	makeApiRequest: (url: string, errorMessage: string, isRefreshing?: boolean, retryCount?: number, options?: { method?: string; body?: string; headers?: Record<string, string> }) => Promise<any>;
	addTrackToPlaylist: (playlistId: string, trackUri: string) => Promise<boolean>;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider = ({ children }: { children: ReactNode }) => {
	const { accessToken, refreshToken, tokenExpiry, ensureValidToken, logout } = useAuth();
	const { isOnline } = useNetworkState();

	const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null);
	const [playlistsNextUrl, setPlaylistsNextUrl] = useState<string | null>(null);
	const [albums, setAlbums] = useState<SpotifySavedAlbum[] | null>(null);
	const [albumsNextUrl, setAlbumsNextUrl] = useState<string | null>(null);
	const [podcasts, setPodcasts] = useState<SpotifySavedShow[] | null>(null);
	const [podcastsNextUrl, setPodcastsNextUrl] = useState<string | null>(null);
	const [artists, setArtists] = useState<SpotifyArtist[] | null>(null);
	const [artistsNextUrl, setArtistsNextUrl] = useState<string | null>(null);
	const [savedTracks, setSavedTracks] = useState<SavedTrackObject[] | null>(null);
	const [savedTracksNextUrl, setSavedTracksNextUrl] = useState<string | null>(null);
	const [savedEpisodes, setSavedEpisodes] = useState<SpotifySavedEpisode[] | null>(null);
	const [savedEpisodesNextUrl, setSavedEpisodesNextUrl] = useState<string | null>(null);

	const [isLoadingMorePlaylists, setIsLoadingMorePlaylists] = useState(false);
	const [isLoadingMoreAlbums, setIsLoadingMoreAlbums] = useState(false);
	const [isLoadingMorePodcasts, setIsLoadingMorePodcasts] = useState(false);
	const [isLoadingMoreArtists, setIsLoadingMoreArtists] = useState(false);
	const [isLoadingMoreSavedTracks, setIsLoadingMoreSavedTracks] = useState(false);
	const [isLoadingMoreSavedEpisodes, setIsLoadingMoreSavedEpisodes] = useState(false);
	const [isRefreshingPlaylists, setIsRefreshingPlaylists] = useState(false);
	const [isRefreshingAlbums, setIsRefreshingAlbums] = useState(false);
	const [isRefreshingPodcasts, setIsRefreshingPodcasts] = useState(false);
	const [isRefreshingArtists, setIsRefreshingArtists] = useState(false);
	const [isRefreshingSavedTracks, setIsRefreshingSavedTracks] = useState(false);
	const [isRefreshingSavedEpisodes, setIsRefreshingSavedEpisodes] = useState(false);

	const [isFetchingInitialData, setIsFetchingInitialData] = useState(false);
	const [initialDataFetchTriggered, setInitialDataFetchTriggered] = useState(false);

	const makeApiRequestWithContext = useCallback(
		(
			url: string,
			errorMessage: string,
			isRefreshing = false,
			retryCount = 0,
			options?: { method?: string; body?: string; headers?: Record<string, string> }
		) =>
			makeApiRequest(
				url,
				errorMessage,
				accessToken,
				refreshToken,
				tokenExpiry,
				() => {},
				logout,
				isRefreshing,
				retryCount,
				options
			),
		[accessToken, refreshToken, tokenExpiry, logout]
	);

	const fetchInitialData = useCallback(
		async (token: string) => {
			if (isFetchingInitialData) {
				logInfo("LibraryContext: Initial data fetch already in progress, skipping...");
				return;
			}

			setIsFetchingInitialData(true);
			logInfo("LibraryContext: Starting initial data fetch...");

		try {
			const [playlistsResult, albumsResult, podcastsResult, artistsResult, tracksResult] = await Promise.all([
				fetchPlaylistsService(token, makeApiRequestWithContext, saveCachedData),
				fetchAlbumsService(token, makeApiRequestWithContext, saveCachedData),
				fetchPodcastsService(token, makeApiRequestWithContext, saveCachedData),
				fetchArtistsService(token, makeApiRequestWithContext, saveCachedData),
				fetchSavedTracksService(token, makeApiRequestWithContext, saveCachedData),
			]);

		setPlaylists(playlistsResult.playlists);
		setPlaylistsNextUrl(playlistsResult.nextUrl);
		setAlbums(albumsResult.albums);
		setAlbumsNextUrl(albumsResult.nextUrl);
		setPodcasts(podcastsResult.podcasts);
		setPodcastsNextUrl(podcastsResult.nextUrl);
		setArtists(artistsResult.artists);
		setArtistsNextUrl(artistsResult.nextUrl);
		setSavedTracks(tracksResult.savedTracks);
		setSavedTracksNextUrl(tracksResult.nextUrl);

			logInfo("LibraryContext: Initial data fetch completed successfully");
		} catch (error) {
			logInfo("LibraryContext: Error during initial data fetch:", error);
		} finally {
			setIsFetchingInitialData(false);
		}
		},
		[isFetchingInitialData, makeApiRequestWithContext]
	);

	const fetchPlaylists = useCallback(async () => {
		if (!accessToken) return;
		setIsRefreshingPlaylists(true);

		const result = await fetchPlaylistsService(accessToken, makeApiRequestWithContext, saveCachedData);

		setPlaylists(result.playlists || []);
		setPlaylistsNextUrl(result.nextUrl);
		setIsRefreshingPlaylists(false);
	}, [accessToken, makeApiRequestWithContext]);

	const fetchMorePlaylists = useCallback(async () => {
		setIsLoadingMorePlaylists(true);

		const result = await fetchMorePlaylistsService(
			playlistsNextUrl,
			isLoadingMorePlaylists,
			accessToken,
			makeApiRequestWithContext
		);

		if (result.playlists) {
			setPlaylists((prev) => [...(prev || []), ...result.playlists!]);
			setPlaylistsNextUrl(result.nextUrl);
		}
		setIsLoadingMorePlaylists(false);
	}, [playlistsNextUrl, isLoadingMorePlaylists, accessToken, makeApiRequestWithContext]);

	const fetchAlbums = useCallback(async () => {
		if (!accessToken) return;
		setIsRefreshingAlbums(true);

		const result = await fetchAlbumsService(accessToken, makeApiRequestWithContext, saveCachedData);

		setAlbums(result.albums || []);
		setAlbumsNextUrl(result.nextUrl);
		setIsRefreshingAlbums(false);
	}, [accessToken, makeApiRequestWithContext]);

	const fetchPodcasts = useCallback(async () => {
		if (!accessToken) return;
		setIsRefreshingPodcasts(true);

		const result = await fetchPodcastsService(accessToken, makeApiRequestWithContext, saveCachedData);

		setPodcasts(result.podcasts || []);
		setPodcastsNextUrl(result.nextUrl);
		setIsRefreshingPodcasts(false);
	}, [accessToken, makeApiRequestWithContext]);

	const fetchMoreAlbums = useCallback(async () => {
		setIsLoadingMoreAlbums(true);

		const result = await fetchMoreAlbumsService(
			albumsNextUrl,
			isLoadingMoreAlbums,
			accessToken,
			makeApiRequestWithContext
		);

		if (result.albums) {
			setAlbums((prev) => [...(prev || []), ...result.albums!]);
			setAlbumsNextUrl(result.nextUrl);
		}
		setIsLoadingMoreAlbums(false);
	}, [albumsNextUrl, isLoadingMoreAlbums, accessToken, makeApiRequestWithContext]);

	const fetchMorePodcasts = useCallback(async () => {
		setIsLoadingMorePodcasts(true);

		const result = await fetchMorePodcastsService(
			podcastsNextUrl,
			isLoadingMorePodcasts,
			accessToken,
			makeApiRequestWithContext
		);

		if (result.podcasts) {
			setPodcasts((prev) => [...(prev || []), ...result.podcasts!]);
			setPodcastsNextUrl(result.nextUrl);
		}
		setIsLoadingMorePodcasts(false);
	}, [podcastsNextUrl, isLoadingMorePodcasts, accessToken, makeApiRequestWithContext]);

	const fetchArtists = useCallback(async () => {
		if (!accessToken) return;
		setIsRefreshingArtists(true);

		const result = await fetchArtistsService(accessToken, makeApiRequestWithContext, saveCachedData);

		setArtists(result.artists || []);
		setArtistsNextUrl(result.nextUrl);
		setIsRefreshingArtists(false);
	}, [accessToken, makeApiRequestWithContext]);

	const fetchMoreArtists = useCallback(async () => {
		setIsLoadingMoreArtists(true);

		const result = await fetchMoreArtistsService(
			artistsNextUrl,
			isLoadingMoreArtists,
			accessToken,
			makeApiRequestWithContext
		);

		if (result.artists) {
			setArtists((prev) => [...(prev || []), ...result.artists!]);
			setArtistsNextUrl(result.nextUrl);
		}
		setIsLoadingMoreArtists(false);
	}, [artistsNextUrl, isLoadingMoreArtists, accessToken, makeApiRequestWithContext]);

	const fetchSavedTracks = useCallback(async () => {
		if (!accessToken) return;
		setIsRefreshingSavedTracks(true);

		const result = await fetchSavedTracksService(accessToken, makeApiRequestWithContext, saveCachedData);

		setSavedTracks(result.savedTracks || []);
		setSavedTracksNextUrl(result.nextUrl);
		setIsRefreshingSavedTracks(false);
	}, [accessToken, makeApiRequestWithContext]);

	const fetchMoreSavedTracks = useCallback(async () => {
		setIsLoadingMoreSavedTracks(true);

		const result = await fetchMoreSavedTracksService(
			savedTracksNextUrl,
			isLoadingMoreSavedTracks,
			accessToken,
			makeApiRequestWithContext
		);

		if (result.savedTracks) {
			setSavedTracks((prev) => [...(prev || []), ...result.savedTracks!]);
			setSavedTracksNextUrl(result.nextUrl);
		}
		setIsLoadingMoreSavedTracks(false);
	}, [savedTracksNextUrl, isLoadingMoreSavedTracks, accessToken, makeApiRequestWithContext]);

	const fetchSavedEpisodes = useCallback(async () => {
		if (!accessToken) return;
		setIsRefreshingSavedEpisodes(true);

		const result = await fetchSavedEpisodesService(accessToken, makeApiRequestWithContext, saveCachedData);

		setSavedEpisodes(result.savedEpisodes || []);
		setSavedEpisodesNextUrl(result.nextUrl);
		setIsRefreshingSavedEpisodes(false);
	}, [accessToken, makeApiRequestWithContext]);

	const fetchMoreSavedEpisodes = useCallback(async () => {
		setIsLoadingMoreSavedEpisodes(true);

		const result = await fetchMoreSavedEpisodesService(
			savedEpisodesNextUrl,
			isLoadingMoreSavedEpisodes,
			accessToken,
			makeApiRequestWithContext
		);

		if (result.savedEpisodes) {
			setSavedEpisodes((prev) => [...(prev || []), ...result.savedEpisodes!]);
			setSavedEpisodesNextUrl(result.nextUrl);
		}
		setIsLoadingMoreSavedEpisodes(false);
	}, [savedEpisodesNextUrl, isLoadingMoreSavedEpisodes, accessToken, makeApiRequestWithContext]);

	const saveAlbum = useCallback(
		async (albumId: string): Promise<boolean> => {
			const result = await saveAlbumService(albumId, accessToken, ensureValidToken);
			if (result) {
				const cachedAlbums = await refreshSavedAlbumsFromCache();
				if (cachedAlbums) setAlbums(cachedAlbums);
			}
			return result;
		},
		[accessToken, ensureValidToken]
	);

	const removeAlbum = useCallback(
		async (albumId: string): Promise<boolean> => {
			const result = await removeAlbumService(albumId, accessToken, ensureValidToken);
			if (result) {
				const cachedAlbums = await refreshSavedAlbumsFromCache();
				if (cachedAlbums) setAlbums(cachedAlbums);
			}
			return result;
		},
		[accessToken, ensureValidToken]
	);

	const checkIfAlbumIsSaved = useCallback(
		(albumId: string) => checkIfAlbumIsSavedService(albumId, accessToken, ensureValidToken),
		[accessToken, ensureValidToken]
	);

	const followPodcast = useCallback(
		async (showId: string): Promise<boolean> => {
			const result = await followPodcastService(showId, accessToken, ensureValidToken);
			if (result) {
				const cachedShows = await refreshFollowedPodcastsFromCache();
				if (cachedShows) setPodcasts(cachedShows);
			}
			return result;
		},
		[accessToken, ensureValidToken]
	);

	const unfollowPodcast = useCallback(
		async (showId: string): Promise<boolean> => {
			const result = await unfollowPodcastService(showId, accessToken, ensureValidToken);
			if (result) {
				const cachedShows = await refreshFollowedPodcastsFromCache();
				if (cachedShows) setPodcasts(cachedShows);
			}
			return result;
		},
		[accessToken, ensureValidToken]
	);

	const checkIfFollowingPodcast = useCallback(
		(showId: string) => checkIfFollowingPodcastService(showId, accessToken, ensureValidToken),
		[accessToken, ensureValidToken]
	);

	const followArtist = useCallback(
		async (artistId: string): Promise<boolean> => {
			const result = await followArtistService(artistId, accessToken, ensureValidToken);
			if (result) {
				const cachedArtists = await refreshFollowedArtistsFromCache();
				if (cachedArtists) setArtists(cachedArtists);
			}
			return result;
		},
		[accessToken, ensureValidToken]
	);

	const unfollowArtist = useCallback(
		async (artistId: string): Promise<boolean> => {
			const result = await unfollowArtistService(artistId, accessToken, ensureValidToken);
			if (result) {
				const cachedArtists = await refreshFollowedArtistsFromCache();
				if (cachedArtists) setArtists(cachedArtists);
			}
			return result;
		},
		[accessToken, ensureValidToken]
	);

	const checkIfFollowingArtist = useCallback(
		(artistId: string) => checkIfFollowingArtistService(artistId, accessToken, ensureValidToken),
		[accessToken, ensureValidToken]
	);

	const fetchArtistTopTracks = useCallback(
		(artistId: string) => fetchArtistTopTracksService(artistId, accessToken, ensureValidToken),
		[accessToken, ensureValidToken]
	);

	const fetchArtistAlbums = useCallback(
		(artistId: string) => fetchArtistAlbumsService(artistId, accessToken, ensureValidToken),
		[accessToken, ensureValidToken]
	);

	const fetchMoreArtistAlbums = useCallback(
		(nextUrl: string | null, isLoadingMore: boolean) =>
			fetchMoreArtistAlbumsService(nextUrl, isLoadingMore, accessToken, makeApiRequestWithContext),
		[accessToken, makeApiRequestWithContext]
	);

	const refreshSavedAlbumsFromCacheMethod = useCallback(async () => {
		const cachedAlbums = await refreshSavedAlbumsFromCache();
		if (cachedAlbums) setAlbums(cachedAlbums);
	}, []);

	const refreshFollowedPodcastsFromCacheMethod = useCallback(async () => {
		const cachedPodcasts = await refreshFollowedPodcastsFromCache();
		if (cachedPodcasts) setPodcasts(cachedPodcasts);
	}, []);

	const refreshFollowedArtistsFromCacheMethod = useCallback(async () => {
		const cachedArtists = await refreshFollowedArtistsFromCache();
		if (cachedArtists) setArtists(cachedArtists);
	}, []);

	const refreshSavedEpisodesFromCacheMethod = useCallback(async () => {
		const cachedEpisodes = await refreshSavedEpisodesFromCache();
		if (cachedEpisodes) setSavedEpisodes(cachedEpisodes);
	}, []);

	useEffect(() => {
		const loadCached = async () => {
			const cachedData = await loadCachedData();
			setPlaylists(cachedData.playlists);
			setAlbums(cachedData.albums);
			setPodcasts(cachedData.podcasts);
			setArtists(cachedData.artists);
			setSavedTracks(cachedData.savedTracks);
			setSavedEpisodes(cachedData.savedEpisodes);
		};
		loadCached();
	}, []);

	useEffect(() => {
		const triggerInitialDataFetch = async () => {
			if (accessToken && !initialDataFetchTriggered && isOnline) {
				setInitialDataFetchTriggered(true);
				logInfo("LibraryContext: Auth state loaded and online, proceeding with data fetch...");

				const validToken = await ensureValidToken();

				if (validToken) {
					await fetchInitialData(validToken);
				}
			} else if (accessToken && !initialDataFetchTriggered && !isOnline) {
				logInfo("LibraryContext: Offline - skipping initial data fetch, using cached data");
				setInitialDataFetchTriggered(true);
			}
		};

		triggerInitialDataFetch();
	}, [accessToken, initialDataFetchTriggered, ensureValidToken, fetchInitialData, isOnline]);

	const addTrackToPlaylist = useCallback(
		async (playlistId: string, trackUri: string): Promise<boolean> => {
			try {
				const response = await makeApiRequestWithContext(
					`https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
					"Add track to playlist",
					false,
					0,
					{
						method: "POST",
						body: JSON.stringify({ uris: [trackUri] }),
						headers: { "Content-Type": "application/json" },
					}
				);
				return response !== null;
			} catch (error) {
				logInfo("Error adding track to playlist:", error);
				return false;
			}
		},
		[makeApiRequestWithContext]
	);

	const value: LibraryContextType = {
		playlists,
		playlistsNextUrl,
		isLoadingMorePlaylists,
		isRefreshingPlaylists,
		fetchPlaylists,
		fetchMorePlaylists,
		albums,
		albumsNextUrl,
		isLoadingMoreAlbums,
		isRefreshingAlbums,
		fetchAlbums,
		fetchMoreAlbums,
		saveAlbum,
		removeAlbum,
		checkIfAlbumIsSaved,
		podcasts,
		podcastsNextUrl,
		isLoadingMorePodcasts,
		isRefreshingPodcasts,
		fetchPodcasts,
		fetchMorePodcasts,
		followPodcast,
		unfollowPodcast,
		checkIfFollowingPodcast,
		artists,
		isLoadingMoreArtists,
		isRefreshingArtists,
		fetchArtists,
		fetchMoreArtists,
		artistsNextUrl,
		followArtist,
		unfollowArtist,
		checkIfFollowingArtist,
		fetchArtistTopTracks,
		fetchArtistAlbums,
		fetchMoreArtistAlbums,
		savedTracks,
		savedTracksNextUrl,
		isLoadingMoreSavedTracks,
		isRefreshingSavedTracks,
		fetchSavedTracks,
		fetchMoreSavedTracks,
		refreshSavedAlbumsFromCache: refreshSavedAlbumsFromCacheMethod,
		refreshFollowedPodcastsFromCache: refreshFollowedPodcastsFromCacheMethod,
		refreshFollowedArtistsFromCache: refreshFollowedArtistsFromCacheMethod,
		savedEpisodes,
		savedEpisodesNextUrl,
		isLoadingMoreSavedEpisodes,
		isRefreshingSavedEpisodes,
		fetchSavedEpisodes,
		fetchMoreSavedEpisodes,
		refreshSavedEpisodesFromCache: refreshSavedEpisodesFromCacheMethod,
		clearCachedData,
		makeApiRequest: makeApiRequestWithContext,
		addTrackToPlaylist,
	};

	return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
};

export const useSpotifyLibrary = () => {
	const context = useContext(LibraryContext);
	if (context === undefined) {
		throw new Error("useSpotifyLibrary must be used within a LibraryProvider");
	}
	return context;
};
