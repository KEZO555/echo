import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    View,
    Image,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSpotifyLibrary } from "@/features/library/contexts/LibraryContext";
import { usePlayback } from "@/features/playback/contexts/PlaybackContext";
import type { SpotifyPlaylist, SpotifyTrackSimple } from "@/shared/types/spotify";
import { StyledText, ContentContainer, CustomScrollView, TrackListItem, ListFooter } from "@/shared/components";
import { MaterialIcons } from "@expo/vector-icons";
import { log, logError } from "@/shared/utils";
import { getCachedPlaylistDetail, saveCachedPlaylistDetail } from "@/features/library/utils/cache";
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

    const initialPlaylist = useMemo(() => {
        if (!playlistString) return null;
        try {
            return JSON.parse(playlistString) as SpotifyPlaylistFull;
        } catch {
            return null;
        }
    }, [playlistString]);

    const [playlist, setPlaylist] = useState<SpotifyPlaylistFull | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingMoreTracks, setIsLoadingMoreTracks] = useState(false);

    const displayName = playlist?.name ?? initialPlaylist?.name ?? playlistName ?? "Playlist";
    const displayImageUrl = playlist?.images?.[0]?.url ?? initialPlaylist?.images?.[0]?.url;

    const handleTitlePress = useCallback(() => {
        if (id) {
            router.push({
                pathname: "/rename-playlist",
                params: {
                    playlistId: id,
                    currentName: displayName,
                },
            });
        }
    }, [id, displayName, router]);

    useEffect(() => {
        if (initialPlaylist && !playlist) {
            setPlaylist(initialPlaylist);
        }
    }, [initialPlaylist, playlist]);

    useEffect(() => {
        const hasInitialTrackItems = !!(initialPlaylist as SpotifyPlaylistFull)?.tracks?.items;
        if (hasInitialTrackItems || !id) return;

        const loadCache = async () => {
            try {
                const cachedPlaylist = await getCachedPlaylistDetail(id);
                if (cachedPlaylist?.tracks?.items) {
                    log("Playlist details: Displaying cached data");
                    setPlaylist(cachedPlaylist);
                }
            } catch (error) {
                logError("Error retrieving cached playlist:", error);
            }
        };
        loadCache();
    }, [id, initialPlaylist]);

    const fetchPlaylistDetails = useCallback(async () => {
        if (!id) {
            setError("Playlist ID is missing.");
            return;
        }

        const hasInitialData = !!(initialPlaylist as SpotifyPlaylistFull)?.tracks?.items;

        try {
            const data = await makeApiRequest(
                `https://api.spotify.com/v1/playlists/${id}`,
                "Playlist details"
            );
            if (data) {
                log("Playlist details: Fetched fresh data from API");
                setPlaylist(data);
                await saveCachedPlaylistDetail(data);
            } else if (!hasInitialData) {
                throw new Error("Failed to fetch playlist details");
            }
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
            logError("Error fetching playlist details:", e);
            if (!hasInitialData) {
                setError(errorMessage);
            }
        }
    }, [id, makeApiRequest, initialPlaylist]);

    useFocusEffect(
        useCallback(() => {
            fetchPlaylistDetails();
        }, [fetchPlaylistDetails])
    );

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
                trackNumber={(playlist?.tracks?.offset || 0) + index + 1}
                name={track.name}
                artists={track.artists}
                durationMs={track.duration_ms}
                onPress={() => handleTrackPress(index)}
            />
        );
    };

    return (
        <ContentContainer
            headerTitle={displayName}
            style={{ paddingHorizontal: 20 }}
            onTitlePress={handleTitlePress}
        >
            <View style={{ paddingBottom: 20 }}>
                <CustomScrollView
                    ListHeaderComponent={
                        displayImageUrl ? (
                            <View style={detailScreenStyles.imageContainer}>
                                <Image
                                    source={{ uri: displayImageUrl }}
                                    style={detailScreenStyles.image}
                                    fadeDuration={0}
                                />
                            </View>
                        ) : (
                            <View style={detailScreenStyles.imageContainer}>
                                <View style={detailScreenStyles.placeholderImageContainer}>
                                    <MaterialIcons
                                        name="music-note"
                                        size={100}
                                        color="white"
                                    />
                                </View>
                            </View>
                        )
                    }
                    data={playlist?.tracks?.items || []}
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
                        error ? (
                            <StyledText style={detailScreenStyles.errorText}>
                                {error}
                            </StyledText>
                        ) : playlist?.tracks?.items?.length === 0 ? (
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
