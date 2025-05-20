import React from "react";
import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons"; // Ensure this is available
import { useAuth } from "@/contexts/AuthContext";

import { Navbar, TabConfigItem } from "@/components/Navbar"; // Import custom Navbar and TabConfigItem type
import { TabHeader } from "@/components/TabHeader"; // Import custom TabHeader

export const TABS_CONFIG: ReadonlyArray<TabConfigItem> = [
	{ name: "Recents", screenName: "index", iconName: "history" },
	{ name: "Albums", screenName: "albums", iconName: "album" },
	{ name: "Playlists", screenName: "playlists", iconName: "playlist-play" },
	{ name: "Search", screenName: "search", iconName: "search" },
	{ name: "Settings", screenName: "settings", iconName: "more-horiz" },
] as const;

export default function TabLayout() {
	const { fetchPlaylists, fetchAlbums } = useAuth();

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
			{TABS_CONFIG.map((tab) => (
				<Tabs.Screen
					key={tab.screenName}
					name={tab.screenName}
					options={{
						header: (props) => (
							<TabHeader
								headerTitle={tab.name}
								// Conditionally add refresh icon for Playlists tab
								{...(tab.screenName === "playlists" && {
									iconName:
										"refresh" as keyof typeof MaterialIcons.glyphMap,
									onIconPress: fetchPlaylists,
								})}
								/* Conditionally add refresh icon for Albums tab */
								{...(tab.screenName === "albums" && {
									iconName:
										"refresh" as keyof typeof MaterialIcons.glyphMap,
									onIconPress: fetchAlbums,
								})}
							/>
						),
						href: `/${tab.screenName}` as any, // Type assertion to satisfy Expo Router
					}}
				/>
			))}
		</Tabs>
	);
}
