import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSpotifyLibrary } from "@/features/library/contexts/LibraryContext";
import { usePlayback } from "@/features/playback/contexts/PlaybackContext";
import type { SpotifyPlaylist, SpotifyTrackSimple } from "@/shared/types/spotify";
import { StyledText, ContentContainer, CustomScrollView, TrackListItem, ListFooter } from "@/shared/components";
import { MaterialIcons } from "@expo/vector-icons";
import { log, logError } from "@/shared/utils";
import { getCachedPlaylistDetail } from "@/features/library/utils/cache";
import { usePreventDoubleTap } from "@/shared/hooks/usePreventDoubleTap";
import { detailScreenStyles } from "@/shared/styles/detailScreen";

interface PlaylistTrack {
    added_at: string;
    added_by: {
        external_urls: { spotify: string };
        href: string;
        id: string;
        type: string;
        uri: string;
    } | null;
    is_local: boolean;
    track: SpotifyTrackSimple | null;
}

interface SpotifyPlaylistFull extends SpotifyPlaylist {
    id: string;
    name: string;
    images: { url: string }[];
    tracks: {
        href: string;
        items: PlaylistTrack[];
        limit: number;
        next: string | null;
        offset: number;
        previous: string | null;
        total: number;
    };
}

export default function PlaylistDetailScreen() {
    const { id, playlistString, playlistName } = useLocalSearchParams<{
        id: string;
        playlistString?: string;
        playlistName?: string;
    }>();
    const { skipToIndex } = usePlayback();
    const { makeApiRequest } = useSpotifyLibrary();
    const router = useRouter();

    const initialPlaylist = playlistString
        ? (JSON.parse(playlistString) as SpotifyPlaylist)
        : null;

    const [playlist, setPlaylist] = useState<SpotifyPlaylistFull | null>(
        initialPlaylist as SpotifyPlaylistFull | null
    );
    const [isLoading, setIsLoading] = useState(!initialPlaylist);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingMoreTracks, setIsLoadingMoreTracks] = useState(false);

    useEffect(() => {
        if (!id) {
            setIsLoading(false);
            setError("Playlist ID is missing.");
            return;
        }

        const fetchPlaylistDetails = async () => {
            if (
                initialPlaylist &&
                (initialPlaylist as SpotifyPlaylistFull).tracks &&
                (initialPlaylist as SpotifyPlaylistFull).tracks.items
            ) {
                log(
                    "Playlist details: Using pre-loaded complete playlist data"
                );
                setIsLoading(false);
                return;
            }

            setIsLoading(true);

            try {
                const cachedPlaylist = await getCachedPlaylistDetail(id);
                if (cachedPlaylist && cachedPlaylist.tracks && cachedPlaylist.tracks.items) {
                    log("Playlist details: Using cached playlist data");
                    setPlaylist(cachedPlaylist);
                    setIsLoading(false);
                    return;
                }
            } catch (error) {
                logError("Error retrieving cached playlist:", error);
            }

            setError(null);
            try {
                const data = await makeApiRequest(
                    `https://api.spotify.com/v1/playlists/${id}`,
                    "Playlist details"
                );
                if (data) {
                    setPlaylist(data);
                } else {
                    throw new Error("Failed to fetch playlist details");
                }
            } catch (e: any) {
                logError("Error fetching playlist details:", e);
                setError(e.message || "An unexpected error occurred.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchPlaylistDetails();
    }, [id, makeApiRequest]);

    const loadMoreTracks = useCallback(async () => {
        if (!playlist?.tracks?.next || isLoadingMoreTracks) {
            return;
        }
        setIsLoadingMoreTracks(true);
        try {
            const data = await makeApiRequest(
                playlist.tracks.next,
                "More playlist tracks"
            );
            if (data) {
                setPlaylist((prevPlaylist) => {
                    if (!prevPlaylist || !prevPlaylist.tracks)
                        return prevPlaylist;
                    return {
                        ...prevPlaylist,
                        tracks: {
                            ...prevPlaylist.tracks,
                            items: [
                                ...prevPlaylist.tracks.items,
                                ...data.items,
                            ],
                            next: data.next,
                        },
                    };
                });
            }
        } catch (e: any) {
            logError("Error fetching more playlist tracks:", e);
        } finally {
            setIsLoadingMoreTracks(false);
        }
    }, [playlist, isLoadingMoreTracks, makeApiRequest]);

    const handleTrackPress = usePreventDoubleTap(
        async (trackIndex: number) => {
            const playlistTrack = playlist?.tracks?.items[trackIndex];
            const track = playlistTrack?.track;
            const artistName = track?.artists?.map((a: SpotifyTrackSimple['artists'][0]) => a.name).join(", ") ?? "";
            const albumArtUrl = track?.album?.images?.[0]?.url ?? playlist?.images?.[0]?.url ?? "";

            try {
                await skipToIndex({
                    type: "playlist",
                    uri: `spotify:playlist:${id}`,
                    currentIndex: trackIndex,
                });
                router.push({
                    pathname: "/playing",
                    params: {
                        trackName: track?.name ?? "",
                        artistName,
                        albumArtUrl,
                        durationMs: track?.duration_ms?.toString() ?? "0",
                    },
                });
            } catch (error) {
                logError("Error playing track:", error);
                router.push({
                    pathname: "/playing",
                    params: {
                        trackName: track?.name ?? "",
                        artistName,
                        albumArtUrl,
                        durationMs: track?.duration_ms?.toString() ?? "0",
                    },
                });
            }
        }
    );

    if (isLoading && !playlist) {
        return (
            <ContentContainer
                headerTitle={playlistName}
                style={{ paddingHorizontal: 20 }}
            >
            </ContentContainer>
        );
    }

    if (error) {
        return (
            <View style={detailScreenStyles.centeredMessageContainer}>
                <StyledText style={detailScreenStyles.errorText}>Error: {error}</StyledText>
            </View>
        );
    }

    if (!playlist) {
        return (
            <View style={detailScreenStyles.centeredMessageContainer}>
                <StyledText style={detailScreenStyles.emptyText}>
                    Playlist data is unavailable.
                </StyledText>
            </View>
        );
    }

    const playlistImageUrl = playlist.images?.[0]?.url;

    const renderTrackItem = ({
        item,
        index,
    }: {
        item: PlaylistTrack;
        index: number;
    }) => {
        const track = item.track;
        if (!track) return null;

        return (
            <TrackListItem
                key={`${track.id || "unknown"}-${index}`}
                trackNumber={(playlist.tracks?.offset || 0) + index + 1}
                name={track.name}
                artists={track.artists}
                durationMs={track.duration_ms}
                onPress={() => handleTrackPress(index)}
            />
        );
    };

    return (
        <ContentContainer
            headerTitle={playlist.name}
            style={{ paddingHorizontal: 20 }}
        >
            <View style={{ paddingBottom: 20 }}>
                <CustomScrollView
                    ListHeaderComponent={
                        <>
                            <View style={detailScreenStyles.imageContainer}>
                                {playlistImageUrl ? (
                                    <Image
                                        source={{ uri: playlistImageUrl }}
                                        style={detailScreenStyles.image}
                                    />
                                ) : (
                                    <View style={detailScreenStyles.placeholderImageContainer}>
                                        <MaterialIcons
                                            name="music-note"
                                            size={80}
                                            color="white"
                                        />
                                    </View>
                                )}
                            </View>
                        </>
                    }
                    data={playlist.tracks?.items || []}
                    renderItem={renderTrackItem}
                    keyExtractor={(item, index) =>
                        `${item.track?.id || "unknown-track"}-${index}`
                    }
                    contentContainerStyle={detailScreenStyles.listContentContainer}
                    overScrollMode="never"
                    onEndReached={loadMoreTracks}
                    onEndReachedThreshold={2}
                    ListFooterComponent={<ListFooter isLoading={isLoadingMoreTracks} />}
                    ListEmptyComponent={
                        isLoading ? null : playlist.tracks?.items?.length === 0 ? (
                            <StyledText style={detailScreenStyles.emptyText}>
                                No tracks found in this playlist.
                            </StyledText>
                        ) : null
                    }
                />
            </View>
        </ContentContainer>
    );
}
