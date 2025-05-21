import React from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { StyledText } from "./StyledText";
import { HapticPressable } from "./HapticPressable";
import { useRouter } from "expo-router";

interface TabHeaderProps {
	leftIconName?: keyof typeof MaterialIcons.glyphMap;
	leftOnIconPress?: () => void;
	rightIconName?: keyof typeof MaterialIcons.glyphMap;
	rightOnIconPress?: () => void;
	iconShowLength?: number;
	headerTitle?: string;
}

export function TabHeader({
	leftIconName,
	leftOnIconPress,
	rightIconName,
	rightOnIconPress,
	iconShowLength = 1,
	headerTitle,
}: TabHeaderProps) {
	const router = useRouter();

	const handlePlayingPress = () => {
		router.push("/playing");
	};

	return (
		<View style={styles.header}>
			{leftIconName ? (
				<HapticPressable onPress={leftOnIconPress}>
					<View
						style={{ width: 32, height: 32, alignItems: "center" }}
					>
						<MaterialIcons
							name={leftIconName}
							size={32}
							color="white"
						/>
					</View>
				</HapticPressable>
			) : (
				<View style={{ width: 32, height: 32 }} />
			)}
			<StyledText style={styles.title}>{headerTitle}</StyledText>
			{rightIconName ? (
				iconShowLength > 0 ? (
					<HapticPressable onPress={rightOnIconPress}>
						<View
							style={{
								width: 32,
								height: 32,
								alignItems: "center",
							}}
						>
							<MaterialIcons
								name={rightIconName}
								size={32}
								color="white"
							/>
						</View>
					</HapticPressable>
				) : (
					<View style={{ width: 32 }} />
				)
			) : (
				<HapticPressable onPress={handlePlayingPress}>
					<View
						style={{ width: 32, height: 32, alignItems: "center" }}
					>
						<MaterialIcons
							name="multitrack-audio"
							size={32}
							color="white"
						/>
					</View>
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
		fontFamily: "PublicSans-Regular",
		paddingBottom: 5,
	},
});
