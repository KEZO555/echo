import React from "react";
import { Alert } from "react-native";
import { StyledButton } from "@/components/StyledButton";
import ContentContainer from "@/components/ContentContainer";
import { clearCachedData } from "@/utils/cache";
import { useTabPreferences } from "@/contexts/TabPreferencesContext";
import { ToggleSwitch } from "@/components/ToggleSwitch";

export default function DebugScreen() {
    const { preferences, updatePreference } = useTabPreferences();

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
    };

    return (
        <ContentContainer headerTitle="Debug">
            <ToggleSwitch
                value={preferences.showRemoteStatusWhenOnline}
                label="Status bar when online"
                onValueChange={handleToggleRemoteStatus}
            />
            <StyledButton text="Clear Cache" onPress={handleClearCache} />
        </ContentContainer>
    );
}
