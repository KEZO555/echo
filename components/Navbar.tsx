import React from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { HapticPressable } from "./HapticPressable";
import { useRouter } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useInvertColors } from "@/contexts/InvertColorsContext";

export interface TabConfigItem {
	name: string;
	screenName: string;
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
    const { invertColors } = useInvertColors();

	return (
		<View style={[styles.navbar, { backgroundColor: invertColors ? "white" : "black" }]}>
			{showPlayingButton && (
				<HapticPressable onPress={handlePlayingPress}>
					<MaterialIcons
						name="multitrack-audio"
						size={48}
						color={ invertColors ? "#C1C1C1" : "#6E6E6E" }
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
						size={48}
						color={
							tab.screenName === currentScreenName
								? invertColors ? "black" : "white"
								: invertColors ? "#C1C1C1" : "#6E6E6E"
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
	},
});
