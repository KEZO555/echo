import React from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { StyledText } from "./StyledText";
import { HapticPressable } from "./HapticPressable";
import { useRouter } from "expo-router";

interface TabHeaderProps {
	iconName?: keyof typeof MaterialIcons.glyphMap;
	onIconPress?: () => void;
	iconShowLength?: number;
	headerTitle?: string;
}

export function TabHeader({
	iconName,
	onIconPress,
	iconShowLength = 1,
	headerTitle,
}: TabHeaderProps) {
	const router = useRouter();

	const handlePlayingPress = () => {
		router.push("/playing");
	};

	return (
		<View style={styles.header}>
			<View style={{ width: 32 }} />
			<StyledText style={styles.title}>{headerTitle}</StyledText>
			{iconShowLength > 0 && iconName ? (
				<HapticPressable onPress={onIconPress}>
					<MaterialIcons name={iconName} size={28} color="white" />
				</HapticPressable>
			) : (
				<HapticPressable onPress={handlePlayingPress}>
					<MaterialIcons
						name="multitrack-audio"
						size={28}
						color="white"
					/>
				</HapticPressable>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 22,
		paddingVertical: 10,
		backgroundColor: "black",
		zIndex: 1,
	},
	title: {
		color: "white",
		fontSize: 20,
		fontFamily: "AkkuratLL-Regular",
		paddingBottom: 5,
	},
});
