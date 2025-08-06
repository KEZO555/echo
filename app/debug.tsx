import React, { useState } from "react";
import { Alert, Share, Platform } from "react-native";
import { StyledButton } from "@/components/StyledButton";
import { getLogsAsText, clearLogs, log, logError } from "@/utils/logger";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import ContentContainer from "@/components/ContentContainer";
import { clearCachedData } from "@/utils/cache";
import { useTabPreferences } from "@/contexts/TabPreferencesContext";
import { ToggleSwitch } from "@/components/ToggleSwitch";

export default function DebugScreen() {
    const [isSharing, setIsSharing] = useState(false);
    const { preferences, updatePreference } = useTabPreferences();

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
                const fileUri = `${FileSystem.documentDirectory}${fileName}`;
                await FileSystem.writeAsStringAsync(fileUri, logs);

                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(fileUri, {
                        mimeType: "text/plain",
                        dialogTitle: "Share Spotify App Logs",
                    });
                } else {
                    await Share.share({
                        message: logs,
                        title: "Spotify App Logs",
                    });
                }
            } else {
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

    const handleClearCache = () => {
        Alert.alert(
            "Clear Cache",
            "Are you sure you want to clear all cached data?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear",
                    style: "destructive",
                    onPress: () => {
                        log("Debug: Clearing all cached data");
                        clearCachedData();
                        Alert.alert("Success", "Cache cleared successfully.");
                    },
                },
            ]
        );
    };

    const handleToggleRemoteStatus = async () => {
        const newValue = !preferences.showRemoteStatusWhenOnline;
        await updatePreference("showRemoteStatusWhenOnline", newValue);
        log(`Debug: Remote status when online toggled to ${newValue}`);
    };

    return (
        <ContentContainer headerTitle="Debug">
            <ToggleSwitch
                value={preferences.showRemoteStatusWhenOnline}
                label="Status bar when online"
                onValueChange={handleToggleRemoteStatus}
            />
            <StyledButton
                text={isSharing ? "Sharing Logs..." : "Share Logs"}
                onPress={isSharing ? undefined : handleShareLogs}
            />

            <StyledButton text="Clear Logs" onPress={handleClearLogs} />

            <StyledButton text="Clear Cache" onPress={handleClearCache} />


        </ContentContainer>
    );
}

