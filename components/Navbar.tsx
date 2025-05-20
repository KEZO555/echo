import React from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { HapticPressable } from "./HapticPressable";
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
}

export function Navbar({
	tabsConfig,
	currentScreenName,
	navigation,
}: NavbarProps) {
	return (
		<View style={styles.navbar}>
			{tabsConfig.map((tab) => (
				<HapticPressable
					key={tab.screenName}
					onPress={() => navigation.navigate(tab.screenName)}
				>
					<MaterialIcons
						name={tab.iconName}
						size={40} // Slightly reduced size for a typical navbar
						color={
							tab.screenName === currentScreenName
								? "white"
								: "#CDCDCD"
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
