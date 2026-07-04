import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useAuth } from "@/features/auth";
import {
  useAlbumsStore,
  usePodcastsStore,
  useSavedEpisodesStore,
} from "@/features/library/stores";
import { usePlayback } from "@/features/playback";
import { useSettings } from "@/features/settings";
import {
  ContentContainer,
  ContextMenu,
  CustomScrollView,
  HapticPressable,
  MediaListItem,
  StyledText,
} from "@/shared/components";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import { tabScreenStyles as styles } from "@/shared/styles/detailScreen";
import { getSecondaryContentColor } from "@/shared/styles/lightTokens";
import type {
  SpotifyEpisode,
  SpotifySavedEpisode,
  SpotifyTrack,
} from "@/shared/types/spotify";
import {
  formatDuration,
  getArtistNames,
  getThumbnailImage,
  logError,
  n,
} from "@/shared/utils";
import { apiGet } from "@/shared/utils/api-client";

const CONTINUE_LISTENING_LIMIT = 3;
const RECENTLY_PLAYED_LIMIT = 5;
const NEW_EPISODES_LIMIT = 5;
const NEW_EPISODES_SHOW_LIMIT = 10;
const NEW_EPISODES_TTL_MS = 15 * 60_000;

const ItemSeparator = () => <View style={{ height: n(8) }} />;

interface NewEpisodeEntry {
  episode: SpotifyEpisode;
  showId: string;
  showName: string;
}

// Latest-episode lookups fan out one request per followed show, so keep the
// result for a while instead of refetching on every focus.
let newEpisodesCache: { entries: NewEpisodeEntry[]; fetchedAt: number } | null =
  null;

// Disk snapshot so the screen paints instantly on cold start while fresh
// data loads in the background.
const HOME_CACHE_KEY = "homeScreenCache";

interface HomeCacheData {
  recentTracks: SpotifyTrack[];
  newEpisodes: NewEpisodeEntry[];
  fetchedAt: number;
}

let homeCacheWriteState: HomeCacheData = {
  recentTracks: [],
  newEpisodes: [],
  fetchedAt: 0,
};

const stripMarkets = (_key: string, value: unknown) =>
  _key === "available_markets" ? undefined : value;

const persistHomeCache = (partial: Partial<HomeCacheData>) => {
  homeCacheWriteState = {
    ...homeCacheWriteState,
    ...partial,
    fetchedAt: Date.now(),
  };
  AsyncStorage.setItem(
    HOME_CACHE_KEY,
    JSON.stringify(homeCacheWriteState, stripMarkets)
  ).catch((error) => logError("Home: failed to persist cache", error));
};

type HomeListItem =
  | { key: string; type: "section"; label: string }
  | { key: string; type: "resume"; entry: SpotifySavedEpisode }
  | { key: string; type: "newEpisode"; entry: NewEpisodeEntry }
  | { key: string; type: "track"; track: SpotifyTrack }
  | { key: string; type: "link"; label: string; route: string };

type HomeMenuItem = Extract<
  HomeListItem,
  { type: "resume" | "newEpisode" | "track" }
>;

const getResumeMs = (episode: SpotifyEpisode): number => {
  const resume = episode.resume_point;
  if (!resume || resume.fully_played) {
    return 0;
  }
  return resume.resume_position_ms ?? 0;
};

export default function HomeScreen() {
  const { accessToken, user, isLoading: isAuthLoading } = useAuth();
  const {
    playTrackWithContext,
    playContext,
    playTracksWithWebApi,
    addToQueue,
  } = usePlayback();
  const saveAlbum = useAlbumsStore((s) => s.saveAlbum);
  const [menuItem, setMenuItem] = useState<HomeMenuItem | null>(null);
  const { hideYourEpisodes, invertColors } = useSettings();
  const secondaryColor = getSecondaryContentColor(invertColors);
  const { isOnline } = useNetworkState();
  const router = useRouter();

  const savedEpisodes = useSavedEpisodesStore((s) => s.savedEpisodes);
  const fetchEpisodes = useSavedEpisodesStore((s) => s.fetch);
  const isEpisodesRefreshing = useSavedEpisodesStore((s) => s.isRefreshing);
  const podcasts = usePodcastsStore((s) => s.podcasts);
  const fetchPodcasts = usePodcastsStore((s) => s.fetch);

  const [recentTracks, setRecentTracks] = useState<SpotifyTrack[]>([]);
  const [newEpisodes, setNewEpisodes] = useState<NewEpisodeEntry[]>(
    newEpisodesCache?.entries ?? []
  );

  // Paint from the disk snapshot immediately; fresh data replaces it when
  // the focus fetches land.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(HOME_CACHE_KEY)
      .then((raw) => {
        if (cancelled || !raw) {
          return;
        }
        const cache = JSON.parse(raw) as HomeCacheData;
        homeCacheWriteState = { ...homeCacheWriteState, ...cache };
        setRecentTracks((current) =>
          current.length > 0 ? current : (cache.recentTracks ?? [])
        );
        setNewEpisodes((current) =>
          current.length > 0 ? current : (cache.newEpisodes ?? [])
        );
        if (!newEpisodesCache && cache.newEpisodes?.length) {
          newEpisodesCache = {
            entries: cache.newEpisodes,
            fetchedAt: cache.fetchedAt ?? 0,
          };
        }
      })
      .catch((error) => logError("Home: failed to load cache", error));
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchRecent = useCallback(async () => {
    const data = await apiGet<{ items: { track: SpotifyTrack }[] }>(
      "https://api.spotify.com/v1/me/player/recently-played?limit=10"
    );
    const seen = new Set<string>();
    const deduped: SpotifyTrack[] = [];
    for (const entry of data?.items ?? []) {
      const track = entry.track;
      if (track?.id && !seen.has(track.id)) {
        seen.add(track.id);
        deduped.push(track);
      }
      if (deduped.length >= RECENTLY_PLAYED_LIMIT) {
        break;
      }
    }
    setRecentTracks(deduped);
    persistHomeCache({ recentTracks: deduped });
  }, []);

  const fetchNewEpisodes = useCallback(async (showList: typeof podcasts) => {
    if (!showList || showList.length === 0) {
      return;
    }
    if (
      newEpisodesCache &&
      Date.now() - newEpisodesCache.fetchedAt < NEW_EPISODES_TTL_MS
    ) {
      setNewEpisodes(newEpisodesCache.entries);
      return;
    }

    const shows = showList.slice(0, NEW_EPISODES_SHOW_LIMIT);
    const results = await Promise.all(
      shows.map(async (entry) => {
        const data = await apiGet<{ items: SpotifyEpisode[] }>(
          `https://api.spotify.com/v1/shows/${entry.show.id}/episodes?limit=1&market=from_token`
        );
        const episode = data?.items?.[0];
        if (!episode?.id) {
          return null;
        }
        return {
          episode,
          showId: entry.show.id,
          showName: entry.show.name,
        };
      })
    );

    const entries = results
      .filter((entry): entry is NewEpisodeEntry => entry !== null)
      .sort((a, b) =>
        (b.episode.release_date ?? "").localeCompare(
          a.episode.release_date ?? ""
        )
      )
      .slice(0, NEW_EPISODES_LIMIT);

    newEpisodesCache = { entries, fetchedAt: Date.now() };
    setNewEpisodes(entries);
    persistHomeCache({ newEpisodes: entries });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!(accessToken && user) || isAuthLoading || !isOnline) {
        return;
      }
      if (!isEpisodesRefreshing) {
        fetchEpisodes({ showRefreshing: false });
      }
      if (podcasts) {
        fetchNewEpisodes(podcasts).catch((error) =>
          logError("Home: new episodes failed", error)
        );
      } else {
        fetchPodcasts({ showRefreshing: false });
      }
      fetchRecent().catch((error) =>
        logError("Home: recently played failed", error)
      );
    }, [
      accessToken,
      user,
      isAuthLoading,
      isOnline,
      isEpisodesRefreshing,
      fetchEpisodes,
      podcasts,
      fetchNewEpisodes,
      fetchPodcasts,
      fetchRecent,
    ])
  );

  const continueListening = useMemo(() => {
    if (hideYourEpisodes || !savedEpisodes) {
      return [];
    }
    return savedEpisodes
      .filter((entry) => getResumeMs(entry.episode) > 0)
      .slice(0, CONTINUE_LISTENING_LIMIT);
  }, [savedEpisodes, hideYourEpisodes]);

  const listItems = useMemo(() => {
    const items: HomeListItem[] = [];
    if (continueListening.length > 0) {
      items.push({
        key: "section-continue",
        type: "section",
        label: "Continue Listening",
      });
      for (const entry of continueListening) {
        items.push({
          key: `resume-${entry.episode.id}`,
          type: "resume",
          entry,
        });
      }
    }
    if (newEpisodes.length > 0) {
      items.push({
        key: "section-new",
        type: "section",
        label: "New Episodes",
      });
      for (const entry of newEpisodes) {
        items.push({
          key: `new-${entry.episode.id}`,
          type: "newEpisode",
          entry,
        });
      }
    }
    if (recentTracks.length > 0) {
      items.push({
        key: "section-recent",
        type: "section",
        label: "Recently Played",
      });
      for (const track of recentTracks) {
        items.push({ key: `recent-${track.id}`, type: "track", track });
      }
      items.push({
        key: "link-recent",
        type: "link",
        label: "All recently played",
        route: "/recently-played",
      });
    }
    items.push({
      key: "link-top",
      type: "link",
      label: "Your top tracks",
      route: "/top-tracks",
    });
    return items;
  }, [continueListening, newEpisodes, recentTracks]);

  const handleResumePress = usePreventDoubleTap(
    async (savedEpisode: SpotifySavedEpisode) => {
      const episode = savedEpisode.episode;
      const resumeMs = getResumeMs(episode);
      await playTrackWithContext(episode.uri);
      router.push({
        pathname: "/playing",
        params: {
          trackName: episode.name ?? "",
          artistName: episode.show?.name ?? "",
          albumArtUrl:
            getThumbnailImage(episode.images) ??
            getThumbnailImage(episode.show?.images) ??
            "",
          durationMs: episode.duration_ms?.toString() ?? "0",
          mediaType: "episode",
          positionMs: resumeMs ? Math.floor(resumeMs).toString() : "0",
          episodeId: episode.id,
        },
      });
    }
  );

  const handleNewEpisodePress = usePreventDoubleTap(
    async (entry: NewEpisodeEntry) => {
      const { episode, showId, showName } = entry;
      const resumeMs = getResumeMs(episode);
      try {
        await playContext(`spotify:show:${showId}`, {
          offsetUri: episode.uri,
          positionMs: resumeMs > 0 ? resumeMs : undefined,
        });
      } catch (playError) {
        logError("Home: error playing episode", playError);
      }
      router.push({
        pathname: "/playing",
        params: {
          trackName: episode.name ?? "",
          artistName: showName,
          albumArtUrl: getThumbnailImage(episode.images) ?? "",
          durationMs: episode.duration_ms?.toString() ?? "0",
          mediaType: "episode",
          positionMs: resumeMs ? Math.floor(resumeMs).toString() : "0",
          episodeId: episode.id,
        },
      });
    }
  );

  const handleTrackPress = usePreventDoubleTap(async (track: SpotifyTrack) => {
    try {
      await playTracksWithWebApi([track.uri]);
    } catch (error) {
      logError("Home: failed to play track", error);
    }
    router.push({
      pathname: "/playing",
      params: {
        trackName: track.name ?? "",
        artistName: getArtistNames(track.artists ?? []),
        albumArtUrl: getThumbnailImage(track.album?.images) ?? "",
        durationMs: track.duration_ms?.toString() ?? "0",
      },
    });
  });

  const handleEpisodeInfo = useCallback(
    (episode: SpotifyEpisode, showName: string) => {
      router.push({
        pathname: "/episode/[id]",
        params: {
          id: episode.id,
          episodeString: JSON.stringify(episode),
          episodeName: episode.name,
          showName,
        },
      });
    },
    [router]
  );

  const handleGoToShow = useCallback(
    (showId: string, showName: string) => {
      router.push({
        pathname: "/podcast/[id]",
        params: { id: showId, showName },
      });
    },
    [router]
  );

  const buildEpisodeMenuActions = (
    item: Extract<HomeMenuItem, { type: "resume" | "newEpisode" }>,
    close: () => void
  ) => {
    const episode = item.entry.episode;
    const showId =
      item.type === "newEpisode" ? item.entry.showId : episode.show?.id;
    const showName =
      item.type === "newEpisode"
        ? item.entry.showName
        : (episode.show?.name ?? "");
    const play = () =>
      item.type === "resume"
        ? handleResumePress(item.entry)
        : handleNewEpisodePress(item.entry);
    return [
      {
        label: "Play",
        onPress: () => {
          close();
          play();
        },
      },
      {
        label: "Info",
        onPress: () => {
          close();
          handleEpisodeInfo(episode, showName);
        },
      },
      ...(showId
        ? [
            {
              label: "Go to show",
              onPress: () => {
                close();
                handleGoToShow(showId, showName);
              },
            },
          ]
        : []),
    ];
  };

  const buildTrackMenuActions = (track: SpotifyTrack, close: () => void) => {
    const album = track.album;
    return [
      {
        label: "Play",
        onPress: () => {
          close();
          handleTrackPress(track);
        },
      },
      {
        label: "Play later",
        onPress: () => {
          close();
          addToQueue(track.uri).catch((error) =>
            logError("Home: error adding to queue", error)
          );
        },
      },
      {
        label: "Add to playlist",
        onPress: () => {
          close();
          router.push({
            pathname: "/add-to-playlist",
            params: { trackUri: track.uri },
          });
        },
      },
      ...(album?.id
        ? [
            {
              label: "Go to album",
              onPress: () => {
                close();
                router.push({
                  pathname: "/album/[id]",
                  params: {
                    id: album.id,
                    albumName: album.name,
                    albumString: JSON.stringify({
                      id: album.id,
                      name: album.name,
                      images: album.images,
                      artists: album.artists,
                      uri: album.uri,
                    }),
                  },
                });
              },
            },
            {
              label: "Save album",
              onPress: () => {
                close();
                saveAlbum(album.id);
              },
            },
          ]
        : []),
    ];
  };

  const closeMenu = () => setMenuItem(null);
  let menuActions: { label: string; onPress: () => void }[] = [];
  if (menuItem) {
    menuActions =
      menuItem.type === "track"
        ? buildTrackMenuActions(menuItem.track, closeMenu)
        : buildEpisodeMenuActions(menuItem, closeMenu);
  }

  const menuTitle =
    menuItem?.type === "track"
      ? menuItem.track.name
      : menuItem?.entry.episode.name;

  const renderItem = ({ item }: { item: HomeListItem }) => {
    switch (item.type) {
      case "section":
        return (
          <StyledText
            style={[homeStyles.sectionLabel, { color: secondaryColor }]}
          >
            {item.label}
          </StyledText>
        );
      case "resume": {
        const episode = item.entry.episode;
        const remainingMs = Math.max(
          episode.duration_ms - getResumeMs(episode),
          0
        );
        return (
          <MediaListItem
            disabled={!isOnline}
            imageUri={
              getThumbnailImage(episode.images) ??
              getThumbnailImage(episode.show?.images)
            }
            onLongPress={() => setMenuItem(item)}
            onPress={() => handleResumePress(item.entry)}
            placeholderIcon="mic"
            primaryText={episode.name}
            scrollPrimary
            secondaryText={`${formatDuration(remainingMs, true)} left`}
          />
        );
      }
      case "newEpisode": {
        const { episode, showName } = item.entry;
        return (
          <MediaListItem
            disabled={!isOnline}
            imageUri={getThumbnailImage(episode.images)}
            onLongPress={() => setMenuItem(item)}
            onPress={() => handleNewEpisodePress(item.entry)}
            placeholderIcon="mic"
            primaryText={episode.name}
            scrollPrimary
            secondaryText={showName}
          />
        );
      }
      case "track":
        return (
          <MediaListItem
            disabled={!isOnline}
            imageUri={getThumbnailImage(item.track.album?.images)}
            onLongPress={() => setMenuItem(item)}
            onPress={() => handleTrackPress(item.track)}
            placeholderIcon="music-note"
            primaryText={item.track.name}
            secondaryText={getArtistNames(item.track.artists ?? [])}
          />
        );
      case "link":
        return (
          <HapticPressable
            disabled={!isOnline}
            onPress={() => router.push(item.route as never)}
            style={homeStyles.linkRow}
          >
            <StyledText style={homeStyles.linkLabel}>{item.label}</StyledText>
            <MaterialIcons
              color={secondaryColor}
              name="chevron-right"
              size={n(24)}
            />
          </HapticPressable>
        );
      default:
        return null;
    }
  };

  return (
    <ContentContainer
      headerTitle="Home"
      hideBackButton={true}
      style={{ paddingHorizontal: n(20), paddingBottom: n(20) }}
    >
      <CustomScrollView
        contentContainerStyle={{ ...styles.listContentContainer }}
        data={listItems}
        ItemSeparatorComponent={ItemSeparator}
        keyExtractor={(item: HomeListItem) => item.key}
        overScrollMode="never"
        renderItem={renderItem}
        style={styles.list}
      />
      <ContextMenu
        actions={menuActions}
        onClose={() => setMenuItem(null)}
        title={menuTitle}
        visible={menuItem !== null}
      />
    </ContentContainer>
  );
}

const homeStyles = StyleSheet.create({
  sectionLabel: {
    fontSize: n(20),
    marginTop: n(10),
    marginBottom: n(2),
  },
  linkRow: {
    minHeight: n(44),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  linkLabel: {
    fontSize: n(20),
  },
});
