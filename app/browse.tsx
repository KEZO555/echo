import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import type { SpotifyContentItem } from "@/modules/spotify-sdk";
import { spotify } from "@/modules/spotify-sdk";
import {
  ContentContainer,
  CustomScrollView,
  MediaListItem,
  StyledText,
} from "@/shared/components";
import { usePreventDoubleTap } from "@/shared/hooks";
import { detailScreenStyles } from "@/shared/styles/detailScreen";
import { logError, n } from "@/shared/utils";

export default function BrowseScreen() {
  const { id, uri, title, hasChildren } = useLocalSearchParams<{
    id?: string;
    uri?: string;
    title?: string;
    hasChildren?: string;
  }>();
  const router = useRouter();

  const [items, setItems] = useState<SpotifyContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const headerTitle = title || "Made for You";
  const parentUri = uri;

  const fetchContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result =
        id && uri
          ? await spotify.getContentChildren({
              id,
              uri,
              title: title ?? null,
              subtitle: null,
              playable: false,
              hasChildren: hasChildren === "1",
              imageUri: null,
            })
          : await spotify.getRecommendedContent();
      setItems(result.items ?? []);
    } catch (fetchError) {
      logError("Browse: failed to load content", fetchError);
      setError(
        "Couldn't load Spotify content. Make sure the Spotify app is open and connected."
      );
    } finally {
      setIsLoading(false);
    }
  }, [id, uri, title, hasChildren]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handlePlay = useCallback(
    async (item: SpotifyContentItem, index: number) => {
      try {
        const isTrack = item.uri.includes(":track:");
        const inContext =
          !!parentUri &&
          (parentUri.includes(":playlist:") || parentUri.includes(":album:"));
        if (isTrack && inContext && parentUri) {
          await spotify.skipToIndex(parentUri, index);
        } else {
          await spotify.play(item.uri);
        }
        router.push("/playing");
      } catch (playError) {
        logError("Browse: failed to play item", playError);
      }
    },
    [parentUri, router]
  );

  const handleOpen = usePreventDoubleTap((item: SpotifyContentItem) => {
    router.push({
      pathname: "/browse",
      params: {
        id: item.id,
        uri: item.uri,
        title: item.title ?? "",
        hasChildren: item.hasChildren ? "1" : "0",
      },
    });
  });

  const canPlayContext =
    !!parentUri &&
    (parentUri.includes(":playlist:") || parentUri.includes(":album:"));

  const handlePlayAll = usePreventDoubleTap(async () => {
    if (!parentUri) {
      return;
    }
    try {
      await spotify.play(parentUri);
      router.push("/playing");
    } catch (playError) {
      logError("Browse: failed to play context", playError);
    }
  });

  const handlePress = (item: SpotifyContentItem, index: number) => {
    if (item.hasChildren) {
      handleOpen(item);
    } else if (item.playable) {
      handlePlay(item, index);
    }
  };

  if (isLoading) {
    return <ContentContainer headerTitle={headerTitle} />;
  }

  if (error) {
    return (
      <ContentContainer
        headerTitle={headerTitle}
        style={{ paddingHorizontal: n(20) }}
      >
        <StyledText style={detailScreenStyles.errorText}>{error}</StyledText>
      </ContentContainer>
    );
  }

  return (
    <ContentContainer
      headerIcon={canPlayContext ? "play-arrow" : undefined}
      headerIconPress={handlePlayAll}
      headerIconShowLength={canPlayContext ? 1 : 0}
      headerTitle={headerTitle}
      style={{ paddingHorizontal: n(20) }}
    >
      <View style={{ flex: 1, paddingBottom: n(20) }}>
        <CustomScrollView
          contentContainerStyle={detailScreenStyles.listContentContainer}
          data={items}
          ItemSeparatorComponent={() => <View style={{ height: n(8) }} />}
          keyExtractor={(item: SpotifyContentItem, index: number) =>
            `${item.uri || "item"}-${index}`
          }
          ListEmptyComponent={
            <StyledText style={detailScreenStyles.emptyText}>
              Nothing to show here.
            </StyledText>
          }
          overScrollMode="never"
          renderItem={({
            item,
            index,
          }: {
            item: SpotifyContentItem;
            index: number;
          }) => (
            <MediaListItem
              onLongPress={
                item.playable ? () => handlePlay(item, index) : undefined
              }
              onPress={() => handlePress(item, index)}
              placeholderIcon={
                item.hasChildren ? "library-music" : "music-note"
              }
              primaryText={item.title ?? "Untitled"}
              secondaryText={item.subtitle ?? undefined}
            />
          )}
        />
      </View>
    </ContentContainer>
  );
}
