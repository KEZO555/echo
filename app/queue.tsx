import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { usePlayback } from "@/features/playback";
import { useSettings } from "@/features/settings";
import {
  ContentContainer,
  CustomScrollView,
  FallbackImage,
  StyledText,
} from "@/shared/components";
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
}: {
  item: QueueItem;
  hideCover: boolean;
}) {
  return (
    <View style={styles.row}>
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
    </View>
  );
}

export default function QueueScreen() {
  const { getQueue } = usePlayback();
  const { hideAlbumCovers } = useSettings();
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
                <QueueRow hideCover={hideAlbumCovers} item={currentlyPlaying} />
                {queue.length > 0 && (
                  <StyledText style={[styles.sectionLabel, styles.nextLabel]}>
                    Next Up
                  </StyledText>
                )}
              </View>
            ) : null
          }
          overScrollMode="never"
          renderItem={({ item }: { item: QueueItem }) => (
            <QueueRow hideCover={hideAlbumCovers} item={item} />
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
    fontSize: n(22),
    lineHeight: n(24),
  },
  secondaryText: {
    fontSize: n(16),
    lineHeight: n(18),
  },
});
