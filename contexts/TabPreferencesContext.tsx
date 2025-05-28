import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	ReactNode,
	useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TAB_PREFERENCES_KEY = "tab_preferences";

export interface TabPreferences {
	showLikedSongs: boolean;
	showAlbums: boolean;
	showPlaylists: boolean;
	showSearch: boolean;
	showPlayingInNavbar: boolean;
}

const defaultPreferences: TabPreferences = {
	showLikedSongs: true,
	showAlbums: true,
	showPlaylists: true,
	showSearch: true,
	showPlayingInNavbar: false,
};

interface TabPreferencesContextType {
	preferences: TabPreferences;
	updatePreference: (
		key: keyof TabPreferences,
		value: boolean
	) => Promise<void>;
	isLoading: boolean;
}

const TabPreferencesContext = createContext<
	TabPreferencesContextType | undefined
>(undefined);

export const TabPreferencesProvider = ({
	children,
}: {
	children: ReactNode;
}) => {
	const [preferences, setPreferences] =
		useState<TabPreferences>(defaultPreferences);
	const [isLoading, setIsLoading] = useState(true);

	// Load preferences from storage on mount
	useEffect(() => {
		const loadPreferences = async () => {
			try {
				const stored = await AsyncStorage.getItem(TAB_PREFERENCES_KEY);
				if (stored) {
					const parsedPreferences = JSON.parse(stored);
					setPreferences({
						...defaultPreferences,
						...parsedPreferences,
					});
				}
			} catch (error) {
				console.error("Error loading tab preferences:", error);
			} finally {
				setIsLoading(false);
			}
		};

		loadPreferences();
	}, []);

	// Update a specific preference
	const updatePreference = useCallback(
		async (key: keyof TabPreferences, value: boolean) => {
			try {
				const newPreferences = { ...preferences, [key]: value };
				setPreferences(newPreferences);
				await AsyncStorage.setItem(
					TAB_PREFERENCES_KEY,
					JSON.stringify(newPreferences)
				);
			} catch (error) {
				console.error("Error saving tab preferences:", error);
			}
		},
		[preferences]
	);

	const value: TabPreferencesContextType = {
		preferences,
		updatePreference,
		isLoading,
	};

	return (
		<TabPreferencesContext.Provider value={value}>
			{children}
		</TabPreferencesContext.Provider>
	);
};

export const useTabPreferences = () => {
	const context = useContext(TabPreferencesContext);
	if (context === undefined) {
		throw new Error(
			"useTabPreferences must be used within a TabPreferencesProvider"
		);
	}
	return context;
};
