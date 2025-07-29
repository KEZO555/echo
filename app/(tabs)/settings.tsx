import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { StyledButton } from "@/components/StyledButton";
import { useRouter } from "expo-router";
import * as Application from "expo-application";
import ContentContainer from "@/components/ContentContainer";

export default function SettingsScreen() {
    const { logout } = useAuth();
    const router = useRouter();
    const handleLogout = async () => {
        await logout();
    };
    const handleDebug = () => {
        router.push("/debug" as any);
    };
    const handleCustomise = () => {
        router.push("/customise" as any);
    };

    return (
        <ContentContainer
            headerTitle="Settings"
            hideBackButton={true}
        >

            <StyledButton text="Customise" onPress={handleCustomise} />

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
