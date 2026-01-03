import React from "react";
import { View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import ContentContainer from "@/shared/components/ContentContainer";
import { StyledText } from "@/shared/components/StyledText";
import { HapticPressable } from "@/shared/components/HapticPressable";
import { useSettings } from "@/features/settings";
import { useCredentials } from "@/features/credentials";

export default function ErrorScreen() {
	const router = useRouter();
	const { invertColors } = useSettings();
	const { clearCredentials } = useCredentials();
	const params = useLocalSearchParams<{
		title: string;
		message: string;
		buttonText?: string;
	}>();

	const handleDismiss = async () => {
		await clearCredentials();
		router.replace("/login");
	};

	const textColor = invertColors ? "black" : "white";

	return (
		<ContentContainer
			headerTitle={params.title || "Error"}
			hideBackButton={true}
		>
			<StyledText style={styles.messageText}>
				{params.message}
			</StyledText>

			<View style={styles.buttonContainer}>
				<HapticPressable
					onPress={handleDismiss}
					style={styles.button}
				>
					<StyledText style={[styles.buttonText, { color: textColor }]}>
						{params.buttonText || "OK"}
					</StyledText>
				</HapticPressable>
			</View>
		</ContentContainer>
	);
}

const styles = StyleSheet.create({
	messageText: {
		fontSize: 18,
		marginHorizontal: 0,
		marginTop: 10,
	},
	buttonContainer: {
		width: "100%",
		flex: 1,
		justifyContent: "flex-end",
		alignItems: "center",
	},
	button: {
		paddingVertical: 15,
		paddingHorizontal: 30,
		alignItems: "center",
		justifyContent: "flex-end",
		minWidth: 200,
	},
	buttonText: {
		fontSize: 40,
		textTransform: "uppercase",
	},
});
