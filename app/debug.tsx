import React from "react";
import { Alert } from "react-native";
import { StyledButton } from "@/shared/components/StyledButton";
import ContentContainer from "@/shared/components/ContentContainer";
import { clearCachedData } from "@/features/library/utils/cache";
import { useSettings } from "@/features/settings";
import { ToggleSwitch } from "@/shared/components/ToggleSwitch";

export default function DebugScreen() {
    const { tabPreferences, updateTabPreference } = useSettings();

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
        const newValue = !tabPreferences.showRemoteStatusWhenOnline;
        await updateTabPreference("showRemoteStatusWhenOnline", newValue);
    };

    return (
        <ContentContainer headerTitle="Debug">
            <ToggleSwitch
                value={tabPreferences.showRemoteStatusWhenOnline}
                label="Status bar when online"
                onValueChange={handleToggleRemoteStatus}
            />
            <StyledButton text="Clear Cache" onPress={handleClearCache} />
        </ContentContainer>
    );
}
