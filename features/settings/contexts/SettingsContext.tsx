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
	tabPreferences: TabPreferences;
	updateTabPreference: (key: keyof Omit<TabPreferences, "tabOrder">, value: boolean) => Promise<void>;
	reorderTab: (tabId: TabId, direction: "up" | "down") => Promise<void>;
	isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
	const [invertColors, setInvertColorsState] = useState(false);
	const [hideAlbumCovers, setHideAlbumCoversState] = useState(false);
	const [tabPreferences, setTabPreferences] = useState<TabPreferences>(defaultTabPreferences);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const loadSettings = async () => {
			try {
				const [invertColorsValue, hideAlbumCoversValue, tabPreferencesValue] = await Promise.all([
					AsyncStorage.getItem(INVERT_COLORS_KEY),
					AsyncStorage.getItem(HIDE_ALBUM_COVERS_KEY),
					AsyncStorage.getItem(TAB_PREFERENCES_KEY),
				]);

				if (invertColorsValue !== null) {
					setInvertColorsState(invertColorsValue === "true");
				}

				if (hideAlbumCoversValue !== null) {
					setHideAlbumCoversState(hideAlbumCoversValue === "true");
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
