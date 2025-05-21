import React, { useEffect } from "react";
import {
    View,
    StyleSheet,
    Text,
    FlatList,
    Image,
    ActivityIndicator,
} from "react-native";
import { useAuth, SpotifyPlaylist } from "@/contexts/AuthContext"; // Assuming SpotifyPlaylist is exported from AuthContext
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

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
    } = useAuth();
    const router = useRouter(); // Added useRouter instance

    useEffect(() => {
        // Fetch playlists when the component mounts if not already loaded and user is logged in
        // This uses the _fetchInitialPlaylistsAndUpdateGlobalLoading via the initial auth flow,
        // so we don't need to call a separate fetch here unless playlists are explicitly null
        // and we have a user and token (e.g. app was backgrounded and state lost, but auth persists).
        if (accessToken && user && !playlists && !isLoading) {
            fetchPlaylists(); // This will now use the manual refresh logic, which is fine.
        }
    }, [accessToken, user, playlists, fetchPlaylists, isLoading]);

    const renderPlaylistItem = ({ item }: { item: SpotifyPlaylist }) => {
        if (item.id === CREATE_NEW_PLAYLIST_ID) {
            return (
                <HapticPressable
                    style={styles.itemContainer}
                    onPress={() => {
                        router.push("/create-playlist"); // Navigate to create-playlist screen
                    }}
                >
                    <View style={styles.placeholderImageContainer}>
                        <MaterialIcons name="add" size={24} color="white" />
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

        return (
            <HapticPressable
                style={styles.itemContainer}
                onPress={() =>
                    router.push({
                        pathname: `/playlist/${item.id}`,
                        params: { playlistString: JSON.stringify(item) }, // Pass playlist data as a string
                    } as any)
                }
            >
                {item.images && item.images.length > 0 ? (
                    <Image
                        source={{ uri: item.images[0].url }}
                        style={styles.playlistImage}
                    />
                ) : (
                    <View style={styles.placeholderImageContainer}>
                        <MaterialIcons
                            name="music-note"
                            size={24}
                            color="white"
                        />
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
    if (isLoading && !playlists) {
        return <View style={styles.centeredMessageContainer}></View>;
    }

    // Show specific refresh indicator if only manual refresh is happening
    // This is a bit redundant if the TabHeader also shows an indicator, but can be a fallback
    // or primary if header doesn't have space/icon for it.
    // For now, let's assume the header icon is the primary indicator and this is for safety.
    if (isRefreshingPlaylists && !playlists) {
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

    const displayPlaylists = playlists
        ? [createNewPlaylistItem, ...playlists]
        : [createNewPlaylistItem];

    if (!playlists || playlists.length === 0) {
        // Still show "Create new playlist" even if other playlists are empty
        return (
            <FlatList
                data={[createNewPlaylistItem]}
                renderItem={renderPlaylistItem}
                keyExtractor={(item) => item.id}
                style={styles.list}
                contentContainerStyle={styles.listContentContainer}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                overScrollMode={"never"}
            />
        );
    }

    const handleLoadMore = () => {
        if (playlistsNextUrl && !isLoadingMorePlaylists) {
            fetchMorePlaylists();
        }
    };

    const renderFooter = () => {
        if (!isLoadingMorePlaylists) return null;
        return <View style={{ paddingVertical: 20 }}></View>;
    };

    return (
        <FlatList
            data={displayPlaylists}
            renderItem={renderPlaylistItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContentContainer}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            overScrollMode={"never"}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={6}
            ListFooterComponent={renderFooter}
        />
    );
}

const styles = StyleSheet.create({
    list: {
        flex: 1,
        backgroundColor: "black",
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
        paddingHorizontal: 20,
    },
    emptyText: {
        fontSize: 22,
        textAlign: "center",
        marginBottom: 10,
        color: "white",
    },
    emptySubText: {
        fontSize: 14,
        textAlign: "center",
    },
    itemContainer: {
        paddingVertical: 0,
        paddingHorizontal: 20,
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
});
