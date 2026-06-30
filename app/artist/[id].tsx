import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth";
import {
  checkIfFollowingArtist,
  followArtist,
  unfollowArtist,
} from "@/features/library";
import { DetailScreen } from "@/shared/components";
import { useNetworkState, useSaveStatus } from "@/shared/hooks";
import type { SpotifyImage } from "@/shared/types/spotify";
import { getLargestImage, logError } from "@/shared/utils";
import { apiGet } from "@/shared/utils/api-client";

interface SpotifyArtistFull {
  id: string;
  name: string;
  images: SpotifyImage[];
}

export default function ArtistDetailScreen() {
  const { id, artistName } = useLocalSearchParams<{
    id: string;
    artistName?: string;
  }>();

  const { accessToken } = useAuth();
  const { isOnline } = useNetworkState();

  const [artist, setArtist] = useState<SpotifyArtistFull | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const {
    isSaved: isFollowing,
    isChecking: isCheckingFollow,
    toggle: toggleFollow,
  } = useSaveStatus({
    id,
    checkFn: checkIfFollowingArtist,
    saveFn: followArtist,
    removeFn: unfollowArtist,
    accessToken,
  });

  useEffect(() => {
    if (!(id && isOnline)) {
      setIsInitialLoading(false);
      return;
    }
    let cancelled = false;
    apiGet<SpotifyArtistFull>(`https://api.spotify.com/v1/artists/${id}`)
      .then((data) => {
        if (!cancelled && data) {
          setArtist(data);
        }
      })
      .catch((e) => logError("Error fetching artist:", e))
      .finally(() => {
        if (!cancelled) {
          setIsInitialLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, isOnline]);

  const displayName = artist?.name ?? artistName ?? "Artist";
  const imageUrl = getLargestImage(artist?.images);

  return (
    <DetailScreen
      data={[]}
      emptyMessage="Spotify no longer lets this app list an artist's songs or albums. You can still follow them here, or find their music through search."
      headerIcon={isFollowing ? "remove" : "add"}
      headerIconPress={toggleFollow}
      headerIconShowLength={isCheckingFollow ? 0 : 1}
      imageUrl={imageUrl}
      isInitialLoading={isInitialLoading}
      keyExtractor={(_item, index) => index.toString()}
      placeholderIcon="person"
      renderItem={() => null}
      title={displayName}
    />
  );
}
