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
					return preferences.showSearch;
				case "settings":
					return true; // Always show settings
				default:
					return true;
			}
		});

		// Ensure we always have at least settings visible
		// This should always be true given our logic above, but it's a safeguard
		if (filtered.length < 1) {
			console.warn(
				"TabLayout: Less than 1 tab visible, this should not happen"
			);
			return TABS_CONFIG.filter((tab) => tab.screenName === "settings");
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
