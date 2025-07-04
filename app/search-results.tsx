import React, { useEffect, useState } from "react";
import { View, StyleSheet, Text, Image } from "react-native";
import { useGlobalSearchParams, useRouter } from "expo-router";
import {
	useAuth,
	SpotifyTrack,
	SpotifyPlaylistSimple,
	SpotifyAlbumSimple,
	SpotifyArtistSimple,
	SpotifyImage,
} from "@/contexts/AuthContext";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import ContentContainer from "@/components/ContentContainer";
import CustomScrollView from "@/components/CustomScrollView";

type SearchItem =
	| { type: "track"; data: SpotifyTrack }
	| { type: "playlist"; data: SpotifyPlaylistSimple }
	| { type: "album"; data: SpotifyAlbumSimple };

export default function SearchResultsScreen() {
	const params = useGlobalSearchParams();
	const routeQuery = params.query as string | undefined;
	const { searchItems, playTrack } = useAuth();
	const router = useRouter();
	const [results, setResults] = useState<SearchItem[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (routeQuery) {
			setLoading(true);
			searchItems(routeQuery, ["track", "album", "playlist"])
				.then((apiResponse) => {
					const newResults: SearchItem[] = [];
					if (apiResponse?.tracks?.items) {
						apiResponse.tracks.items.forEach((track) => {
							if (track && track.id) {
								newResults.push({ type: "track", data: track });
							} else if (track) {
								console.warn(
									"Search result track is missing an id or is invalid:",
									track
								);
							}
						});
					}
					if (apiResponse?.albums?.items) {
						apiResponse.albums.items.forEach((album) => {
							if (album && album.id) {
								newResults.push({ type: "album", data: album });
							} else if (album) {
								console.warn(
									"Search result album is missing an id or is invalid:",
									album
								);
							}
						});
					}
					if (apiResponse?.playlists?.items) {
						apiResponse.playlists.items.forEach((playlist) => {
							if (playlist && playlist.id) {
								newResults.push({
									type: "playlist",
									data: playlist,
								});
							} else if (playlist) {
								console.warn(
									"Search result playlist is missing an id or is invalid:",
									playlist
								);
							}
						});
					}

					// Reorder to bring the first album to the top
					const firstAlbumIndex = newResults.findIndex(
						(item) => item.type === "album"
					);
					if (firstAlbumIndex > -1) {
						const [firstAlbum] = newResults.splice(
							firstAlbumIndex,
							1
						);
						newResults.unshift(firstAlbum);
					}

					setResults(newResults);
				})
				.catch((error) => console.error("Search error:", error))
				.finally(() => setLoading(false));
		} else {
			setResults([]);
			setLoading(false);
		}
	}, [routeQuery, searchItems]);

	const getArtistNames = (artists: SpotifyArtistSimple[]) => {
		return (
			artists?.map((artist) => artist.name).join(", ") || "Unknown Artist"
		);
	};

	const renderItem = ({ item }: { item: SearchItem }) => {
		let title = "";
		let subtitle = "";
		let images: SpotifyImage[] | undefined = [];
		let itemUri = "";
		let contextUri: string | undefined = undefined;

		switch (item.type) {
			case "track":
				title = item.data.name;
				subtitle = `Song • ${getArtistNames(item.data.artists)}`;
				images = item.data.album?.images;
				itemUri = item.data.uri;
				break;
			case "album":
				title = item.data.name;
				subtitle = `Album • ${getArtistNames(item.data.artists)}`;
				images = item.data.images;
				itemUri = item.data.uri;
				break;
			case "playlist":
				title = item.data.name;
				subtitle = `Playlist • ${
					item.data.owner?.display_name || "Playlist"
				}`;
				images = item.data.images;
				itemUri = item.data.uri;
				break;
		}

		return (
			<HapticPressable
				style={styles.itemContainer}
				onPress={async () => {
					if (item.type === "track") {
						try {
							await playTrack(itemUri, undefined, contextUri);
							router.push("/playing");
						} catch (error) {
							console.error("Error playing track:", error);
							// Still navigate to playing screen even if playback fails
							router.push("/playing");
						}
					} else if (item.type === "album") {
						router.push(`/album/${item.data.id}`);
					} else if (item.type === "playlist") {
						router.push(`/playlist/${item.data.id}`);
					}
				}}
			>
				{images && images.length > 0 ? (
					<Image
						source={{ uri: images[0].url }}
						style={styles.itemImage}
					/>
				) : (
					<View style={styles.placeholderImageContainer}>
						<StyledText style={{ fontSize: 24 }}>
							?
						</StyledText>
					</View>
				)}
				<View style={styles.textContainer}>
					<StyledText style={styles.itemName} numberOfLines={1}>
						{title}
					</StyledText>
					<StyledText style={styles.itemSubtitle} numberOfLines={1}>
						{subtitle}
					</StyledText>
				</View>
			</HapticPressable>
		);
	};

	return (
		<ContentContainer headerTitle={`Results for ${routeQuery ?? ""}`} style={{ paddingHorizontal: 20 }}>
			{loading ? (
				<View style={styles.centeredMessageContainer}></View>
			) : results.length > 0 ? (
                <View style={{ paddingBottom: 20 }}>
                    <CustomScrollView
                        data={results}
                        renderItem={renderItem}
                        keyExtractor={(item, index) =>
                            `${item.type}-${item.data.id}-${index}`
                        }
                        style={styles.list}
                        contentContainerStyle={styles.listContentContainer}
                        ItemSeparatorComponent={() => (
                            <View style={{ height: 8 }} />
                        )}
                        overScrollMode={"never"}
                    />
                </View>
			) : routeQuery ? (
				<View style={styles.centeredMessageContainer}>
					<Text style={styles.emptyText}>
						No results found for "{routeQuery}".
					</Text>
				</View>
			) : (
				<View style={styles.centeredMessageContainer}></View>
			)}
		</ContentContainer>
	);
}

const styles = StyleSheet.create({
	centeredMessageContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 20,
        width: "100%",
	},
	emptyText: {
		color: "white",
		fontSize: 18,
		textAlign: "center",
	},
	list: {
		flex: 1,
        width: "100%",
	},
	listContentContainer: {
		paddingTop: 0,
	},
	itemContainer: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 0,
	},
	itemImage: {
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
	itemName: {
		color: "white",
		fontSize: 22,
		lineHeight: 24,
		fontFamily: "PublicSans-Regular",
	},
	itemSubtitle: {
		fontSize: 16,
		lineHeight: 18,
		fontFamily: "PublicSans-Regular",
	},
});
