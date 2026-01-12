import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	useCallback,
	ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { logError } from "@/shared/utils/logger";

const TAB_PREFERENCES_KEY = "tab_preferences";
const INVERT_COLORS_KEY = "invertColors";
const HIDE_ALBUM_COVERS_KEY = "hideAlbumCovers";
const HIDE_DETAIL_COVERS_KEY = "hideDetailCovers";
const HIDE_CREATE_PLAYLIST_KEY = "hideCreatePlaylist";
const HIDE_LIKE_BUTTON_KEY = "hideLikeButton";
const HIDE_DEVICES_BUTTON_KEY = "hideDevicesButton";
const HIDE_ADD_TO_PLAYLIST_BUTTON_KEY = "hideAddToPlaylistButton";
const HIDE_PLAYING_COVER_KEY = "hidePlayingCover";
const HIDE_YOUR_EPISODES_KEY = "hideYourEpisodes";

export type TabId = "index" | "artists" | "albums" | "podcasts" | "playlists" | "search";

export const DEFAULT_TAB_ORDER: TabId[] = ["index", "artists", "albums", "podcasts", "playlists", "search"];

export interface TabPreferences {
	showLikedSongs: boolean;
	showArtists: boolean;
	showAlbums: boolean;
	showPodcasts: boolean;
	showPlaylists: boolean;
	showSearch: boolean;
	tabOrder: TabId[];
}

const defaultTabPreferences: TabPreferences = {
	showLikedSongs: true,
	showArtists: true,
	showAlbums: true,
	showPodcasts: true,
	showPlaylists: true,
	showSearch: true,
	tabOrder: DEFAULT_TAB_ORDER,
};

interface SettingsContextType {
	triggerHaptic: () => void;
	invertColors: boolean;
	setInvertColors: (value: boolean) => void;
	hideAlbumCovers: boolean;
	setHideAlbumCovers: (value: boolean) => void;
	hideDetailCovers: boolean;
	setHideDetailCovers: (value: boolean) => void;
	hideCreatePlaylist: boolean;
	setHideCreatePlaylist: (value: boolean) => void;
	hideLikeButton: boolean;
	setHideLikeButton: (value: boolean) => void;
	hideDevicesButton: boolean;
	setHideDevicesButton: (value: boolean) => void;
	hideAddToPlaylistButton: boolean;
	setHideAddToPlaylistButton: (value: boolean) => void;
	hidePlayingCover: boolean;
	setHidePlayingCover: (value: boolean) => void;
	hideYourEpisodes: boolean;
	setHideYourEpisodes: (value: boolean) => void;
	tabPreferences: TabPreferences;
	updateTabPreference: (key: keyof Omit<TabPreferences, "tabOrder">, value: boolean) => Promise<void>;
	reorderTab: (tabId: TabId, direction: "up" | "down") => Promise<void>;
	isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
	const [invertColors, setInvertColorsState] = useState(false);
	const [hideAlbumCovers, setHideAlbumCoversState] = useState(false);
	const [hideDetailCovers, setHideDetailCoversState] = useState(false);
	const [hideCreatePlaylist, setHideCreatePlaylistState] = useState(false);
	const [hideLikeButton, setHideLikeButtonState] = useState(false);
	const [hideDevicesButton, setHideDevicesButtonState] = useState(false);
	const [hideAddToPlaylistButton, setHideAddToPlaylistButtonState] = useState(false);
	const [hidePlayingCover, setHidePlayingCoverState] = useState(false);
	const [hideYourEpisodes, setHideYourEpisodesState] = useState(false);
	const [tabPreferences, setTabPreferences] = useState<TabPreferences>(defaultTabPreferences);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const loadSettings = async () => {
			try {
				const [
					invertColorsValue,
					hideAlbumCoversValue,
					hideDetailCoversValue,
					hideCreatePlaylistValue,
					hideLikeButtonValue,
					hideDevicesButtonValue,
					hideAddToPlaylistButtonValue,
					hidePlayingCoverValue,
					hideYourEpisodesValue,
					tabPreferencesValue,
				] = await Promise.all([
					AsyncStorage.getItem(INVERT_COLORS_KEY),
					AsyncStorage.getItem(HIDE_ALBUM_COVERS_KEY),
					AsyncStorage.getItem(HIDE_DETAIL_COVERS_KEY),
					AsyncStorage.getItem(HIDE_CREATE_PLAYLIST_KEY),
					AsyncStorage.getItem(HIDE_LIKE_BUTTON_KEY),
					AsyncStorage.getItem(HIDE_DEVICES_BUTTON_KEY),
					AsyncStorage.getItem(HIDE_ADD_TO_PLAYLIST_BUTTON_KEY),
					AsyncStorage.getItem(HIDE_PLAYING_COVER_KEY),
					AsyncStorage.getItem(HIDE_YOUR_EPISODES_KEY),
					AsyncStorage.getItem(TAB_PREFERENCES_KEY),
				]);

				if (invertColorsValue !== null) {
					setInvertColorsState(invertColorsValue === "true");
				}

				if (hideAlbumCoversValue !== null) {
					setHideAlbumCoversState(hideAlbumCoversValue === "true");
				}

				if (hideDetailCoversValue !== null) {
					setHideDetailCoversState(hideDetailCoversValue === "true");
				}

				if (hideCreatePlaylistValue !== null) {
					setHideCreatePlaylistState(hideCreatePlaylistValue === "true");
				}

				if (hideLikeButtonValue !== null) {
					setHideLikeButtonState(hideLikeButtonValue === "true");
				}

				if (hideDevicesButtonValue !== null) {
					setHideDevicesButtonState(hideDevicesButtonValue === "true");
				}

				if (hideAddToPlaylistButtonValue !== null) {
					setHideAddToPlaylistButtonState(hideAddToPlaylistButtonValue === "true");
				}

				if (hidePlayingCoverValue !== null) {
					setHidePlayingCoverState(hidePlayingCoverValue === "true");
				}

				if (hideYourEpisodesValue !== null) {
					setHideYourEpisodesState(hideYourEpisodesValue === "true");
				}

				if (tabPreferencesValue) {
					const parsedPreferences = JSON.parse(tabPreferencesValue);
					setTabPreferences({
						...defaultTabPreferences,
						...parsedPreferences,
					});
				}
			} catch (error) {
				logError("Error loading settings:", error);
			} finally {
				setIsLoading(false);
			}
		};

		loadSettings();
	}, []);

	const triggerHaptic = useCallback(() => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
	}, []);

	const setInvertColors = useCallback(async (value: boolean) => {
		setInvertColorsState(value);
		await AsyncStorage.setItem(INVERT_COLORS_KEY, value.toString());
	}, []);

	const setHideAlbumCovers = useCallback(async (value: boolean) => {
		setHideAlbumCoversState(value);
		await AsyncStorage.setItem(HIDE_ALBUM_COVERS_KEY, value.toString());
	}, []);

	const setHideDetailCovers = useCallback(async (value: boolean) => {
		setHideDetailCoversState(value);
		await AsyncStorage.setItem(HIDE_DETAIL_COVERS_KEY, value.toString());
	}, []);

	const setHideCreatePlaylist = useCallback(async (value: boolean) => {
		setHideCreatePlaylistState(value);
		await AsyncStorage.setItem(HIDE_CREATE_PLAYLIST_KEY, value.toString());
	}, []);

	const setHideLikeButton = useCallback(async (value: boolean) => {
		setHideLikeButtonState(value);
		await AsyncStorage.setItem(HIDE_LIKE_BUTTON_KEY, value.toString());
	}, []);

	const setHideDevicesButton = useCallback(async (value: boolean) => {
		setHideDevicesButtonState(value);
		await AsyncStorage.setItem(HIDE_DEVICES_BUTTON_KEY, value.toString());
	}, []);

	const setHideAddToPlaylistButton = useCallback(async (value: boolean) => {
		setHideAddToPlaylistButtonState(value);
		await AsyncStorage.setItem(HIDE_ADD_TO_PLAYLIST_BUTTON_KEY, value.toString());
	}, []);

	const setHidePlayingCover = useCallback(async (value: boolean) => {
		setHidePlayingCoverState(value);
		await AsyncStorage.setItem(HIDE_PLAYING_COVER_KEY, value.toString());
	}, []);

	const setHideYourEpisodes = useCallback(async (value: boolean) => {
		setHideYourEpisodesState(value);
		await AsyncStorage.setItem(HIDE_YOUR_EPISODES_KEY, value.toString());
	}, []);

	const updateTabPreference = useCallback(
		async (key: keyof Omit<TabPreferences, "tabOrder">, value: boolean) => {
			try {
				const newPreferences = { ...tabPreferences, [key]: value };
				setTabPreferences(newPreferences);
				await AsyncStorage.setItem(TAB_PREFERENCES_KEY, JSON.stringify(newPreferences));
			} catch (error) {
				logError("Error saving tab preferences:", error);
			}
		},
		[tabPreferences]
	);

	const reorderTab = useCallback(
		async (tabId: TabId, direction: "up" | "down") => {
			try {
				const currentOrder = [...tabPreferences.tabOrder];
				const currentIndex = currentOrder.indexOf(tabId);
				
				if (currentIndex === -1) return;
				if (direction === "up" && currentIndex === 0) return;
				if (direction === "down" && currentIndex === currentOrder.length - 1) return;

				const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
				currentOrder.splice(currentIndex, 1);
				currentOrder.splice(newIndex, 0, tabId);

				const newPreferences = { ...tabPreferences, tabOrder: currentOrder };
				setTabPreferences(newPreferences);
				await AsyncStorage.setItem(TAB_PREFERENCES_KEY, JSON.stringify(newPreferences));
			} catch (error) {
				logError("Error reordering tabs:", error);
			}
		},
		[tabPreferences]
	);

	const value: SettingsContextType = {
		triggerHaptic,
		invertColors,
		setInvertColors,
		hideAlbumCovers,
		setHideAlbumCovers,
		hideDetailCovers,
		setHideDetailCovers,
		hideCreatePlaylist,
		setHideCreatePlaylist,
		hideLikeButton,
		setHideLikeButton,
		hideDevicesButton,
		setHideDevicesButton,
		hideAddToPlaylistButton,
		setHideAddToPlaylistButton,
		hidePlayingCover,
		setHidePlayingCover,
		hideYourEpisodes,
		setHideYourEpisodes,
		tabPreferences,
		updateTabPreference,
		reorderTab,
		isLoading,
	};

	return (
		<SettingsContext.Provider value={value}>
			{children}
		</SettingsContext.Provider>
	);
};

export const useSettings = () => {
	const context = useContext(SettingsContext);
	if (context === undefined) {
		throw new Error("useSettings must be used within a SettingsProvider");
	}
	return context;
};
