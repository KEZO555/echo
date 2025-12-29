import React, { useState, useEffect } from "react";
import {
    View,
    StyleSheet,
    Image,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StyledText } from "@/shared/components/StyledText";
import { HapticPressable } from "@/shared/components/HapticPressable";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { useSpotifyLibrary } from "@/features/library/contexts/LibraryContext";
import type { SpotifyPlaylist } from "@/shared/types/spotify";
import { MaterialIcons } from "@expo/vector-icons";
import ContentContainer from "@/shared/components/ContentContainer";
import { useInvertColors } from "@/features/settings/contexts/InvertColorsContext";
import CustomScrollView from "@/shared/components/CustomScrollView";
import { log, logError } from "@/shared/utils/logger";
import { usePreventDoubleTap } from "@/shared/hooks/usePreventDoubleTap";

export default function AddToPlaylistScreen() {
    const { isLoading, accessToken, user } = useAuth();
    const { playlists, fetchPlaylists, addTrackToPlaylist } = useSpotifyLibrary();
    const params = useLocalSearchParams<{
        trackUri?: string;
    }>();
    const { trackUri } = params;
    log("AddToPlaylistScreen received params:", params);
    const [selectedPlaylists, setSelectedPlaylists] = useState<string[]>([]);
    const [sortedPlaylists, setSortedPlaylists] = useState<
        SpotifyPlaylist[] | null
    >(null);

    React.useEffect(() => {
        if (accessToken && user && !playlists && !isLoading) {
            fetchPlaylists();
        }
    }, [accessToken, user, playlists, fetchPlaylists, isLoading]);

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
        }
    }, [playlists]);

    const togglePlaylistSelection = (playlistId: string) => {
        setSelectedPlaylists((prevSelected) =>
            prevSelected.includes(playlistId)
                ? prevSelected.filter((id) => id !== playlistId)
                : [...prevSelected, playlistId]
        );
    };

    const { invertColors } = useInvertColors();

    const handleDone = async () => {
        const trackUri = params.trackUri;
        if (!trackUri) {
            logError("Add to playlist: No trackUri provided in params.");
            return;
        }
        if (selectedPlaylists.length === 0) {
            return;
        }

        log(
            `Attempting to add track ${trackUri} to playlists: ${selectedPlaylists.join(
                ", "
            )}`
        );
        let successCount = 0;
        let failureCount = 0;

        for (const playlistId of selectedPlaylists) {
            try {
                const success = await addTrackToPlaylist(playlistId, trackUri);
                if (success) {
                    log(
                        `Successfully added track to playlist ${playlistId}`
                    );
                    successCount++;
                } else {
                    console.warn(
                        `Failed to add track to playlist ${playlistId}`
                    );
                    failureCount++;
                }
            } catch (error) {
                logError(
                    `Error adding track to playlist ${playlistId}:`,
                    error
                );
                failureCount++;
            }
        }

        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace("/playing");
        }
    };

    const handleDonePress = usePreventDoubleTap(handleDone);

    const handleCreatePlaylistPress = usePreventDoubleTap(() => {
        router.push({
            pathname: "/create-playlist",
            params: {
                returnTo: "add-to-playlist",
                trackUri,
            },
        } as any);
    });

    const renderPlaylistItem = ({ item }: { item: SpotifyPlaylist }) => {
        const isSelected = selectedPlaylists.includes(item.id);
        return (
            <HapticPressable
                style={styles.itemContainer}
                onPress={() => togglePlaylistSelection(item.id)}
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
                <View style={{ marginRight: 15 }}>
                    <MaterialIcons
                        name={
                            isSelected
                                ? "radio-button-checked"
                                : "radio-button-unchecked"
                        }
                        size={24}
                        color={invertColors ? "black" : "white"}
                    />
                </View>
            </HapticPressable>
        );
    };

    if (isLoading && !sortedPlaylists) {
        return (
            <ContentContainer headerTitle="Add to playlist" style={{ paddingHorizontal: 20, gap: 0 }}>
                <View style={styles.centeredMessageContainer}></View>
            </ContentContainer>
        );
    }

    if (!sortedPlaylists || sortedPlaylists.length === 0) {
        return (
            <ContentContainer headerTitle="Add to playlist" style={{ paddingHorizontal: 20, gap: 0 }}>
                <View style={styles.centeredMessageContainer}>
                    <StyledText style={styles.emptyText}>
                        No playlists found.
                    </StyledText>
                </View>
            </ContentContainer>
        );
    }

    return (
        <ContentContainer headerTitle="Add to playlist" style={{ paddingHorizontal: 20, gap: 0 }}>
            <CustomScrollView
                data={sortedPlaylists}
                renderItem={renderPlaylistItem}
                keyExtractor={(item) => item.id}
                style={styles.list}
                contentContainerStyle={styles.listContentContainer}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                overScrollMode="never"
                ListHeaderComponent={() => (
                    <HapticPressable
                        style={styles.newPlaylistItemContainer}
                        onPress={handleCreatePlaylistPress}
                    >
                        <View style={styles.placeholderImageContainer}>
                            <MaterialIcons name="add" size={24} color="white" />
                        </View>
                        <View style={styles.textContainer}>
                            <StyledText style={styles.playlistName}>
                                Create new playlist
                            </StyledText>
                        </View>
                    </HapticPressable>
                )}
            />

            <View style={{ width: "100%", justifyContent: "flex-end", alignItems: "center" }}>
                <HapticPressable style={styles.doneButton} onPress={handleDonePress}>
                    <StyledText style={styles.doneButtonText}>Done</StyledText>
                </HapticPressable>
            </View>
        </ContentContainer>
    );
}

const styles = StyleSheet.create({
    doneButton: {
        paddingVertical: 15,
        alignItems: "center",
        justifyContent: "center",
        minWidth: 200,
    },
    doneButtonText: {
        fontSize: 40,
        textTransform: "uppercase",
    },
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
        justifyContent: "center",
        alignItems: "center",
    },
    emptyText: {
        fontSize: 18,
        textAlign: "center",
    },
    itemContainer: {
        paddingVertical: 0,
        flexDirection: "row",
        alignItems: "center",
    },
    newPlaylistItemContainer: {
        paddingBottom: 8,
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
        marginRight: 15,
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
