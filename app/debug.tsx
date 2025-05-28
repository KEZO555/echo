import React, { useState } from "react";
import { View, StyleSheet, Alert, Share, Platform } from "react-native";
import { Header } from "@/components/Header";
import { StyledButton } from "@/components/StyledButton";
import { getLogsAsText, clearLogs, log, logError } from "@/utils/logger";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

export default function DebugScreen() {
	const [isSharing, setIsSharing] = useState(false);

	const handleShareLogs = async () => {
		try {
			log("Debug: Starting log share process");
			setIsSharing(true);
			const logs = getLogsAsText();

			if (!logs || logs.trim() === "") {
				Alert.alert("No Logs", "No logs available to share.");
				return;
			}

			const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
			const fileName = `spotify-logs-${timestamp}.txt`;

			if (Platform.OS === "android") {
				// For Android, save to file and share
				const fileUri = `${FileSystem.documentDirectory}${fileName}`;
				await FileSystem.writeAsStringAsync(fileUri, logs);

				if (await Sharing.isAvailableAsync()) {
					await Sharing.shareAsync(fileUri, {
						mimeType: "text/plain",
						dialogTitle: "Share Spotify App Logs",
					});
				} else {
					// Fallback to native share
					await Share.share({
						message: logs,
						title: "Spotify App Logs",
					});
				}
			} else {
				// For other platforms, use native share API
				await Share.share({
					message: logs,
					title: "Spotify App Logs",
				});
			}
		} catch (error) {
			logError("Error sharing logs:", error);
			Alert.alert("Error", "Failed to share logs. Please try again.");
		} finally {
			setIsSharing(false);
		}
	};

	const handleClearLogs = () => {
		Alert.alert(
			"Clear Logs",
			"Are you sure you want to clear all captured logs?",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Clear",
					style: "destructive",
					onPress: () => {
						log("Debug: Clearing all logs");
						clearLogs();
						Alert.alert("Success", "Logs cleared successfully.");
					},
				},
			]
		);
	};

	return (
		<View style={styles.container}>
			<Header headerTitle="Debug" />
			<View style={styles.content}>
				<StyledButton
					text={isSharing ? "Sharing Logs..." : "Share Logs"}
					onPress={isSharing ? undefined : handleShareLogs}
				/>

				<StyledButton text="Clear Logs" onPress={handleClearLogs} />
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
