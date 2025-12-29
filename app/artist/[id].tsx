import React, { useEffect, useState } from "react";
import {
    View,
    StyleSheet,
    Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { useSpotifyLibrary } from "@/features/library/contexts/LibraryContext";
import { usePlayback } from "@/features/playback/contexts/PlaybackContext";
import type { SpotifyArtist, SpotifyTrack, SpotifyAlbumSimple } from "@/shared/types/spotify";
import { StyledText, HapticPressable, ContentContainer, CustomScrollView, TrackListItem, ListFooter } from "@/shared/components";
import { log, logError } from "@/shared/utils";
import { usePreventDoubleTap, useSaveStatus } from "@/shared/hooks";
import { detailScreenStyles } from "@/shared/styles/detailScreen";

export default function ArtistDetailScreen() {
    const { id, artistString, artistName } = useLocalSearchParams<{
        id: string;
        artistString?: string;
        artistName?: string;
    }>();

    const { accessToken } = useAuth();
    const { playTracksWithWebApi } = usePlayback();
    const {
        followArtist,
        unfollowArtist,
        fetchArtistTopTracks,
        fetchArtistAlbums,
        fetchMoreArtistAlbums,
        checkIfFollowingArtist,
        makeApiRequest,
    } = useSpotifyLibrary();

    const router = useRouter();
    let initialArtist = null

    if (artistString) {
        const artistData = JSON.parse(artistString);
        if (artistData.images && artistData.images.length > 0) {
            initialArtist = artistData as SpotifyArtist;
        } else {
            initialArtist = null;
        }
    }

    const [artist, setArtist] = useState<SpotifyArtist | null>(initialArtist);
    const [isLoading, setIsLoading] = useState(!initialArtist);
    const [error, setError] = useState<string | null>(null);
    const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
    const [albums, setAlbums] = useState<SpotifyAlbumSimple[] | null>(null);
    const [albumsNextUrl, setAlbumsNextUrl] = useState<string | null>(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const { isSaved: isFollowingArtist, isChecking: isCheckingFollowingArtist, toggle: handleToggleFollowArtist } = useSaveStatus({
        id,
        checkFn: checkIfFollowingArtist,
        saveFn: followArtist,
        removeFn: unfollowArtist,
        accessToken,
    });

    const handleLoadMore = async () => {
        if (!albumsNextUrl || isLoadingMore) return;

        setIsLoadingMore(true);
        try {
            const { albums: newAlbums, nextUrl } = await fetchMoreArtistAlbums(
                albumsNextUrl,
                isLoadingMore
            );
            if (newAlbums) {
                setAlbums((prevAlbums) => [...(prevAlbums || []), ...newAlbums]);
                setAlbumsNextUrl(nextUrl);
            }
        } catch (error) {
            logError("Error fetching more artist albums:", error);
        } finally {
            setIsLoadingMore(false);
        }
    };

    useEffect(() => {
        if (!id) {
            setIsLoading(false);
            setError("Artist ID is missing.");
            return;
        }

        const fetchArtistDetails = async () => {
            if (
                initialArtist
            ) {
                log(
                    "Artist details: Using pre-loaded complete artist data"
                );
                setIsLoading(false);
                return;
            }

            if (!initialArtist) {
                setIsLoading(true);
            }
            setError(null);
            try {
                const data = await makeApiRequest(
                    `https://api.spotify.com/v1/artists/${id}`,
                    "Artist details"
                );
                if (data) {
                    setArtist(data);
                } else {
                    throw new Error("Failed to fetch artist details");
                }
            } catch (e: any) {
                logError("Error fetching artist details:", e);
                setError(e.message || "An unexpected error occurred.");
            } finally {
                setIsLoading(false);
            }
        };

        const fetchTopTracks = async () => {
            if (!id) return;
            setIsLoading(true);
            try {
                const data = await fetchArtistTopTracks(id);
                setTopTracks(data);
            } catch (e: any) {
                logError("Error fetching artist top tracks:", e);
            } finally {
                setIsLoading(false);
            }
        };

        const fetchAlbums = async () => {
            if (!id) return;
            setIsLoading(true);
            try {
                const data = await fetchArtistAlbums(id);
                setAlbums(data.albums);
                setAlbumsNextUrl(data.nextUrl);
            } catch (e: any) {
                logError("Error fetching artist albums:", e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchArtistDetails();
        fetchTopTracks();
        fetchAlbums();
    }, [id, makeApiRequest]);

    const artistAlbums = (albums || []).filter(
        (album) => album.album_type === "album"
    );
    const artistSingles = (albums || []).filter(
        (album) => album.album_type === "single"
    );

    const artistDetailList = [
        { type: "header", title: "Top Songs" },
        ...topTracks
            .slice(0, 10)
            .map((track, idx) => ({
                type: "track",
                data: track,
                index: idx,
            })),
        ...(artistAlbums.length > 0
            ? [
                { type: "header", title: "Albums" },
                ...artistAlbums.map((album, idx) => ({
                    type: "album",
                    data: album,
                    index: idx,
                })),
            ]
            : []),
        ...(artistSingles.length > 0
            ? [
                { type: "header", title: "Singles" },
                ...artistSingles.map((album, idx) => ({
                    type: "album",
                    data: album,
                    index: idx,
                })),
            ]
            : []),
    ];

    const renderSectionHeader = (title: string) => (
        <StyledText style={styles.sectionTitle}>{title}</StyledText>
    );

    const handleTrackPress = usePreventDoubleTap(async (trackIndex: number) => {
        const track = topTracks[trackIndex];
        const artistName = track?.artists?.map((a: SpotifyTrack['artists'][0]) => a.name).join(", ") ?? "";
        const albumArtUrl = track?.album?.images?.[0]?.url ?? "";

        try {
            const trackUris = topTracks.map((t) => t.uri);
            const urisToPlay = trackUris.slice(trackIndex);
            await playTracksWithWebApi(urisToPlay);
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
    });

    const renderTrackItem = ({
        item,
    }: {
        item: { data: SpotifyTrack; index: number };
    }) => {
        const track = item.data;
        const index = item.index;
        return (
            <TrackListItem
                trackNumber={index + 1}
                name={track.name}
                artists={track.artists}
                durationMs={track.duration_ms}
                onPress={() => handleTrackPress(index)}
            />
        );
    };

    const handleAlbumPress = usePreventDoubleTap((albumId: string) => {
        router.push(`/album/${albumId}`);
    });

    if (isLoading && !artist) {
        return (
            <ContentContainer
                headerTitle={`${artistName}`}
                style={{ paddingHorizontal: 20 }}
                headerIcon={isFollowingArtist ? "remove" : "add"}
                headerIconPress={handleToggleFollowArtist}
                headerIconShowLength={isCheckingFollowingArtist ? 0 : 1}
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

    if (!artist) {
        return (
            <View style={detailScreenStyles.centeredMessageContainer}>
                <StyledText style={detailScreenStyles.emptyText}>
                    Artist data is unavailable.
                </StyledText>
            </View>
        );
    }

    const artistImageUrl = artist.images?.[0]?.url;

    const renderAlbumItem = ({
        item,
    }: {
        item: any;
    }) => {
        const album = item.data;
        const hasImage = album.images && album.images.length > 0;
        return (
            <HapticPressable

                style={styles.itemContainer}
                onPress={() => handleAlbumPress(album.id)}
            >
                {hasImage ? (
                    <View style={styles.albumImageContainer}>
                        <Image
                            source={{ uri: album.images[0].url }}
                            style={styles.albumImage}
                        />
                    </View>
                ) : (
                    <View style={styles.placeholderImageContainer}>
                        {/* You can optionally add an icon here */}
                    </View>
                )}
                <View style={styles.textContainer}>
                    <StyledText style={styles.albumName} numberOfLines={1}>
                        {album.name}
                    </StyledText>
                    <StyledText style={styles.albumArtist} numberOfLines={1}>
                        {album.artists.map((artist: any) => artist.name).join(", ")}
                    </StyledText>
                </View>
            </HapticPressable>
        );
    };

    const renderItem = ({ item }: { item: any }) => {
        if (item.type === 'header') {
            return renderSectionHeader(item.title);
        } else if (item.type === 'track') {
            return renderTrackItem({ item });
        } else if (item.type === 'album') {
            return renderAlbumItem({ item });
        }
        return null;
    };

    const keyExtractor = (item: any, index: number) => {
        if (item.type === 'header') return `header-${item.title}-${index}`;
        if (item.type === 'track') return `track-${item.data.id}-${index}`;
        if (item.type === 'album') return `album-${item.data.id}-${index}`;
        return `item-${index}`;
    };

    return (
        <ContentContainer
            headerTitle={artist.name}
            style={{ paddingHorizontal: 20 }}
            headerIcon={isFollowingArtist ? "remove" : "add"}
            headerIconPress={handleToggleFollowArtist}
            headerIconShowLength={isCheckingFollowingArtist ? 0 : 1}
        >
            <View style={{ paddingBottom: 20 }}>
                <CustomScrollView
                    ListHeaderComponent={
                        <>
                            <View style={detailScreenStyles.imageContainer}>
                                <Image
                                    source={{ uri: artistImageUrl }}
                                    style={detailScreenStyles.image}
                                />
                            </View>
                        </>
                    }
                    data={artistDetailList}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    ItemSeparatorComponent={({ leadingItem }) => {
                        if (
                            leadingItem.type === 'album'
                        ) {
                            return <View style={{ height: 8 }} />;
                        }
                        return null;
                    }}
                    contentContainerStyle={detailScreenStyles.listContentContainer}
                    overScrollMode="never"
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={2}
                    ListFooterComponent={<ListFooter isLoading={isLoadingMore} />}
                    ListEmptyComponent={
                        isLoading ? null : (
                            <StyledText style={detailScreenStyles.emptyText}>
                                No tracks or albums found for this artist.
                            </StyledText>
                        )
                    }
                />
            </View>
        </ContentContainer>
    );

}

const styles = StyleSheet.create({
    itemContainer: {
        flexDirection: "row",
        alignItems: "center",
    },
    albumImageContainer: {
        width: 50,
        height: 50,
        marginRight: 15,
        position: "relative",
    },
    albumImage: {
        width: 50,
        height: 50,
    },
    placeholderImageContainer: {
        width: 50,
        height: 50,
        marginRight: 15,
        backgroundColor: "#282828",
        justifyContent: "center",
        alignItems: "center",
    },
    textContainer: {
        flex: 1,
    },
    albumName: {
        fontSize: 22,
        lineHeight: 24,
    },
    albumArtist: {
        fontSize: 16,
        lineHeight: 18,
    },
    sectionTitle: {
        fontSize: 20,
        marginTop: 10,
        marginBottom: 10,
        alignSelf: "flex-start",
    },
});
