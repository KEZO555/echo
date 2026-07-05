import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
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

// Cached so returning to the screen doesn't refire one request per followed
// show every time.
let cache: { entries: NewEpisodeEntry[]; fetchedAt: number } | null = null;

const getResumeMs = (episode: SpotifyEpisode): number => {
  const resume = episode.resume_point;
  if (!resume || resume.fully_played) {
    return 0;
  }
  return resume.resume_position_ms ?? 0;
};

export default function NewEpisodesScreen() {
  const podcasts = usePodcastsStore((s) => s.podcasts);
  const { playContext } = usePlayback();
  const { isOnline } = useNetworkState();
  const router = useRouter();
  const [entries, setEntries] = useState<NewEpisodeEntry[] | null>(
    cache?.entries ?? null
  );

  const load = useCallback(async () => {
    if (!podcasts || podcasts.length === 0) {
      setEntries([]);
      return;
    }
    if (cache && Date.now() - cache.fetchedAt < NEW_EPISODES_TTL_MS) {
      setEntries(cache.entries);
      return;
    }
    try {
      const fresh = await fetchNewEpisodesForShows(podcasts, { perShow: 1 });
      cache = { entries: fresh, fetchedAt: Date.now() };
      setEntries(fresh);
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

  const handleEpisodePress = usePreventDoubleTap(
    async (entry: NewEpisodeEntry) => {
      const { episode, showId, showName } = entry;
      const resumeMs = getResumeMs(episode);
      try {
        await playContext(`spotify:show:${showId}`, {
          offsetUri: episode.uri,
          positionMs: resumeMs > 0 ? resumeMs : undefined,
        });
      } catch (error) {
        logError("NewEpisodes: error playing episode", error);
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

  return (
    <ContentContainer
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
        renderItem={({ item }: { item: NewEpisodeEntry }) => (
          <MediaListItem
            disabled={!isOnline}
            imageUri={getThumbnailImage(item.episode.images)}
            onPress={() => handleEpisodePress(item)}
            placeholderIcon="mic"
            primaryText={item.episode.name}
            scrollPrimary
            secondaryText={item.showName}
          />
        )}
        style={styles.list}
      />
    </ContentContainer>
  );
}
