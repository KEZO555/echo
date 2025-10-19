import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    StyleSheet,
    Image,
    RefreshControl,
} from "react-native";
import {
    useAuth,
    SpotifySavedShow,
} from "@/contexts/AuthContext";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import ContentContainer from "@/components/ContentContainer";
import { useTabPreferences } from "@/contexts/TabPreferencesContext";
import CustomScrollView from "@/components/CustomScrollView";
import { log, logError } from "@/utils/logger";
import {
    saveCachedShowDetail,
    refreshFollowedPodcastsFromCache,
    isShowCached,
} from "@/utils/cache";
import { useNetworkState } from "@/hooks/useNetworkState";

export default function PodcastsScreen() {
    const {
        podcasts,
        isLoading,
        accessToken,
        fetchPodcasts,
        user,
        isRefreshingPodcasts,
        fetchMorePodcasts,
        isLoadingMorePodcasts,
        podcastsNextUrl,
        makeApiRequest,
    } = useAuth();
    const router = useRouter();
    const { preferences } = useTabPreferences();
    const { isOnline } = useNetworkState();
    const [sortedPodcasts, setSortedPodcasts] = useState<
        SpotifySavedShow[] | null
    >(null);
    const [loadingShowId, setLoadingShowId] = useState<string | null>(null);
    const [cachedShowIds, setCachedShowIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (
            accessToken &&
            user &&
            !podcasts &&
            !isLoading &&
            !isRefreshingPodcasts
        ) {
            fetchPodcasts();
        }
    }, [accessToken, user, podcasts, isLoading, isRefreshingPodcasts]);

    useEffect(() => {
        if (podcasts) {
            const newSortedPodcasts = [...podcasts].sort((a, b) => {
                const showA = a.show.name.toLowerCase();
                const showB = b.show.name.toLowerCase();
                if (showA < showB) return -1;
                if (showA > showB) return 1;
                return 0;
            });
            setSortedPodcasts(newSortedPodcasts);

            const checkCachedShows = async () => {
                const cachedIds = new Set<string>();
                for (const show of newSortedPodcasts) {
                    const cached = await isShowCached(show.show.id);
                    if (cached) {
                        cachedIds.add(show.show.id);
                    }
                }
                setCachedShowIds(cachedIds);
            };
            checkCachedShows();
        }
    }, [podcasts]);

    const handleRefresh = useCallback(async () => {
        if (isRefreshingPodcasts) return;

        if (!isOnline) {
            log("Podcasts: Device is offline, loading cached shows");
            try {
                const cachedShows = await refreshFollowedPodcastsFromCache();
                if (cachedShows && cachedShows.length > 0) {
                    const newSortedPodcasts = [...cachedShows].sort((a, b) => {
                        const showA = a.show.name.toLowerCase();
                        const showB = b.show.name.toLowerCase();
                        if (showA < showB) return -1;
                        if (showA > showB) return 1;
                        return 0;
                    });
                    setSortedPodcasts(newSortedPodcasts);
                    log(
                        `Podcasts: Loaded ${cachedShows.length} cached followed podcasts`
                    );
                } else {
                    log("Podcasts: No cached podcasts found");
                }
            } catch (error) {
                logError("Podcasts: Error loading cached podcasts:", error);
            }
        } else {
            fetchPodcasts();
        }
    }, [fetchPodcasts, isRefreshingPodcasts, isOnline]);

    const renderShowItem = ({ item }: { item: SpotifySavedShow }) => {
        const isOffline = !isOnline;
        const isUncached = isOffline && !cachedShowIds.has(item.show.id);

        return (
            <HapticPressable
                style={[styles.itemContainer, isUncached && styles.disabledContainer]}
                onPress={async () => {
                    if (loadingShowId || isUncached) return;

                    setLoadingShowId(item.show.id);

                    try {
                        if (isOnline) {
                            const showDetails = await makeApiRequest(
                                `https://api.spotify.com/v1/shows/${item.show.id}`,
                                "Show details for caching"
                            );

                            if (showDetails) {
                                await saveCachedShowDetail(showDetails);
                                setCachedShowIds((prev) =>
                                    new Set(prev).add(item.show.id)
                                );

                                router.push({
                                    pathname: `podcast/${item.show.id}`,
                                    params: {
                                        showName: item.show.name as string,
                                        showString: JSON.stringify(showDetails),
                                    },
                                } as any);
                            } else {
                                router.push({
                                    pathname: `podcast/${item.show.id}`,
                                    params: {
                                        showName: item.show.name as string,
                                    },
                                } as any);
                            }
                        } else {
                            router.push({
                                pathname: `podcast/${item.show.id}`,
                                params: {
                                    showName: item.show.name as string,
                                },
                            } as any);
                        }
                    } catch (error) {
                        logError("Error navigating to podcast:", error);
                        router.push({
                            pathname: `podcast/${item.show.id}`,
                            params: {
                                showName: item.show.name as string,
                            },
                        } as any);
                    } finally {
                        setLoadingShowId(null);
                    }
                }}
                disabled={isUncached}
            >
                {item.show.images && item.show.images.length > 0 ? (
                    <View style={styles.showImageContainer}>
                        <Image
                            source={{ uri: item.show.images[0].url }}
                            style={styles.showImage}
                        />
                        {loadingShowId === item.show.id && (
                            <View style={styles.loadingOverlay}></View>
                        )}
                    </View>
                ) : (
                    <View style={styles.placeholderImageContainer}>
                        <MaterialIcons
                            name="mic"
                            size={24}
                            color={isUncached ? "#666" : "white"}
                        />
                        {loadingShowId === item.show.id && (
                            <View style={styles.loadingOverlay}></View>
                        )}
                    </View>
                )}
                <View style={styles.textContainer}>
                    <StyledText style={styles.showName} numberOfLines={1}>
                        {item.show.name}
                    </StyledText>
                    <StyledText style={styles.showPublisher} numberOfLines={1}>
                        {item.show.publisher}
                    </StyledText>
                    <StyledText style={styles.episodeCount} numberOfLines={1}>
                        {item.show.total_episodes} episodes
                    </StyledText>
                </View>
            </HapticPressable>
        );
    };

    const renderFooter = () => {
        if (!isLoadingMorePodcasts) return null;
        return (
            <View style={styles.loadingMoreContainer}>
                <StyledText>Loading more podcasts...</StyledText>
            </View>
        );
    };

    const handlePlayingPress = () => {
        router.push("/playing");
    };

    if (!sortedPodcasts || sortedPodcasts.length === 0) {
        return (
            <ContentContainer
                headerTitle="Podcasts"
                hideBackButton={true}
                style={{ paddingHorizontal: 20 }}
                headerIcon={preferences.showPlayingInNavbar ? undefined : "multitrack-audio"}
                headerIconPress={handlePlayingPress}
                headerIconShowLength={preferences.showPlayingInNavbar ? 0 : 1}
            >
                <CustomScrollView
                    data={[]}
                    renderItem={null}
                    overScrollMode="never"
                    ListHeaderComponent={
                        <StyledText style={styles.emptyText}>
                            No followed podcasts yet.
                        </StyledText>
                    }
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshingPodcasts}
                            onRefresh={handleRefresh}
                            tintColor="white"
                        />
                    }
                />
            </ContentContainer>
        );
    }

    return (
        <ContentContainer
            headerTitle="Podcasts"
            hideBackButton={true}
            headerIcon={preferences.showPlayingInNavbar ? undefined : "multitrack-audio"}
            headerIconPress={handlePlayingPress}
            headerIconShowLength={preferences.showPlayingInNavbar ? 0 : 1}
        >
            <CustomScrollView
                contentContainerStyle={styles.listContentContainer}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshingPodcasts}
                        onRefresh={handleRefresh}
                        tintColor="white"
                    />
                }
                data={sortedPodcasts || []}
                renderItem={renderShowItem}
                keyExtractor={(item, index) => item.show.id || index.toString()}
                overScrollMode="never"
                onEndReached={() => {
                    if (podcastsNextUrl && !isLoadingMorePodcasts) {
                        fetchMorePodcasts();
                    }
                }}
                onEndReachedThreshold={0.6}
                ListFooterComponent={renderFooter}
                ListEmptyComponent={
                    isLoading || isRefreshingPodcasts ? null : (
                        <StyledText style={styles.emptyText}>
                            No followed podcasts yet.
                        </StyledText>
                    )
                }
            />
        </ContentContainer>
    );
}

const styles = StyleSheet.create({
    listContentContainer: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    itemContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
    },
    disabledContainer: {
        opacity: 0.4,
    },
    showImageContainer: {
        width: 80,
        height: 80,
        marginRight: 16,
        position: "relative",
    },
    showImage: {
        width: "100%",
        height: "100%",
    },
    placeholderImageContainer: {
        width: 80,
        height: 80,
        backgroundColor: "#282828",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 16,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.4)",
    },
    textContainer: {
        flex: 1,
    },
    showName: {
        fontSize: 20,
    },
    showPublisher: {
        fontSize: 14,
        color: "#9A9A9A",
        marginTop: 2,
    },
    episodeCount: {
        fontSize: 12,
        color: "#9A9A9A",
        marginTop: 2,
    },
    loadingMoreContainer: {
        alignItems: "center",
        paddingVertical: 20,
    },
    emptyText: {
        fontSize: 16,
        textAlign: "center",
        marginTop: 40,
    },
});
