import React, { useMemo } from "react";
import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons"; // Ensure this is available
import { useAuth } from "@/contexts/AuthContext";
import { useTabPreferences } from "@/contexts/TabPreferencesContext";

import { Navbar, TabConfigItem } from "@/components/Navbar"; // Import custom Navbar and TabConfigItem type
import { TabHeader } from "@/components/TabHeader"; // Import custom TabHeader

export const TABS_CONFIG: ReadonlyArray<TabConfigItem> = [
	{ name: "Liked Songs", screenName: "index", iconName: "favorite" },
	{ name: "Albums", screenName: "albums", iconName: "album" },
	{
		name: "Playlists",
		screenName: "playlists",
		iconName: "format-list-bulleted",
	},
	{ name: "Search", screenName: "search", iconName: "search" },
	{ name: "Settings", screenName: "settings", iconName: "more-horiz" },
] as const;

export default function TabLayout() {
	const { fetchPlaylists, fetchAlbums, fetchSavedTracks } = useAuth();
	const { preferences } = useTabPreferences();

	// Filter tabs based on user preferences
	const visibleTabs = useMemo(() => {
		const filtered = TABS_CONFIG.filter((tab) => {
			switch (tab.screenName) {
				case "index":
					return preferences.showLikedSongs;
				case "albums":
					return preferences.showAlbums;
				case "playlists":
					return preferences.showPlaylists;
				case "search":
				case "settings":
					return true; // Always show search and settings
				default:
					return true;
			}
		});

		// Ensure we always have at least search and settings visible
		// This should always be true given our logic above, but it's a safeguard
		if (filtered.length < 2) {
			console.warn(
				"TabLayout: Less than 2 tabs visible, this should not happen"
			);
			return TABS_CONFIG.filter(
				(tab) =>
					tab.screenName === "search" || tab.screenName === "settings"
			);
		}

		return filtered;
	}, [preferences]);

	return (
		<Tabs
			screenOptions={({ route }) => ({
				header: () => {
					const currentTab = visibleTabs.find(
						(t) => t.screenName === route.name
					);
					return (
						<TabHeader
							headerTitle={currentTab ? currentTab.name : " "}
						/>
					);
				},
				animation: "none",
			})}
			tabBar={(props) => {
				const activeScreenName =
					props.state.routes[props.state.index].name;
				return (
					<Navbar
						tabsConfig={visibleTabs}
						currentScreenName={activeScreenName}
						navigation={props.navigation}
					/>
				);
			}}
		>
			{visibleTabs.map((tab) => {
				let onRefresh: (() => Promise<void>) | undefined;
				let refreshIconName:
					| keyof typeof MaterialIcons.glyphMap
					| undefined;

				if (tab.screenName === "index" && fetchSavedTracks) {
					onRefresh = fetchSavedTracks;
					refreshIconName = "refresh";
				} else if (tab.screenName === "playlists" && fetchPlaylists) {
					onRefresh = fetchPlaylists;
					refreshIconName = "refresh";
				} else if (tab.screenName === "albums" && fetchAlbums) {
					onRefresh = fetchAlbums;
					refreshIconName = "refresh";
				}

				return (
					<Tabs.Screen
						key={tab.screenName}
						name={tab.screenName}
						options={{
							header:
								tab.screenName === "search"
									? () => null
									: (props) => (
											<TabHeader
												headerTitle={tab.name}
												leftIconName={refreshIconName}
												leftOnIconPress={onRefresh}
												hideWaveformButton={
													tab.screenName ===
													"settings"
												}
											/>
									  ),
							href: `/${tab.screenName}` as any,
						}}
					/>
				);
			})}
		</Tabs>
	);
}
