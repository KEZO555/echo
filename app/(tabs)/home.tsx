import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useAuth } from "@/features/auth";
import {
  usePodcastsStore,
  useSavedEpisodesStore,
} from "@/features/library/stores";
import { usePlayback } from "@/features/playback";
import { useSettings } from "@/features/settings";
import {
  ContentContainer,
  CustomScrollView,
  HapticPressable,
  MediaListItem,
  StyledText,
} from "@/shared/components";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import { tabScreenStyles as styles } from "@/shared/styles/detailScreen";
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

type HomeListItem =
  | { key: string; type: "section"; label: string }
  | { key: string; type: "resume"; entry: SpotifySavedEpisode }
  | { key: string; type: "newEpisode"; entry: NewEpisodeEntry }
  | { key: string; type: "track"; track: SpotifyTrack }
  | { key: string; type: "link"; label: string; route: string };

const getResumeMs = (episode: SpotifyEpisode): number => {
  const resume = episode.resume_point;
  if (!resume || resume.fully_played) {
    return 0;
  }
  return resume.resume_position_ms ?? 0;
};

export default function HomeScreen() {
  const { accessToken, user, isLoading: isAuthLoading } = useAuth();
  const { playTrackWithContext, playContext, playTracksWithWebApi } =
    usePlayback();
  const { hideYourEpisodes } = useSettings();
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

  const fetchRecent = useCallback(async () => {
    const data = await apiGet<{ items: { track: SpotifyTrack }[] }>(
      "https://api.spotify.com/v1/me/player/recently-played?limit=20"
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

  const renderItem = ({ item }: { item: HomeListItem }) => {
    switch (item.type) {
      case "section":
        return (
          <StyledText style={homeStyles.sectionLabel}>{item.label}</StyledText>
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
            <MaterialIcons color="#888888" name="chevron-right" size={n(24)} />
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
    </ContentContainer>
  );
}

const homeStyles = StyleSheet.create({
  sectionLabel: {
    fontSize: n(16),
    marginTop: n(10),
    marginBottom: n(2),
    color: "#888888",
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
