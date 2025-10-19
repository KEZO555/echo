import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    StyleSheet,
    Image,
    RefreshControl,
} from "react-native";
import { useAuth, SpotifyPlaylist } from "@/contexts/AuthContext";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import ContentContainer from "@/components/ContentContainer";
import { useTabPreferences } from "@/contexts/TabPreferencesContext";
import CustomScrollView from "@/components/CustomScrollView";
import { logError, log } from "@/utils/logger";
import { saveCachedPlaylistDetail, refreshPlaylistsFromCache, isPlaylistCached } from "@/utils/cache";
import { useNetworkState } from "@/hooks/useNetworkState";

const CREATE_NEW_PLAYLIST_ID = "CREATE_NEW_PLAYLIST_ID";

export default function PlaylistsScreen() {
    const {
        playlists,
        isLoading,
        accessToken,
        fetchPlaylists,
        user,
        isRefreshingPlaylists,
        fetchMorePlaylists,
        isLoadingMorePlaylists,
        playlistsNextUrl,
        makeApiRequest,
    } = useAuth();
    const router = useRouter();
    const { preferences } = useTabPreferences();
    const { isOnline } = useNetworkState();
    const [sortedPlaylists, setSortedPlaylists] = useState<
        SpotifyPlaylist[] | null
    >(null);
    const [loadingPlaylistId, setLoadingPlaylistId] = useState<string | null>(
        null
    );
    const [cachedPlaylistIds, setCachedPlaylistIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (
            accessToken &&
            user &&
            !playlists &&
            !isLoading &&
            !isRefreshingPlaylists
        ) {
            fetchPlaylists();
        }
    }, [accessToken, user, playlists, fetchPlaylists, isLoading, isRefreshingPlaylists]);

    useEffect(() => {
        if (playlists) {
            const newSortedPlaylists = [...playlists].sort((a, b) => {
                const ownerA =
                    a.owner.display_name?.toLowerCase() ||
                    a.owner.id.toLowerCase() ||
                    "";
                const ownerB =
                    b.owner.display_name?.toLowerCase() ||
                    b.owner.id.toLowerCase() ||
                    "";
                if (ownerA < ownerB) return -1;
                if (ownerA > ownerB) return 1;
                // If owners are the same, sort by playlist name
                const nameA = a.name.toLowerCase();
                const nameB = b.name.toLowerCase();
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                return 0;
            });
            setSortedPlaylists(newSortedPlaylists);
            
            // Check which playlists are cached
            const checkCachedPlaylists = async () => {
                const cachedIds = new Set<string>();
                for (const playlist of newSortedPlaylists) {
                    const isCached = await isPlaylistCached(playlist.id);
                    if (isCached) {
                        cachedIds.add(playlist.id);
                    }
                }
                setCachedPlaylistIds(cachedIds);
            };
            checkCachedPlaylists();
        }
    }, [playlists]);

    const handleRefresh = useCallback(async () => {
        if (isRefreshingPlaylists) return;

        if (!isOnline) {
            log("Playlists: Device is offline, loading cached playlists");
            try {
                const cachedPlaylists = await refreshPlaylistsFromCache();
                if (cachedPlaylists && cachedPlaylists.length > 0) {
                    const newSortedPlaylists = [...cachedPlaylists].sort((a, b) => {
                        const ownerA =
                            a.owner.display_name?.toLowerCase() ||
                            a.owner.id.toLowerCase() ||
                            "";
                        const ownerB =
                            b.owner.display_name?.toLowerCase() ||
                            b.owner.id.toLowerCase() ||
                            "";
                        if (ownerA < ownerB) return -1;
                        if (ownerA > ownerB) return 1;
                        // If owners are the same, sort by playlist name
                        const nameA = a.name.toLowerCase();
                        const nameB = b.name.toLowerCase();
                        if (nameA < nameB) return -1;
                        if (nameA > nameB) return 1;
                        return 0;
                    });
                    setSortedPlaylists(newSortedPlaylists);
                    log(`Playlists: Loaded ${cachedPlaylists.length} cached playlists`);
                } else {
                    log("Playlists: No cached playlists found");
                }
            } catch (error) {
                logError("Playlists: Error loading cached playlists:", error);
            }
        } else {
            fetchPlaylists();
        }
    }, [fetchPlaylists, isRefreshingPlaylists, isOnline]);

    const renderPlaylistItem = ({ item }: { item: SpotifyPlaylist }) => {
        if (item.id === CREATE_NEW_PLAYLIST_ID) {
            const isDisabled = !isOnline;

            return (
                <HapticPressable
                    style={[styles.itemContainer, isDisabled && styles.disabledContainer]}
                    onPress={() => {
                        if (isDisabled) return;
                        router.push("/create-playlist");
                    }}
                    disabled={isDisabled}
                >
                    <View style={styles.placeholderImageContainer}>
                        <MaterialIcons
                            name="add"
                            size={24}
                            color={isDisabled ? "#666" : "white"}
                        />
                    </View>
                    <View style={styles.textContainer}>
                        <StyledText
                            style={styles.playlistName}
                            numberOfLines={1}
                        >
                            {item.name}
                        </StyledText>
                    </View>
                </HapticPressable>
            );
        }

        const isOffline = !isOnline;
        const isUncached = isOffline && !cachedPlaylistIds.has(item.id);

        return (
            <HapticPressable
                style={[styles.itemContainer, isUncached && styles.disabledContainer]}
                onPress={async () => {
                    if (loadingPlaylistId || isUncached) return;

                    setLoadingPlaylistId(item.id);

                    try {
                        if (isOnline) {
                            const playlistDetails = await makeApiRequest(
                                `https://api.spotify.com/v1/playlists/${item.id}`,
                                "Playlist details for caching"
                            );

                            if (playlistDetails) {
                                await saveCachedPlaylistDetail(playlistDetails);
                                setCachedPlaylistIds(prev => new Set(prev).add(item.id));

                                router.push({
                                    pathname: `/playlist/${item.id}`,
                                    params: {
                                        playlistName: item.name as string,
                                        playlistString: JSON.stringify(playlistDetails),
                                    },
                                } as any);
                            } else {
                                router.push({
                                    pathname: `/playlist/${item.id}`,
                                    params: {
                                        playlistName: item.name as string,
                                    },
                                } as any);
                            }
                        } else {
                            router.push({
                                pathname: `/playlist/${item.id}`,
                                params: {
                                    playlistName: item.name as string,
                                },
                            } as any);
                        }
                    } catch (error) {
                        logError("Error navigating to playlist:", error);
                        router.push({
                            pathname: `/playlist/${item.id}`,
                            params: {
                                playlistName: item.name as string,
                            },
                        } as any);
                    } finally {
                        setLoadingPlaylistId(null);
                    }
                }}
                disabled={isUncached}
            >
                {item.images && item.images.length > 0 ? (
                    <View style={styles.playlistImageContainer}>
                        <Image
                            source={{ uri: item.images[0].url }}
                            style={styles.playlistImage}
                        />
                        {loadingPlaylistId === item.id && (
                            <View style={styles.loadingOverlay}></View>
                        )}
                    </View>
                ) : (
                    <View style={styles.placeholderImageContainer}>
                        <MaterialIcons
                            name="music-note"
                            size={24}
                            color={isUncached ? "#666" : "white"}
                        />
                        {loadingPlaylistId === item.id && (
                            <View style={styles.loadingOverlay}></View>
                        )}
                    </View>
                )}
                <View style={styles.textContainer}>
                    <StyledText style={styles.playlistName} numberOfLines={1}>
                        {item.name}
                    </StyledText>
                    <StyledText style={styles.playlistOwner} numberOfLines={1}>
                        {item.owner.display_name || item.owner.id}
                    </StyledText>
                </View>
            </HapticPressable>
        );
    };

    // Show global loading indicator if initial data is loading and no playlists are yet available
    if (isLoading && !sortedPlaylists) {
        return <View style={styles.centeredMessageContainer}></View>;
    }

    // Show specific refresh indicator if only manual refresh is happening
    // This is a bit redundant if the TabHeader also shows an indicator, but can be a fallback
    // or primary if header doesn't have space/icon for it.
    // For now, let's assume the header icon is the primary indicator and this is for safety.
    if (isRefreshingPlaylists && !sortedPlaylists) {
        // Or perhaps (isRefreshingPlaylists && playlists) if we want to show stale data UNDER the spinner
        return <View style={styles.centeredMessageContainer}></View>;
    }

    const createNewPlaylistItem: SpotifyPlaylist = {
        id: CREATE_NEW_PLAYLIST_ID,
        name: "Create new playlist",
        images: [], // No image for this item
        owner: { display_name: "", id: "" }, // No owner
        description: "", // Default value
        tracks: { href: "", total: 0 }, // Default value
        public: false, // Default value
        collaborative: false, // Default value
        uri: "", // Default value
        href: "", // Default value
    };

    const displayPlaylists = sortedPlaylists
        ? [createNewPlaylistItem, ...sortedPlaylists]
        : [createNewPlaylistItem];

    const handleLoadMore = () => {
        if (isOnline && playlistsNextUrl && !isLoadingMorePlaylists) {
            fetchMorePlaylists();
        }
    };

    const renderFooter = () => {
        if (!isLoadingMorePlaylists) return null;
        return <View style={{ paddingVertical: 20 }}></View>;
    };

    const handlePlayingPress = () => {
        router.push("/playing");
    };

    if (!sortedPlaylists || sortedPlaylists.length === 0) {
        return (
            <ContentContainer
                headerTitle="Playlists"
                hideBackButton={true}
                style={{ paddingHorizontal: 20 }}
                headerIcon="multitrack-audio"
                headerIconPress={handlePlayingPress}
                headerIconShowLength={preferences.showPlayingInNavbar ? 0 : 1}
            >
                <CustomScrollView
                    data={[createNewPlaylistItem]}
                    renderItem={renderPlaylistItem}
                    keyExtractor={(item) => item.id}
                    style={styles.list}
                    contentContainerStyle={styles.listContentContainer}
                    ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                    overScrollMode={"never"}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshingPlaylists}
                            onRefresh={handleRefresh}
                            colors={["white"]}
                            progressBackgroundColor={"black"}
                            size={"large" as any}
                        />
                    }
                />
            </ContentContainer>
        );
    }

    return (
        <ContentContainer
            headerTitle="Playlists"
            hideBackButton={true}
            style={{ paddingHorizontal: 20 }}
            headerIcon="multitrack-audio"
            headerIconPress={handlePlayingPress}
            headerIconShowLength={preferences.showPlayingInNavbar ? 0 : 1}
        >
            <CustomScrollView
                data={displayPlaylists}
                renderItem={renderPlaylistItem}
                keyExtractor={(item) => item.id}
                style={styles.list}
                contentContainerStyle={styles.listContentContainer}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                overScrollMode={"never"}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={2}
                ListFooterComponent={renderFooter}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshingPlaylists}
                        onRefresh={handleRefresh}
                        colors={["white"]}
                        progressBackgroundColor={"black"}
                        size={"large" as any}
                    />
                }
            />
        </ContentContainer>
    );
}

const styles = StyleSheet.create({
    list: {
        flex: 1,
        width: "100%",
    },
    listContentContainer: {
        paddingTop: 0,
        paddingBottom: 0,
    },
    centeredMessageContainer: {
        flex: 1,
        backgroundColor: "black",
        justifyContent: "center",
        alignItems: "center",
    },
    emptyText: {
        fontSize: 22,
        textAlign: "center",
        marginBottom: 10,
    },
    emptySubText: {
        fontSize: 14,
        textAlign: "center",
    },
    itemContainer: {
        paddingVertical: 0,
        flexDirection: "row",
        alignItems: "center",
    },
    playlistImage: {
        width: 50,
        height: 50,
        marginRight: 15,
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
        gap: 0,
    },
    playlistName: {
        fontSize: 22,
        lineHeight: 24,
    },
    playlistOwner: {
        fontSize: 16,
        lineHeight: 18,
    },
    playlistImageContainer: {
        position: "relative",
    },
    loadingOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0)",
        justifyContent: "center",
        alignItems: "center",
    },
    disabledContainer: {
        opacity: 0.3,
    },
});
