import React, { useState } from "react";
import { View, StyleSheet, TextInput } from "react-native";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { useCredentials } from "@/features/credentials";
import { useSettings } from "@/features/settings";
import { StyledText } from "@/shared/components/StyledText";
import { HapticPressable } from "@/shared/components/HapticPressable";
import ContentContainer from "@/shared/components/ContentContainer";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

type SetupStep = "clientId" | "serverUrl";

export default function LoginScreen() {
	const { login, isLoading } = useAuth();
	const { credentials, isConfigured, saveCredentials, clearCredentials } = useCredentials();
	const { invertColors } = useSettings();

	const [step, setStep] = useState<SetupStep>("clientId");
	const [clientId, setClientId] = useState(credentials?.clientId ?? "");
	const [serverUrl, setServerUrl] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	const textColor = invertColors ? "black" : "white";
	const borderColor = invertColors ? "black" : "white";

	const handleClientIdNext = () => {
		if (clientId.trim()) {
			setStep("serverUrl");
		}
	};

	const normaliseUrl = (url: string): string => {
		let normalised = url.trim();
		if (!normalised.startsWith("http://") && !normalised.startsWith("https://")) {
			normalised = `https://${normalised}`;
		}
		normalised = normalised.replace(/\/+$/, "");
		return normalised;
	};

	const handleSaveCredentials = async () => {
		if (!serverUrl.trim()) return;

		setIsSaving(true);
		try {
			const baseUrl = normaliseUrl(serverUrl);
			await saveCredentials({
				clientId: clientId.trim(),
				tokenSwapUrl: `${baseUrl}/swap`,
				tokenRefreshUrl: `${baseUrl}/refresh`,
			});
		} finally {
			setIsSaving(false);
		}
	};

	const handleBackToSetup = async () => {
		await clearCredentials();
		setStep("serverUrl");
	};

	if (!isConfigured) {
		if (step === "clientId") {
			return (
				<ContentContainer
					headerTitle="Client ID"
					hideBackButton={true}
					headerIcon="arrow-forward"
					headerIconShowLength={clientId.trim().length}
					headerIconPress={handleClientIdNext}
				>
					<View style={[styles.inputContainer, { borderBottomColor: borderColor }]}>
						<TextInput
							style={[styles.input, { color: textColor }]}
							value={clientId}
							onChangeText={setClientId}
							placeholder="Enter your Spotify Client ID"
							placeholderTextColor="#888"
							autoCapitalize="none"
							autoCorrect={false}
							cursorColor={textColor}
							selectionColor={textColor}
							onSubmitEditing={handleClientIdNext}
							autoFocus
						/>
						{clientId.length > 0 && (
							<HapticPressable
								style={styles.clearButton}
								onPress={() => {
									setClientId("");
									Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
								}}
							>
								<MaterialIcons name="clear" size={24} color={textColor} />
							</HapticPressable>
						)}
					</View>
				</ContentContainer>
			);
		}

		return (
			<ContentContainer 
				headerTitle="Server URL" 
				hideBackButton={false}
				onBackPress={() => setStep("clientId")}
				headerIcon="arrow-forward"
				headerIconShowLength={serverUrl.trim().length}
				headerIconPress={handleSaveCredentials}
			>
				<View style={[styles.inputContainer, { borderBottomColor: borderColor }]}>
					<TextInput
						style={[styles.input, { color: textColor }]}
						value={serverUrl}
						onChangeText={setServerUrl}
						placeholder="https://your-server.com"
						placeholderTextColor="#888"
						autoCapitalize="none"
						autoCorrect={false}
						keyboardType="url"
						cursorColor={textColor}
						selectionColor={textColor}
						onSubmitEditing={handleSaveCredentials}
						autoFocus
					/>
					{serverUrl.length > 0 && (
						<HapticPressable
							style={styles.clearButton}
							onPress={() => {
								setServerUrl("");
								Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
							}}
						>
							<MaterialIcons name="clear" size={24} color={textColor} />
						</HapticPressable>
					)}
				</View>
			</ContentContainer>
		);
	}

	return (
		<ContentContainer
			headerTitle="Login"
			hideBackButton={false}
			onBackPress={handleBackToSetup}
		>
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

			<View style={styles.buttonContainer}>
				<HapticPressable
					onPress={login}
					style={styles.loginButton}
					disabled={isLoading}
				>
					<StyledText style={styles.loginButtonText}>Login</StyledText>
				</HapticPressable>
			</View>
		</ContentContainer>
	);
}

const styles = StyleSheet.create({
	informationText: {
		fontSize: 18,
		marginHorizontal: 0,
		marginTop: 10,
	},
	inputContainer: {
		flexDirection: "row",
		alignItems: "center",
		width: "100%",
		borderBottomWidth: 1,
	},
	input: {
		flex: 1,
		fontSize: 24,
		fontFamily: "PublicSans-Regular",
		paddingVertical: 2,
		textAlign: "left",
		paddingBottom: 6,
	},
	clearButton: {
		padding: 5,
	},
	buttonContainer: {
		width: "100%",
		flex: 1,
		justifyContent: "flex-end",
		alignItems: "center",
	},
	loginButton: {
		paddingVertical: 15,
		paddingHorizontal: 30,
		alignItems: "center",
		justifyContent: "flex-end",
		minWidth: 200,
	},
	loginButtonText: {
		fontSize: 40,
		textTransform: "uppercase",
	},
});
