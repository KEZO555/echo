import React from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { HapticPressable } from "./HapticPressable";
import { useRouter } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

// This defines the structure of individual tab configuration
export interface TabConfigItem {
	name: string; // For display in TabHeader
	screenName: string; // For navigation and keys
	iconName: keyof typeof MaterialIcons.glyphMap; // For the icon
}

interface NavbarProps {
	tabsConfig: ReadonlyArray<TabConfigItem>;
	currentScreenName: string;
	navigation: BottomTabBarProps["navigation"];
	showPlayingButton?: boolean;
}

export function Navbar({
	tabsConfig,
	currentScreenName,
	navigation,
	showPlayingButton = false,
}: NavbarProps) {
	const router = useRouter();

	const handlePlayingPress = () => {
		router.push("/playing");
	};

	return (
		<View style={styles.navbar}>
			{showPlayingButton && (
				<HapticPressable onPress={handlePlayingPress}>
					<MaterialIcons
						name="multitrack-audio"
						size={48}
						color="#6E6E6E"
					/>
				</HapticPressable>
			)}
			{tabsConfig.map((tab) => (
				<HapticPressable
					key={tab.screenName}
					onPress={() => navigation.navigate(tab.screenName)}
				>
					<MaterialIcons
						name={tab.iconName}
						size={48} // Increased size for better visibility
						color={
							tab.screenName === currentScreenName
								? "white"
								: "#6E6E6E"
						}
					/>
				</HapticPressable>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	navbar: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 11,
		paddingHorizontal: 20,
		backgroundColor: "black",
	},
});
