import React from "react";
import { View, StyleSheet } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { StyledText } from "@/components/StyledText";
import { HapticPressable } from "@/components/HapticPressable";
import { TabHeader } from "@/components/TabHeader";

export default function LoginScreen() {
	const { login, isLoading, user } = useAuth();

	return (
		<View style={styles.container}>
			<TabHeader
				headerTitle="Getting Started"
				hideWaveformButton={true}
			/>

			<View style={styles.content}>
				<StyledText style={styles.informationText}>
					Welcome to the beta testing of a Spotify client for the
					Light Phone III!
					{"\n"}
					{"\n"}
					No matter how big or small, please don't hesitate to report
					any bugs, issues or feedback!
					{"\n"}
					{"\n"}
					With love,
					{"\n"}
					Vandam
				</StyledText>
			</View>
			<HapticPressable
				onPress={login}
				style={styles.loginButton}
				disabled={isLoading}
			>
				<StyledText style={styles.loginButtonText}>Login</StyledText>
			</HapticPressable>
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
		backgroundColor: "black",
		alignItems: "center",
		justifyContent: "flex-start",
		width: "100%",
	},
	informationText: {
		color: "white",
		fontSize: 18,
		marginHorizontal: 40,
		marginTop: 10,
	},
	loginButton: {
		paddingVertical: 15,
		paddingHorizontal: 30,
		alignItems: "center",
		justifyContent: "center",
		minWidth: 200,
	},
	loginButtonText: {
		color: "white",
		fontSize: 40,
		textTransform: "uppercase",
	},
	buttonSpacing: {
		marginVertical: 15,
	},
	debugButton: {
		paddingVertical: 15,
		paddingHorizontal: 30,
	},
	debugButtonText: {
		color: "white",
		fontSize: 18,
	},
});
