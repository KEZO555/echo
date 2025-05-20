import React from "react";
import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons"; // Ensure this is available
import { useAuth } from "@/contexts/AuthContext";

import { Navbar, TabConfigItem } from "@/components/Navbar"; // Import custom Navbar and TabConfigItem type
import { TabHeader } from "@/components/TabHeader"; // Import custom TabHeader

export const TABS_CONFIG: ReadonlyArray<TabConfigItem> = [
	{ name: "Liked Songs", screenName: "index", iconName: "favorite" },
	{ name: "Albums", screenName: "albums", iconName: "album" },
	{ name: "Playlists", screenName: "playlists", iconName: "playlist-play" },
	{ name: "Search", screenName: "search", iconName: "search" },
	{ name: "Settings", screenName: "settings", iconName: "more-horiz" },
] as const;

export default function TabLayout() {
	const { fetchPlaylists, fetchAlbums, fetchSavedTracks } = useAuth();

	return (
		<Tabs
			screenOptions={({ route }) => ({
				header: () => {
					const currentTab = TABS_CONFIG.find(
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
						tabsConfig={TABS_CONFIG}
						currentScreenName={activeScreenName}
						navigation={props.navigation}
					/>
				);
			}}
		>
			{TABS_CONFIG.map((tab) => {
				const { fetchPlaylists, fetchAlbums, fetchSavedTracks } =
					useAuth() || {};

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
							header: (props) => (
								<TabHeader headerTitle={tab.name} />
							),
							href: `/${tab.screenName}` as any, // Type assertion to satisfy Expo Router
						}}
					/>
				);
			})}
		</Tabs>
	);
}
