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

export default function ArtistsScreen() {
	const {
		artists,
		isLoading,
		accessToken,
		fetchArtists,
		user,
		isRefreshingArtists,
		fetchMoreArtists,
		isLoadingMoreArtists,
		artistsNextUrl,
		makeApiRequest,
	} = useAuth();
	const router = useRouter();
	const { preferences } = useTabPreferences();
	const [sortedArtists, setSortedArtists] = useState<
		SpotifyArtist[] | null
	>(null);
	const [loadingArtistId, setLoadingArtistId] = useState<string | null>(null);


	useEffect(() => {
		if (
			accessToken &&
			user &&
			!artists &&
			!isLoading &&
			!isRefreshingArtists
		) {
			fetchArtists();
		}
	}, [accessToken, user, artists, isLoading, isRefreshingArtists]);

	useEffect(() => {
		if (artists) {
			const newSortedArtists = [...artists].sort((a, b) => {
				const artistA = a.name.toLowerCase() || "";
				const artistB = b.name.toLowerCase() || "";
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

	const renderArtistItem = ({ item }: { item: SpotifyArtist }) => (
		<HapticPressable
			style={styles.itemContainer}
			onPress={async () => {
				if (loadingArtistId) return;

				setLoadingArtistId(item.id);
				try {
					const artistData = await makeApiRequest(
						`https://api.spotify.com/v1/artists/${item.id}`,
						"Artist details for navigation"
					);

					if (artistData) {
						router.push({
							pathname: `/artist/${item.id}`,
							params: { artistString: JSON.stringify(artistData) },
						} as any);
					} else {
						router.push({
							pathname: `/artist/${item.id}`,
							params: { artistString: JSON.stringify(item) },
						} as any);
					}
				} catch (error) {
					logError(
						"Error fetching artist details for navigation:",
						error
					);
					router.push({
						pathname: `/artist/${item.id}`,
						params: { artistString: JSON.stringify(item) },
					} as any);
				} finally {
					setLoadingArtistId(null);
				}
			}}
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
					<MaterialIcons name="person" size={24} color="white" />
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

	if (isLoading && !sortedArtists) {
		return <View style={styles.centeredMessageContainer}></View>;
	}

	if (isRefreshingArtists && !sortedArtists) {
		return <View style={styles.centeredMessageContainer}></View>;
	}

	if (!sortedArtists || sortedArtists.length === 0) {
		return (
			<View style={styles.centeredMessageContainer}>
				<StyledText style={styles.emptyText}>
					No saved artists found.
				</StyledText>
				<StyledText style={styles.emptySubText}>
					Try saving some artists in Spotify or pull down to refresh.
				</StyledText>
			</View>
		);
	}

	const handleLoadMore = () => {
		if (artistsNextUrl && !isLoadingMoreArtists) {
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

	return (
        <ContentContainer 
            headerTitle="Artists" 
            hideBackButton={true} 
            style={{paddingHorizontal: 20}}
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
                onEndReachedThreshold={6}
                ListFooterComponent={renderFooter}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshingArtists}
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
		color: "white",
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
		color: "white",
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
});
