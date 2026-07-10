import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, View } from "react-native";
import {
  fetchNewEpisodesForShows,
  type NewEpisodeEntry,
  usePodcastsStore,
} from "@/features/library";
import { usePlayback } from "@/features/playback";
import {
  ContentContainer,
  CustomScrollView,
  MediaListItem,
  StyledText,
} from "@/shared/components";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import { tabScreenStyles as styles } from "@/shared/styles/detailScreen";
import type { SpotifyEpisode } from "@/shared/types/spotify";
import { getThumbnailImage, logError, n } from "@/shared/utils";

const ItemSeparator = () => <View style={{ height: n(8) }} />;
const NEW_EPISODES_TTL_MS = 15 * 60_000;
const NEW_EPISODES_DISK_KEY = "newEpisodesCache";

// Cached so returning to the screen doesn't refire one request per followed
// show every time. Also mirrored to disk so a cold open paints instantly.
interface NewEpisodesCache {
  entries: NewEpisodeEntry[];
  fetchedAt: number;
}
let cache: NewEpisodesCache | null = null;

// Drop the heaviest fields we never use in this list before persisting.
const stripHeavy = (key: string, value: unknown) =>
  key === "available_markets" || key === "html_description" ? undefined : value;

const readDiskCache = async (): Promise<NewEpisodesCache | null> => {
  try {
    const raw = await AsyncStorage.getItem(NEW_EPISODES_DISK_KEY);
    return raw ? (JSON.parse(raw) as NewEpisodesCache) : null;
  } catch {
    return null;
  }
};

const getResumeMs = (episode: SpotifyEpisode): number => {
  const resume = episode.resume_point;
  if (!resume || resume.fully_played) {
    return 0;
  }
  return resume.resume_position_ms ?? 0;
};

export default function NewEpisodesScreen() {
  const podcasts = usePodcastsStore((s) => s.podcasts);
  const { playContext, playTracksWithWebApi } = usePlayback();
  const { isOnline } = useNetworkState();
  const router = useRouter();
  const [entries, setEntries] = useState<NewEpisodeEntry[] | null>(
    cache?.entries ?? null
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!(isOnline && podcasts?.length)) {
      return;
    }
    setIsRefreshing(true);
    try {
      const fresh = await fetchNewEpisodesForShows(podcasts, {
        perShow: 1,
        onPartial: setEntries,
      });
      cache = { entries: fresh, fetchedAt: Date.now() };
      setEntries(fresh);
      AsyncStorage.setItem(
        NEW_EPISODES_DISK_KEY,
        JSON.stringify(cache, stripHeavy)
      ).catch(() => undefined);
    } catch (error) {
      logError("NewEpisodes: refresh failed", error);
    }
    setIsRefreshing(false);
  }, [isOnline, podcasts]);

  const load = useCallback(async () => {
    if (!podcasts || podcasts.length === 0) {
      setEntries([]);
      return;
    }
    if (cache && Date.now() - cache.fetchedAt < NEW_EPISODES_TTL_MS) {
      setEntries(cache.entries);
      return;
    }
    // Paint the last saved list instantly while we refresh in the background.
    if (!cache) {
      const saved = await readDiskCache();
      if (saved) {
        cache = saved;
        setEntries((current) => current ?? saved.entries);
        if (Date.now() - saved.fetchedAt < NEW_EPISODES_TTL_MS) {
          return;
        }
      }
    }
    try {
      // Stream results in as each show responds instead of blocking on all.
      const fresh = await fetchNewEpisodesForShows(podcasts, {
        perShow: 1,
        onPartial: setEntries,
      });
      cache = { entries: fresh, fetchedAt: Date.now() };
      setEntries(fresh);
      AsyncStorage.setItem(
        NEW_EPISODES_DISK_KEY,
        JSON.stringify(cache, stripHeavy)
      ).catch(() => undefined);
    } catch (error) {
      logError("NewEpisodes: failed to load", error);
      setEntries((current) => current ?? []);
    }
  }, [podcasts]);

  useFocusEffect(
    useCallback(() => {
      if (isOnline) {
        load();
      }
    }, [isOnline, load])
  );

  const handlePlayAll = usePreventDoubleTap(() => {
    const list = entries ?? [];
    const uris = list
      .map((entry) => entry.episode.uri)
      .filter((uri): uri is string => Boolean(uri));
    if (uris.length === 0) {
      return;
    }
    const first = list[0].episode;
    // Open Now Playing immediately; start playback in the background.
    router.push({
      pathname: "/playing",
      params: {
        trackName: first.name ?? "",
        artistName: list[0].showName,
        albumArtUrl: getThumbnailImage(first.images) ?? "",
        durationMs: first.duration_ms?.toString() ?? "0",
        mediaType: "episode",
        episodeId: first.id,
      },
    });
    playTracksWithWebApi(uris).catch((error) =>
      logError("NewEpisodes: error playing all", error)
    );
  });

  const handleEpisodeInfo = usePreventDoubleTap((entry: NewEpisodeEntry) => {
    const { episode, showName } = entry;
    router.push({
      pathname: "/episode/[id]",
      params: {
        id: episode.id,
        episodeString: JSON.stringify(episode),
        episodeName: episode.name,
        showName,
      },
    });
  });

  const handleEpisodePress = usePreventDoubleTap((entry: NewEpisodeEntry) => {
    const { episode, showId, showName } = entry;
    const resumeMs = getResumeMs(episode);
    // Open Now Playing immediately; playback can block on an App Remote
    // (re)connection, so start it in the background instead of awaiting.
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
    playContext(`spotify:show:${showId}`, {
      offsetUri: episode.uri,
      positionMs: resumeMs > 0 ? resumeMs : undefined,
    }).catch((error) => logError("NewEpisodes: error playing episode", error));
  });

  return (
    <ContentContainer
      headerIcon={
        isOnline && (entries?.length ?? 0) > 0 ? "playlist-play" : undefined
      }
      headerIconPress={handlePlayAll}
      headerTitle="New Episodes"
      style={{ paddingHorizontal: n(20), paddingBottom: n(20) }}
    >
      <CustomScrollView
        contentContainerStyle={{ ...styles.listContentContainer }}
        data={entries ?? []}
        ItemSeparatorComponent={ItemSeparator}
        keyExtractor={(item: NewEpisodeEntry, index: number) =>
          `${item.episode.id}-${index}`
        }
        ListEmptyComponent={
          entries !== null ? (
            <StyledText style={styles.emptyText}>
              {isOnline
                ? "No new episodes from your podcasts yet."
                : "New episodes aren't available offline."}
            </StyledText>
          ) : null
        }
        overScrollMode="never"
        refreshControl={
          <RefreshControl
            colors={["white"]}
            onRefresh={handleRefresh}
            progressBackgroundColor="black"
            refreshing={isRefreshing}
          />
        }
        renderItem={({ item }: { item: NewEpisodeEntry }) => (
          <MediaListItem
            disabled={!isOnline}
            imageUri={getThumbnailImage(item.episode.images)}
            onLongPress={() => handleEpisodeInfo(item)}
            onPress={() => handleEpisodePress(item)}
            placeholderIcon="mic"
            primaryLines={2}
            primaryText={item.episode.name}
            secondaryText={item.showName}
          />
        )}
        style={styles.list}
      />
    </ContentContainer>
  );
}
