import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    RefreshControl,
} from "react-native";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { useSpotifyLibrary } from "@/features/library/contexts/LibraryContext";
import type { SpotifyArtist } from "@/shared/types/spotify";
import { StyledText, ContentContainer, CustomScrollView, MediaListItem } from "@/shared/components";
import { useRouter } from "expo-router";
import { useSettings } from "@/features/settings";
import { logError } from "@/shared/utils/logger";
import { useNetworkState, usePreventDoubleTap } from "@/shared/hooks";
import { tabScreenStyles as styles } from "@/shared/styles/detailScreen";

export default function ArtistsScreen() {
    const { isLoading } = useAuth();
    const {
        artists,
        fetchArtists,
        isRefreshingArtists,
        fetchMoreArtists,
        isLoadingMoreArtists,
        artistsNextUrl,
        makeApiRequest,
    } = useSpotifyLibrary();
    const router = useRouter();
    const { tabPreferences } = useSettings();
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

    const handleArtistPress = usePreventDoubleTap(
        (item: SpotifyArtist, isDisabled: boolean) => {
            if (isDisabled || loadingArtistId) return;

            setLoadingArtistId(item.id);
            try {
                router.push({
                    pathname: `/artist/${item.id}`,
                    params: { artistName: item.name as string },
                } as any);
            } catch (error) {
                logError("Error navigating to artist:", error);
            } finally {
                setLoadingArtistId(null);
            }
        }
    );

    const renderArtistItem = ({ item }: { item: SpotifyArtist }) => {
        const isDisabled = !isOnline;

        return (
            <MediaListItem
                primaryText={item.name}
                imageUri={item.images && item.images.length > 0 ? item.images[0].url : undefined}
                placeholderIcon="person"
                isLoading={loadingArtistId === item.id}
                disabled={isDisabled}
                onPress={() => handleArtistPress(item, isDisabled)}
                imageStyle={{ borderRadius: 100 }}
            />
        );
    };

    const handlePlayingPress = usePreventDoubleTap(() => {
        router.push("/playing");
    });

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

    if (!sortedArtists || sortedArtists.length === 0) {
        return (
            <ContentContainer
                headerTitle="Artists"
                hideBackButton={true}
                style={{ paddingHorizontal: 20 }}
                headerIcon="multitrack-audio"
                headerIconPress={handlePlayingPress}
                headerIconShowLength={tabPreferences.showPlayingInNavbar ? 0 : 1}
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
            headerIconShowLength={tabPreferences.showPlayingInNavbar ? 0 : 1}
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
