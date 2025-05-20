import React from "react";
import {
	View,
	StyleSheet,
	Text,
	Button,
	ActivityIndicator,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { HapticPressable } from "@/components/HapticPressable"; // Assuming you want to use your HapticPressable
import { StyledText } from "@/components/StyledText";
import { StyledButton } from "@/components/StyledButton";

export default function SettingsScreen() {
	const { logout, isLoading, user } = useAuth();

	const handleLogout = async () => {
		await logout();
	};

	return (
		<View style={styles.container}>
			<View style={styles.content}>
				<StyledButton text="Equaliser" />
				<StyledButton text="Logout" onPress={handleLogout} />
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "black",
	},
	content: {
		flex: 1,
		justifyContent: "flex-start",
		alignItems: "flex-start",
		paddingHorizontal: 20,
		gap: 18,
	},
	button: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	buttonText: {
		fontSize: 30,
		color: "white",
	},
});
