import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    StyleSheet,
    Image,
    ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    useAuth,
    SpotifyShow,
    SpotifyEpisode,
} from "@/contexts/AuthContext";
import { StyledText } from "@/components/StyledText";
import { HapticPressable } from "@/components/HapticPressable";
import ContentContainer from "@/components/ContentContainer";
import CustomScrollView from "@/components/CustomScrollView";
import { log, logError } from "@/utils/logger";
import {
    getCachedShowDetail,
    saveCachedShowDetail,
} from "@/utils/cache";

export default function PodcastDetailScreen() {
    const { id, showString, showName } = useLocalSearchParams<{
        id: string;
        showString?: string;
        showName?: string;
    }>();

    const {
        accessToken,
        playTrackWithContext,
        followPodcast,
        unfollowPodcast,
        checkIfFollowingPodcast,
        makeApiRequest,
    } = useAuth();
    const router = useRouter();

    const initialShow = showString
        ? (JSON.parse(showString) as SpotifyShow)
        : null;

    const [show, setShow] = useState<SpotifyShow | null>(initialShow);
    const [isLoading, setIsLoading] = useState(!initialShow);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingMoreEpisodes, setIsLoadingMoreEpisodes] = useState(false);
    const [isShowFollowed, setIsShowFollowed] = useState(false);
    const [isCheckingFollowed, setIsCheckingFollowed] = useState(false);

    const formatDuration = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    };

    const checkShowFollowedStatus = useCallback(async () => {
        if (!id) return;

        setIsCheckingFollowed(true);
        try {
            const isFollowed = await checkIfFollowingPodcast(id);
            setIsShowFollowed(isFollowed);
        } catch (error) {
            logError("Error checking if podcast is followed:", error);
            setIsShowFollowed(false);
        } finally {
            setIsCheckingFollowed(false);
        }
    }, [id, checkIfFollowingPodcast]);

    const handleToggleFollowShow = useCallback(async () => {
        if (!id) return;

        try {
            if (isShowFollowed) {
                const success = await unfollowPodcast(id);
                if (success) {
                    setIsShowFollowed(false);
                }
            } else {
                const success = await followPodcast(id);
                if (success) {
                    setIsShowFollowed(true);
                }
            }
        } catch (error) {
            logError("Error toggling podcast follow status:", error);
        }
    }, [id, isShowFollowed, followPodcast, unfollowPodcast]);

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
                    `https://api.spotify.com/v1/shows/${id}?market=from_token`,
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

    useEffect(() => {
        if (id && accessToken) {
            checkShowFollowedStatus();
        }
    }, [id, accessToken, checkShowFollowedStatus]);

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
                setShow((prevShow) => {
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
            <View style={styles.centeredMessageContainer}>
                <StyledText style={styles.errorText}>Error: {error}</StyledText>
            </View>
        );
    }

    if (!show) {
        return (
            <View style={styles.centeredMessageContainer}>
                <StyledText style={styles.emptyText}>
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
            key={episode.id || index.toString()}
            style={styles.episodeItemContainer}
            onPress={async () => {
                try {
                    await playTrackWithContext(
                        episode.uri,
                        {
                            type: "podcast",
                            uri: `spotify:show:${id}`,
                            currentIndex: index,
                        }
                    );
                    router.push("/playing");
                } catch (error) {
                    logError("Error playing episode:", error);
                    router.push("/playing");
                }
            }}
        >
            <StyledText style={styles.episodeName} numberOfLines={2}>
                {episode.name}
            </StyledText>
            <StyledText style={styles.episodeMeta} numberOfLines={1}>
                {new Date(episode.release_date).toLocaleDateString()} · {formatDuration(episode.duration_ms)}
            </StyledText>
        </HapticPressable>
    );

    const renderFooter = () => {
        if (!isLoadingMoreEpisodes) return null;
        return (
            <ActivityIndicator
                style={{ marginVertical: 20 }}
                size="large"
                color="white"
            />
        );
    };

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
                            <View style={styles.showArtContainer}>
                                {showImageUrl ? (
                                    <Image
                                        source={{ uri: showImageUrl }}
                                        style={styles.showImage}
                                    />
                                ) : (
                                    <View style={styles.placeholderImageContainer}>
                                        <StyledText style={styles.placeholderText}>
                                            {show.name.charAt(0)}
                                        </StyledText>
                                    </View>
                                )}
                                <StyledText style={styles.publisher} numberOfLines={1}>
                                    {show.publisher}
                                </StyledText>
                                <StyledText style={styles.showDescription} numberOfLines={3}>
                                    {show.description}
                                </StyledText>
                            </View>
                        </>
                    }
                    data={show.episodes?.items || []}
                    renderItem={renderEpisodeItem}
                    keyExtractor={(item, index) => item.id || index.toString()}
                    contentContainerStyle={styles.listContentContainer}
                    overScrollMode="never"
                    onEndReached={loadMoreEpisodes}
                    onEndReachedThreshold={6}
                    ListFooterComponent={renderFooter}
                    ListEmptyComponent={
                        isLoading ? null : show.episodes?.items?.length === 0 ? (
                            <StyledText style={styles.emptyText}>
                                No episodes found for this podcast.
                            </StyledText>
                        ) : null
                    }
                />
            </View>
        </ContentContainer>
    );
}

const styles = StyleSheet.create({
    showArtContainer: {
        alignItems: "center",
        paddingBottom: 20,
    },
    showImage: {
        width: 200,
        height: 200,
        marginBottom: 10,
    },
    placeholderImageContainer: {
        width: 200,
        height: 200,
        marginBottom: 10,
        backgroundColor: "#282828",
        justifyContent: "center",
        alignItems: "center",
    },
    placeholderText: {
        fontSize: 64,
    },
    publisher: {
        fontSize: 18,
        marginBottom: 8,
    },
    showDescription: {
        fontSize: 14,
        textAlign: "center",
        marginHorizontal: 10,
    },
    centeredMessageContainer: {
        flex: 1,
        backgroundColor: "black",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    errorText: {
        fontSize: 16,
        textAlign: "center",
    },
    emptyText: {
        fontSize: 16,
        textAlign: "center",
        marginTop: 20,
    },
    episodeItemContainer: {
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#333",
    },
    episodeName: {
        fontSize: 20,
    },
    episodeMeta: {
        fontSize: 14,
        color: "#9A9A9A",
        marginTop: 2,
    },
    listContentContainer: {
        paddingBottom: 0,
    },
});
