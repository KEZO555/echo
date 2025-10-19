import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    StyleSheet,
    Image,
    RefreshControl,
} from "react-native";
import {
    useAuth,
    SpotifyArtist,
} from "@/contexts/AuthContext";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import ContentContainer from "@/components/ContentContainer";
import { useTabPreferences } from "@/contexts/TabPreferencesContext";
import CustomScrollView from "@/components/CustomScrollView";
import { log, logError } from "@/utils/logger";
import { useNetworkState } from "@/hooks/useNetworkState";

export default function ArtistsScreen() {
    const {
        artists,
        isLoading,
        fetchArtists,
        isRefreshingArtists,
        fetchMoreArtists,
        isLoadingMoreArtists,
        artistsNextUrl,
        makeApiRequest,
    } = useAuth();
    const router = useRouter();
    const { preferences } = useTabPreferences();
    const { isOnline } = useNetworkState();
    const [sortedArtists, setSortedArtists] = useState<
        SpotifyArtist[] | null
    >(null);
    const [loadingArtistId, setLoadingArtistId] = useState<string | null>(null);

    useEffect(() => {
        if (artists) {
            const newSortedArtists = [...artists]
                .filter((artist) => artist.id && artist.name)
                .sort((a, b) => {
                    const artistA = (a.name || "").toLowerCase();
                    const artistB = (b.name || "").toLowerCase();
                    if (artistA < artistB) return -1;
                    if (artistA > artistB) return 1;
                    return 0;
                });
            setSortedArtists(newSortedArtists);
        }
    }, [artists]);

    const handleRefresh = useCallback(() => {
        if (!isRefreshingArtists) {
            fetchArtists();
        }
    }, [fetchArtists, isRefreshingArtists]);

    const renderArtistItem = ({ item }: { item: SpotifyArtist }) => {
        const isDisabled = !isOnline;
        
        return (
            <HapticPressable
                style={[styles.itemContainer, isDisabled && styles.disabledContainer]}
                onPress={async () => {
                    if (isDisabled || loadingArtistId) return;

                    setLoadingArtistId(item.id);
                    router.push({
                        pathname: `/artist/${item.id}`,
                        params: { artistName: item.name as string },
                    } as any);
                    setLoadingArtistId(null);
                }}
                disabled={isDisabled}
            >
                {item.images && item.images.length > 0 ? (
                    <View style={styles.artistImageContainer}>
                        <Image
                            source={{ uri: item.images[0].url }}
                            style={styles.artistImage}
                        />
                        {loadingArtistId === item.id && (
                            <View style={styles.loadingOverlay}></View>
                        )}
                    </View>
                ) : (
                    <View style={styles.placeholderImageContainer}>
                        <MaterialIcons 
                            name="person" 
                            size={24} 
                            color={isDisabled ? "#666" : "white"} 
                        />
                        {loadingArtistId === item.id && (
                            <View style={styles.loadingOverlay}></View>
                        )}
                    </View>
                )}
                <View style={styles.textContainer}>
                    <StyledText style={styles.artistName} numberOfLines={1}>
                        {item.name}
                    </StyledText>
                </View>
            </HapticPressable>
        );
    };

    if (isLoading && !sortedArtists) {
        return <View style={styles.centeredMessageContainer}></View>;
    }

    if (isRefreshingArtists && !sortedArtists) {
        return <View style={styles.centeredMessageContainer}></View>;
    }

    const handleLoadMore = () => {
        if (isOnline && artistsNextUrl && !isLoadingMoreArtists) {
            fetchMoreArtists();
        }
    };

    const renderFooter = () => {
        if (!isLoadingMoreArtists) return null;
        return;
    };

    const handlePlayingPress = () => {
        router.push("/playing");
    };

    if (!sortedArtists || sortedArtists.length === 0) {
        return (
            <ContentContainer
                headerTitle="Artists"
                hideBackButton={true}
                style={{ paddingHorizontal: 20 }}
                headerIcon="multitrack-audio"
                headerIconPress={handlePlayingPress}
                headerIconShowLength={preferences.showPlayingInNavbar ? 0 : 1}
            >
                <CustomScrollView
                    data={[]}
                    renderItem={null}
                    overScrollMode={"never"}
                    ListHeaderComponent={
                        <StyledText style={styles.emptyText}>
                            No saved artists found.
                        </StyledText>
                    }
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshingArtists}
                                onRefresh={handleRefresh}
                                colors={["white"]}
                                progressBackgroundColor={"black"}
                                size={"large" as any}
                                enabled={isOnline === true}
                            />
                        }                />
            </ContentContainer>
        );
    }

    return (
        <ContentContainer
            headerTitle="Artists"
            hideBackButton={true}
            style={{ paddingHorizontal: 20 }}
            headerIcon="multitrack-audio"
            headerIconPress={handlePlayingPress}
            headerIconShowLength={preferences.showPlayingInNavbar ? 0 : 1}
        >
            <CustomScrollView
                data={sortedArtists}
                renderItem={renderArtistItem}
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
                        refreshing={isRefreshingArtists}
                        onRefresh={handleRefresh}
                        colors={["white"]}
                        progressBackgroundColor={"black"}
                        size={"large" as any}
                        enabled={isOnline === true}
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
        marginTop: 20,
        textAlign: "center",
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
    artistImageContainer: {
        width: 50,
        height: 50,
        marginRight: 15,
        position: "relative",
    },
    artistImage: {
        width: 50,
        height: 50,
        borderRadius: 100,
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
    artistName: {
        fontSize: 22,
        lineHeight: 24,
    },
    loadingOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0)",
        justifyContent: "center",
        alignItems: "center",
    },
    disabledContainer: {
        opacity: 0.3,
    },
});
