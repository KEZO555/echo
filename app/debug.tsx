import React, { useState } from "react";
import { Alert, Share, Platform, StyleSheet, Text, View } from "react-native";
import { StyledButton } from "@/components/StyledButton";
import { getLogsAsText, clearLogs, log, logError } from "@/utils/logger";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import ContentContainer from "@/components/ContentContainer";
import { useAuth } from "@/contexts/AuthContext";
import * as SecureStore from "expo-secure-store";
import { TOKEN_EXPIRY_KEY } from "@/constants/spotify";
import { clearCachedData } from "@/utils/cache";

export default function DebugScreen() {
    const [isSharing, setIsSharing] = useState(false);
    const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
    const { accessToken, refreshToken } = useAuth();

    React.useEffect(() => {
        const loadTokenExpiry = async () => {
            try {
                const expiryString = await SecureStore.getItemAsync(TOKEN_EXPIRY_KEY);
                if (expiryString) {
                    setTokenExpiry(parseInt(expiryString, 10));
                }
            } catch (error) {
                logError("Debug: Error loading token expiry:", error);
            }
        };
        loadTokenExpiry();
    }, []);

    const formatExpiryTime = (expiry: number | null) => {
        if (!expiry) return "Not available";

        const expiryDate = new Date(expiry);
        const now = new Date();
        const timeUntilExpiry = expiry - now.getTime();

        if (timeUntilExpiry < 0) {
            const expiredMinutes = Math.abs(Math.floor(timeUntilExpiry / (1000 * 60)));
            return `Expired ${expiredMinutes}m ago (${expiryDate.toLocaleTimeString()})`;
        } else {
            const validMinutes = Math.floor(timeUntilExpiry / (1000 * 60));
            return `Valid for ${validMinutes}m (expires ${expiryDate.toLocaleTimeString()})`;
        }
    };

    const handleRefreshTokenInfo = async () => {
        try {
            const expiryString = await SecureStore.getItemAsync(TOKEN_EXPIRY_KEY);
            if (expiryString) {
                setTokenExpiry(parseInt(expiryString, 10));
            }
        } catch (error) {
            logError("Debug: Error loading token expiry:", error);
        }
    };

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

    return (
        <ContentContainer headerTitle="Debug">
            <StyledButton
                text={isSharing ? "Sharing Logs..." : "Share Logs"}
                onPress={isSharing ? undefined : handleShareLogs}
            />

            <StyledButton text="Clear Logs" onPress={handleClearLogs} />

            <StyledButton text="Refresh Token Info" onPress={handleRefreshTokenInfo} />

            <StyledButton text="Clear Cache" onPress={handleClearCache} />

            <View style={styles.infoContainer}>
                <Text style={styles.infoText}>
                    Token Status: {accessToken ? "Available" : "Not available"}
                </Text>
                <Text style={styles.infoText}>
                    Refresh Token: {refreshToken ? "Available" : "Not available"}
                </Text>
                <Text style={styles.infoText}>
                    Expiry: {formatExpiryTime(tokenExpiry)}
                </Text>
            </View>
        </ContentContainer>
    );
}

const styles = StyleSheet.create({
    infoContainer: {
        width: "100%",
        alignItems: "center",
        justifyContent: "flex-end",
        flex: 1,
        paddingBottom: 10,
        gap: 5,
    },
    infoText: {
        color: "#666",
        fontSize: 14,
        fontWeight: "400",
        textAlign: "center",
    },
});
