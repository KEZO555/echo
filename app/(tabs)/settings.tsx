import React from "react";
import { View, StyleSheet } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { StyledButton } from "@/components/StyledButton";
import { useRouter } from "expo-router";

export default function SettingsScreen() {
	const { logout, user } = useAuth();
	const router = useRouter();

	const handleLogout = async () => {
		await logout();
	};

	const handleCustomiseTabs = () => {
		router.push("/customise-tabs" as any);
	};

	const handleDebug = () => {
		router.push("/debug" as any);
	};

	return (
		<View style={styles.container}>
			<View style={styles.content}>
				<StyledButton
					text="Customise Tabs"
					onPress={handleCustomiseTabs}
				/>

				<StyledButton text="Debug" onPress={handleDebug} />

				{user && <StyledButton text="Logout" onPress={handleLogout} />}
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
		paddingHorizontal: 38,
		paddingTop: 4,
		gap: 46,
	},
});
