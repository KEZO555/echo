import React, { useEffect, useState, useCallback } from "react";
import {
	View,
	StyleSheet,
	Image,
	RefreshControl,
} from "react-native";
import {
	useAuth,
	SpotifySavedAlbum,
	SpotifyArtistSimple,
} from "@/contexts/AuthContext";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import ContentContainer from "@/components/ContentContainer";
import { useTabPreferences } from "@/contexts/TabPreferencesContext";
import CustomScrollView from "@/components/CustomScrollView";
import { logError } from "@/utils/logger";

export default function ArtistsScreen() {
	const {
		isLoading,
		accessToken,
		user,
		makeApiRequest,
	} = useAuth();
	const router = useRouter();
	const { preferences } = useTabPreferences();

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
	albumImageContainer: {
		width: 50,
		height: 50,
		marginRight: 15,
		position: "relative",
	},
	albumImage: {
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
	albumName: {
		fontSize: 22,
		lineHeight: 24,
		color: "white",
	},
	albumArtist: {
		fontSize: 16,
		lineHeight: 18,
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
