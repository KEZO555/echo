import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    View,
    StyleSheet,
    Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { useSpotifyLibrary } from "@/features/library/contexts/LibraryContext";
import { usePlayback } from "@/features/playback/contexts/PlaybackContext";
import type { SpotifyShow, SpotifyEpisode } from "@/shared/types/spotify";
import { StyledText, HapticPressable, ContentContainer, CustomScrollView, ListFooter } from "@/shared/components";
import { log, logError, formatDuration } from "@/shared/utils";
import {
    getCachedShowDetail,
    saveCachedShowDetail,
} from "@/features/library/utils/cache";
import { usePreventDoubleTap, useSaveStatus } from "@/shared/hooks";
import { MaterialIcons } from "@expo/vector-icons";
import { detailScreenStyles } from "@/shared/styles/detailScreen";

export default function PodcastDetailScreen() {
    const { id, showString, showName } = useLocalSearchParams<{
        id: string;
        showString?: string;
        showName?: string;
    }>();

    const { accessToken } = useAuth();
    const { playTrackWithContext } = usePlayback();
    const {
        followPodcast,
        unfollowPodcast,
        checkIfFollowingPodcast,
        makeApiRequest,
    } = useSpotifyLibrary();
    const router = useRouter();

    const initialShow = showString
        ? (JSON.parse(showString) as SpotifyShow)
        : null;

    const [show, setShow] = useState<SpotifyShow | null>(initialShow);
    const [isLoading, setIsLoading] = useState(!initialShow);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingMoreEpisodes, setIsLoadingMoreEpisodes] = useState(false);

    const { isSaved: isShowFollowed, isChecking: isCheckingFollowed, toggle: handleToggleFollowShow } = useSaveStatus({
        id,
        checkFn: checkIfFollowingPodcast,
        saveFn: followPodcast,
        removeFn: unfollowPodcast,
        accessToken,
    });

    useEffect(() => {
        if (!id) {
            setIsLoading(false);
            setError("Podcast ID is missing.");
            return;
        }

        const fetchShowDetails = async () => {
            if (
                initialShow &&
                initialShow.episodes &&
                initialShow.episodes.items
            ) {
                setShow(initialShow);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);

            try {
                const cachedShow = await getCachedShowDetail(id);
                if (cachedShow && cachedShow.episodes && cachedShow.episodes.items) {
                    log("Podcast details: Using cached show data");
                    setShow(cachedShow);
                    setIsLoading(false);
                    return;
                }
            } catch (error) {
                logError("Error retrieving cached show:", error);
            }

            setError(null);
            try {
                const data = await makeApiRequest(
                    `https://api.spotify.com/v1/shows/${id}?market=from_token&limit=10`,
                    "Podcast details"
                );
                if (data) {
                    await saveCachedShowDetail(data);
                    setShow(data);
                } else {
                    throw new Error("Failed to fetch podcast details");
                }
            } catch (e: any) {
                logError("Error fetching podcast details:", e);
                setError(e.message || "An unexpected error occurred.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchShowDetails();
    }, [id, makeApiRequest]);

    const loadMoreEpisodes = useCallback(async () => {
        if (!show?.episodes?.next || isLoadingMoreEpisodes) {
            return;
        }
        setIsLoadingMoreEpisodes(true);
        try {
            const data = await makeApiRequest(
                show.episodes.next,
                "More podcast episodes"
            );
            if (data) {
                setShow((prevShow: SpotifyShow | null) => {
                    if (!prevShow || !prevShow.episodes) return prevShow;
                    const updatedShow = {
                        ...prevShow,
                        episodes: {
                            ...prevShow.episodes,
                            items: [...prevShow.episodes.items, ...data.items],
                            next: data.next,
                        },
                    } as SpotifyShow;
                    saveCachedShowDetail(updatedShow);
                    return updatedShow;
                });
            }
        } catch (e: any) {
            logError("Error fetching more podcast episodes:", e);
        } finally {
            setIsLoadingMoreEpisodes(false);
        }
    }, [show, isLoadingMoreEpisodes, makeApiRequest]);

    const episodeItems = useMemo(
        () =>
            (show?.episodes?.items || []).filter(
                (episode: unknown): episode is SpotifyEpisode =>
                    !!episode && typeof episode === "object" && !!(episode as SpotifyEpisode).id
            ),
        [show?.episodes?.items]
    );

    const handleEpisodePress = usePreventDoubleTap(
        async (episode: SpotifyEpisode, index: number) => {
            const albumArtUrl = episode.images?.[0]?.url ?? show?.images?.[0]?.url ?? "";

            try {
                await playTrackWithContext(
                    episode.uri,
                    {
                        type: "podcast",
                        uri: `spotify:show:${id}`,
                        currentIndex: index,
                    }
                );
                router.push({
                    pathname: "/playing",
                    params: {
                        trackName: episode.name ?? "",
                        artistName: show?.name ?? "",
                        albumArtUrl,
                        durationMs: episode.duration_ms?.toString() ?? "0",
                    },
                });
            } catch (error) {
                logError("Error playing episode:", error);
                router.push({
                    pathname: "/playing",
                    params: {
                        trackName: episode.name ?? "",
                        artistName: show?.name ?? "",
                        albumArtUrl,
                        durationMs: episode.duration_ms?.toString() ?? "0",
                    },
                });
            }
        }
    );

    if (isLoading && !show) {
        return (
            <ContentContainer
                headerTitle={`${showName}`}
                style={{ paddingHorizontal: 20 }}
                headerIcon={isShowFollowed ? "remove" : "add"}
                headerIconPress={handleToggleFollowShow}
                headerIconShowLength={isCheckingFollowed ? 0 : 1}
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

    if (!show) {
        return (
            <View style={detailScreenStyles.centeredMessageContainer}>
                <StyledText style={detailScreenStyles.emptyText}>
                    Podcast data is unavailable.
                </StyledText>
            </View>
        );
    }

    const showImageUrl = show.images?.[0]?.url;

    const renderEpisodeItem = ({
        item: episode,
        index,
    }: {
        item: SpotifyEpisode;
        index: number;
    }) => (
        <HapticPressable
            style={styles.episodeItemContainer}
            onPress={() => handleEpisodePress(episode, index)}
        >
            <View style={styles.episodeInfoContainer}>
                <View style={styles.titleRow}>
                    {episode.resume_point?.fully_played && (
                        <MaterialIcons
                            name="check-circle"
                            size={16}
                            color="#1DB954"
                            style={{ marginTop: 6 }}
                        />
                    )}
                    <StyledText style={styles.episodeName} numberOfLines={1}>
                        {episode.name}
                    </StyledText>
                </View>
                {(() => {
                    const resumePoint = episode.resume_point;
                    const remainingMs =
                        resumePoint && !resumePoint.fully_played
                            ? Math.max(
                                  episode.duration_ms -
                                      (resumePoint.resume_position_ms ?? 0),
                                  0
                              )
                            : 0;
                    const progressLabel = resumePoint
                        ? resumePoint.fully_played
                            ? "Played"
                            : resumePoint.resume_position_ms > 0
                              ? `${formatDuration(remainingMs, true)} left`
                              : null
                        : null;
                    return (
                        <StyledText style={styles.episodeMeta} numberOfLines={1}>
                            {new Date(episode.release_date).toLocaleDateString()} ·{" "}
                            {formatDuration(episode.duration_ms, true)}
                            {progressLabel ? ` · ${progressLabel}` : ""}
                        </StyledText>
                    );
                })()}
            </View>
        </HapticPressable>
    );

    return (
        <ContentContainer
            headerTitle={show.name}
            style={{ paddingHorizontal: 20 }}
            headerIcon={isShowFollowed ? "remove" : "add"}
            headerIconPress={handleToggleFollowShow}
            headerIconShowLength={isCheckingFollowed ? 0 : 1}
        >
            <View style={{ paddingBottom: 20 }}>
                <CustomScrollView
                    ListHeaderComponent={
                        <>
                            <View style={detailScreenStyles.imageContainer}>
                                {showImageUrl ? (
                                    <Image
                                        source={{ uri: showImageUrl }}
                                        style={detailScreenStyles.image}
                                    />
                                ) : (
                                    <View style={detailScreenStyles.placeholderImageContainer}>
                                        <StyledText style={styles.placeholderText}>
                                            {show.name.charAt(0)}
                                        </StyledText>
                                    </View>
                                )}
                            </View>
                        </>
                    }
                    data={episodeItems}
                    renderItem={renderEpisodeItem}
                    keyExtractor={(item, index) => item?.id || index.toString()}
                    contentContainerStyle={detailScreenStyles.listContentContainer}
                    overScrollMode="never"
                    onEndReached={loadMoreEpisodes}
                    onEndReachedThreshold={2}
                    ListFooterComponent={<ListFooter isLoading={isLoadingMoreEpisodes} />}
                    ListEmptyComponent={
                        isLoading
                            ? null
                            : episodeItems.length === 0 ? (
                            <StyledText style={detailScreenStyles.emptyText}>
                                No episodes found for this podcast.
                            </StyledText>
                        )
                            : null
                    }
                />
            </View>
        </ContentContainer>
    );
}

const styles = StyleSheet.create({
    placeholderText: {
        fontSize: 64,
    },
    episodeItemContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        width: "100%",
    },
    episodeName: {
        flex: 1,
        fontSize: 26,
    },
    episodeMeta: {
        fontSize: 16,
        lineHeight: 18,
        paddingBottom: 6,
    },
    episodeInfoContainer: {
        flex: 1,
        alignItems: "flex-start",
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 4,
    },
});
