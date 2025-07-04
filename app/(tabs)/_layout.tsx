import React, { useMemo } from "react";
import { Tabs } from "expo-router";
import { useTabPreferences } from "@/contexts/TabPreferencesContext";
import { Navbar, TabConfigItem } from "@/components/Navbar";
import { TabHeader } from "@/components/TabHeader";

export const TABS_CONFIG: ReadonlyArray<TabConfigItem> = [
    {   name: "Liked Songs",
        screenName: "index",
        iconName: "favorite"
    },
    {   name: "Albums",
        screenName: "albums",
        iconName: "album"
    },
    {
        name: "Playlists",
        screenName: "playlists",
        iconName: "format-list-bulleted",
    },
    {   name: "Search",
        screenName: "search",
        iconName: "search"
    },
    {   name: "Settings",
        screenName: "settings",
        iconName: "more-horiz"
    },
] as const;

export default function TabLayout() {
	const { preferences } = useTabPreferences();

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
					return true;
				default:
					return true;
			}
		});

		return filtered;
	}, [preferences]);

	return (
		<Tabs
			tabBar={(props) => {
				const activeScreenName =
					props.state.routes[props.state.index].name;
				return (
					<Navbar
						tabsConfig={visibleTabs}
						currentScreenName={activeScreenName}
						navigation={props.navigation}
						showPlayingButton={preferences.showPlayingInNavbar}
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
							header: () => null,
						}}
					/>
				);
			})}
		</Tabs>
	);
}
