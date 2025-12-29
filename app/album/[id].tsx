import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { useSpotifyLibrary } from "@/features/library/contexts/LibraryContext";
import { usePlayback } from "@/features/playback/contexts/PlaybackContext";
import type { SpotifyAlbum, SpotifyTrackSimple } from "@/shared/types/spotify";
import { StyledText, ContentContainer, CustomScrollView, TrackListItem, ListFooter } from "@/shared/components";
import { log, logError } from "@/shared/utils";
import { getCachedAlbumDetail } from "@/features/library/utils/cache";
import { usePreventDoubleTap, useSaveStatus } from "@/shared/hooks";
import { detailScreenStyles } from "@/shared/styles/detailScreen";

export default function AlbumDetailScreen() {
    const { id, albumString, albumName } = useLocalSearchParams<{
        id: string;
        albumString?: string;
        albumName?: string;
    }>();

    const { accessToken } = useAuth();
    const { skipToIndex } = usePlayback();
    const {
        saveAlbum,
        removeAlbum,
        checkIfAlbumIsSaved,
        makeApiRequest,
    } = useSpotifyLibrary();
    const router = useRouter();

    const initialAlbum = albumString
        ? (JSON.parse(albumString) as SpotifyAlbum)
        : null;

    const [album, setAlbum] = useState<SpotifyAlbum | null>(initialAlbum);
    const [isLoading, setIsLoading] = useState(!initialAlbum);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingMoreTracks, setIsLoadingMoreTracks] = useState(false);

    const { isSaved: isAlbumSaved, isChecking: isCheckingAlbumSaved, toggle: handleToggleAlbumSave } = useSaveStatus({
        id,
        checkFn: checkIfAlbumIsSaved,
        saveFn: saveAlbum,
        removeFn: removeAlbum,
        accessToken,
    });

    useEffect(() => {
        if (!id) {
            setIsLoading(false);
            setError("Album ID is missing.");
            return;
        }

        const fetchAlbumDetails = async () => {
            if (
                initialAlbum &&
                initialAlbum.tracks &&
                initialAlbum.tracks.items
            ) {
                log(
                    "Album details: Using pre-loaded complete album data"
                );
                setIsLoading(false);
                return;
            }

            setIsLoading(true);

            try {
                const cachedAlbum = await getCachedAlbumDetail(id);
                if (cachedAlbum && cachedAlbum.tracks && cachedAlbum.tracks.items) {
                    log("Album details: Using cached album data");
                    setAlbum(cachedAlbum);
                    setIsLoading(false);
                    return;
                }
            } catch (error) {
                logError("Error retrieving cached album:", error);
            }

            setError(null);
            try {
                const data = await makeApiRequest(
                    `https://api.spotify.com/v1/albums/${id}`,
                    "Album details"
                );
                if (data) {
                    setAlbum(data);
                } else {
                    throw new Error("Failed to fetch album details");
                }
            } catch (e: any) {
                logError("Error fetching album details:", e);
                setError(e.message || "An unexpected error occurred.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchAlbumDetails();
    }, [id, makeApiRequest]);

    const loadMoreTracks = useCallback(async () => {
        if (!album?.tracks?.next || isLoadingMoreTracks) {
            return;
        }
        setIsLoadingMoreTracks(true);
        try {
            const data = await makeApiRequest(
                album.tracks.next,
                "More album tracks"
            );
            if (data) {
                setAlbum((prevAlbum: SpotifyAlbum | null) => {
                    if (!prevAlbum || !prevAlbum.tracks) return prevAlbum;
                    return {
                        ...prevAlbum,
                        tracks: {
                            ...prevAlbum.tracks,
                            items: [...prevAlbum.tracks.items, ...data.items],
                            next: data.next,
                        },
                    };
                });
            }
        } catch (e: any) {
            logError("Error fetching more album tracks:", e);
        } finally {
            setIsLoadingMoreTracks(false);
        }
    }, [album, isLoadingMoreTracks, makeApiRequest]);

    const handleTrackPress = usePreventDoubleTap(
        async (trackIndex: number) => {
            const track = album?.tracks?.items[trackIndex];
            const artistName = track?.artists?.map((a: SpotifyTrackSimple['artists'][0]) => a.name).join(", ") ?? "";
            const albumArtUrl = album?.images?.[0]?.url ?? "";

            try {
                await skipToIndex({
                    type: "album",
                    uri: `spotify:album:${id}`,
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

    if (isLoading && !album) {
        return (
            <ContentContainer
                headerTitle={`${albumName}`}
                style={{ paddingHorizontal: 20 }}
                headerIcon={isAlbumSaved ? "remove" : "add"}
                headerIconPress={handleToggleAlbumSave}
                headerIconShowLength={isCheckingAlbumSaved ? 0 : 1}
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

    if (!album) {
        return (
            <View style={detailScreenStyles.centeredMessageContainer}>
                <StyledText style={detailScreenStyles.emptyText}>
                    Album data is unavailable.
                </StyledText>
            </View>
        );
    }

    const albumImageUrl = album.images?.[0]?.url;

    const renderTrackItem = ({
        item: track,
        index,
    }: {
        item: SpotifyTrackSimple;
        index: number;
    }) => (
        <TrackListItem
            key={track.id || index.toString()}
            trackNumber={track.track_number}
            name={track.name}
            artists={track.artists}
            durationMs={track.duration_ms}
            onPress={() => handleTrackPress(index)}
        />
    );

    return (
        <ContentContainer
            headerTitle={album.name}
            style={{ paddingHorizontal: 20 }}
            headerIcon={isAlbumSaved ? "remove" : "add"}
            headerIconPress={handleToggleAlbumSave}
            headerIconShowLength={isCheckingAlbumSaved ? 0 : 1}
        >
            <View style={{ paddingBottom: 20 }}>
                <CustomScrollView
                    ListHeaderComponent={
                        <>
                            <View style={detailScreenStyles.imageContainer}>
                                <Image
                                    source={{ uri: albumImageUrl }}
                                    style={detailScreenStyles.image}
                                />
                            </View>
                        </>
                    }
                    data={album.tracks?.items || []}
                    renderItem={renderTrackItem}
                    keyExtractor={(item, index) => item.id || index.toString()}
                    contentContainerStyle={detailScreenStyles.listContentContainer}
                    overScrollMode="never"
                    onEndReached={loadMoreTracks}
                    onEndReachedThreshold={2}
                    ListFooterComponent={<ListFooter isLoading={isLoadingMoreTracks} />}
                    ListEmptyComponent={
                        isLoading ? null : album.tracks?.items?.length === 0 ? (
                            <StyledText style={detailScreenStyles.emptyText}>
                                No tracks found in this album.
                            </StyledText>
                        ) : null
                    }
                />
            </View>
        </ContentContainer>
    );
}
