import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { usePlayback } from "@/features/playback";
import { useSettings } from "@/features/settings";
import {
  ContentContainer,
  CustomScrollView,
  FallbackImage,
  HapticPressable,
  StyledText,
} from "@/shared/components";
import { usePreventDoubleTap } from "@/shared/hooks";
import { detailScreenStyles } from "@/shared/styles/detailScreen";
import type {
  SpotifyEpisode,
  SpotifyTrackSimple,
} from "@/shared/types/spotify";
import { getArtistNames, getThumbnailImage, logError, n } from "@/shared/utils";

const ItemSeparator = () => <View style={{ height: n(8) }} />;

type QueueItem = SpotifyTrackSimple | SpotifyEpisode;

const isEpisode = (item: QueueItem): item is SpotifyEpisode =>
  item.type === "episode";

const getItemImage = (item: QueueItem): string | undefined => {
  if (isEpisode(item)) {
    return (
      getThumbnailImage(item.images) ?? getThumbnailImage(item.show?.images)
    );
  }
  return getThumbnailImage(item.album?.images);
};

const getItemSubtitle = (item: QueueItem): string => {
  if (isEpisode(item)) {
    return item.show?.name ?? "Podcast";
  }
  return getArtistNames(item.artists);
};

function QueueRow({
  item,
  hideCover,
  onPress,
  disabled,
}: {
  item: QueueItem;
  hideCover: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <HapticPressable
      disabled={disabled || !onPress}
      onPress={onPress}
      style={styles.row}
    >
      {!hideCover && (
        <FallbackImage
          containerStyle={styles.imageContainer}
          placeholderIcon={isEpisode(item) ? "mic" : "music-note"}
          placeholderIconSize={n(24)}
          style={styles.image}
          uri={getItemImage(item)}
        />
      )}
      <View style={styles.textContainer}>
        <StyledText numberOfLines={1} style={styles.primaryText}>
          {item.name}
        </StyledText>
        <StyledText numberOfLines={1} style={styles.secondaryText}>
          {getItemSubtitle(item)}
        </StyledText>
      </View>
    </HapticPressable>
  );
}

const buildPlayingParams = (item: QueueItem) => ({
  trackName: item.name ?? "",
  artistName: getItemSubtitle(item),
  albumArtUrl: getItemImage(item) ?? "",
  durationMs: item.duration_ms?.toString() ?? "0",
  mediaType: isEpisode(item) ? "episode" : "track",
  episodeId: isEpisode(item) ? item.id : undefined,
});

export default function QueueScreen() {
  const { getQueue, playTracksWithWebApi } = usePlayback();
  const { hideAlbumCovers } = useSettings();
  const router = useRouter();
  const [currentlyPlaying, setCurrentlyPlaying] = useState<QueueItem | null>(
    null
  );
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getQueue();
      const playing = data?.currently_playing ?? null;
      setCurrentlyPlaying(playing);
      // Spotify's queue endpoint can echo the playing context (e.g. the whole
      // album repeated), so drop duplicates and the currently-playing item.
      const seen = new Set<string>();
      if (playing?.uri) {
        seen.add(playing.uri);
      }
      const deduped = (data?.queue ?? []).filter((entry) => {
        const key = entry.uri || entry.id;
        if (!key || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
      setQueue(deduped);
    } catch (error) {
      logError("Error fetching queue:", error);
    } finally {
      setIsLoading(false);
    }
  }, [getQueue]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handlePlayQueueItem = usePreventDoubleTap((index: number) => {
    // Play the tapped item and keep everything after it queued behind it.
    const uris = queue
      .slice(index)
      .map((entry) => entry.uri)
      .filter((uri): uri is string => Boolean(uri));
    if (uris.length === 0) {
      return;
    }
    // Return to the existing Now Playing layer immediately (pop this Queue)
    // rather than pushing a second player on top, so Back doesn't loop
    // Playing<->Queue. Start playback in the background.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace({
        pathname: "/playing",
        params: buildPlayingParams(queue[index]),
      });
    }
    playTracksWithWebApi(uris).catch((error) =>
      logError("Error playing queued item:", error)
    );
  });

  const handleOpenCurrent = usePreventDoubleTap(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace({ pathname: "/playing" });
    }
  });

  if (isLoading) {
    return <ContentContainer headerTitle="Queue" />;
  }

  const hasQueue = queue.length > 0 || currentlyPlaying !== null;

  if (!hasQueue) {
    return (
      <ContentContainer
        headerTitle="Queue"
        style={{ paddingHorizontal: n(20) }}
      >
        <StyledText style={detailScreenStyles.emptyText}>
          The queue is empty.
        </StyledText>
      </ContentContainer>
    );
  }

  return (
    <ContentContainer headerTitle="Queue" style={{ paddingHorizontal: n(20) }}>
      <View style={styles.listWrapper}>
        <CustomScrollView
          contentContainerStyle={detailScreenStyles.listContentContainer}
          data={queue}
          ItemSeparatorComponent={ItemSeparator}
          keyExtractor={(item: QueueItem, index: number) =>
            `${item.id || "queue"}-${index}`
          }
          ListHeaderComponent={
            currentlyPlaying ? (
              <View style={styles.headerSection}>
                <StyledText style={styles.sectionLabel}>Now Playing</StyledText>
                <QueueRow
                  hideCover={hideAlbumCovers}
                  item={currentlyPlaying}
                  onPress={handleOpenCurrent}
                />
                {queue.length > 0 && (
                  <StyledText style={[styles.sectionLabel, styles.nextLabel]}>
                    Next Up
                  </StyledText>
                )}
              </View>
            ) : null
          }
          overScrollMode="never"
          renderItem={({ item, index }: { item: QueueItem; index: number }) => (
            <QueueRow
              hideCover={hideAlbumCovers}
              item={item}
              onPress={() => handlePlayQueueItem(index)}
            />
          )}
        />
      </View>
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  listWrapper: {
    paddingBottom: n(20),
  },
  headerSection: {
    marginBottom: n(20),
  },
  sectionLabel: {
    fontSize: n(16),
    marginBottom: n(8),
  },
  nextLabel: {
    marginTop: n(20),
  },
  row: {
    minHeight: n(50),
    flexDirection: "row",
    alignItems: "center",
  },
  imageContainer: {
    width: n(50),
    height: n(50),
    marginRight: n(15),
  },
  image: {
    width: n(50),
    height: n(50),
  },
  textContainer: {
    flex: 1,
    paddingRight: n(10),
  },
  primaryText: {
    fontSize: n(25),
    lineHeight: n(28),
    letterSpacing: n(0.5),
  },
  secondaryText: {
    fontSize: n(20),
    lineHeight: n(23),
  },
});
