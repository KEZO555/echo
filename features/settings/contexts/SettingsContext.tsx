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

export interface TabPreferences {
	showLikedSongs: boolean;
	showArtists: boolean;
	showAlbums: boolean;
	showPodcasts: boolean;
	showPlaylists: boolean;
	showSearch: boolean;
	showPlayingInNavbar: boolean;
}

const defaultTabPreferences: TabPreferences = {
	showLikedSongs: true,
	showArtists: true,
	showAlbums: true,
	showPodcasts: true,
	showPlaylists: true,
	showSearch: true,
	showPlayingInNavbar: false,
};

interface SettingsContextType {
	triggerHaptic: () => void;
	invertColors: boolean;
	setInvertColors: (value: boolean) => void;
	tabPreferences: TabPreferences;
	updateTabPreference: (key: keyof TabPreferences, value: boolean) => Promise<void>;
	isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
	const [invertColors, setInvertColorsState] = useState(false);
	const [tabPreferences, setTabPreferences] = useState<TabPreferences>(defaultTabPreferences);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const loadSettings = async () => {
			try {
				const [invertColorsValue, tabPreferencesValue] = await Promise.all([
					AsyncStorage.getItem(INVERT_COLORS_KEY),
					AsyncStorage.getItem(TAB_PREFERENCES_KEY),
				]);

				if (invertColorsValue !== null) {
					setInvertColorsState(invertColorsValue === "true");
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

	const updateTabPreference = useCallback(
		async (key: keyof TabPreferences, value: boolean) => {
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

	const value: SettingsContextType = {
		triggerHaptic,
		invertColors,
		setInvertColors,
		tabPreferences,
		updateTabPreference,
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
