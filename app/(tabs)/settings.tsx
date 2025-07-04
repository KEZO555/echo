import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { StyledButton } from "@/components/StyledButton";
import { useRouter } from "expo-router";
import * as Application from "expo-application";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import ContentContainer from "@/components/ContentContainer";

export default function SettingsScreen() {
	const { logout } = useAuth();
	const router = useRouter();
	const handleLogout = async () => {
		await logout();
	};
	const handleCustomiseTabs = () => {
		router.push("/customise-tabs" as any);
	};
	const { invertColors, setInvertColors } = useInvertColors();
	const handleDebug = () => {
		router.push("/debug" as any);
	};

	return (
		<ContentContainer
			headerTitle="Settings"
			hideBackButton={true}
		>
            <ToggleSwitch
            value={invertColors}
            label="Invert Colours"
            onValueChange={setInvertColors}
            />

            <StyledButton
                text="Customise Tabs"
                onPress={handleCustomiseTabs}
            />

            <StyledButton text="Debug" onPress={handleDebug} />

            <StyledButton text="Logout" onPress={handleLogout} />

            <View style={styles.versionContainer}>
                <Text style={styles.versionText}>
                    v{Application.nativeApplicationVersion}
                </Text>
            </View>
		</ContentContainer>
	);
}

const styles = StyleSheet.create({
	versionContainer: {
        width: "100%",
		alignItems: "center",
        justifyContent: "flex-end",
        flex: 1,
	},
	versionText: {
		color: "#666",
		fontSize: 12,
		fontWeight: "400",
	},
});
