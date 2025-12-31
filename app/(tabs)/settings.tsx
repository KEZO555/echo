import React, { useEffect } from "react";
import { View, StyleSheet, Text, Alert } from "react-native";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { useCredentials } from "@/features/credentials";
import { StyledButton } from "@/shared/components/StyledButton";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Application from "expo-application";
import ContentContainer from "@/shared/components/ContentContainer";
import { clearCachedData } from "@/features/library/utils/cache";

export default function SettingsScreen() {
    const { logout } = useAuth();
    const { clearCredentials } = useCredentials();
    const router = useRouter();
    const params = useLocalSearchParams<{ confirmed?: string; action?: string }>();

    const handleLogout = () => {
        router.push({
            pathname: "/confirm",
            params: {
                title: "Logout",
                message: "Are you sure you want to logout?",
                confirmText: "Logout",
                action: "logout",
            },
        });
    };

    const handleResetCredentials = () => {
        router.push({
            pathname: "/confirm",
            params: {
                title: "Reset Credentials",
                message: "Are you sure you want to reset your credentials?\n\nThis will logout and clear all saved credentials.",
                confirmText: "Reset",
                action: "resetCredentials",
            },
        });
    };

    const handleCustomise = () => {
        router.push("/customise" as any);
    };

    useEffect(() => {
        if (params.confirmed === "true") {
            if (params.action === "clearCache") {
                clearCachedData();
                Alert.alert("Success", "Cache cleared successfully.");
            } else if (params.action === "resetCredentials") {
                handleResetCredentialsConfirmed();
            } else if (params.action === "logout") {
                handleLogoutConfirmed();
            }
            router.setParams({ confirmed: undefined, action: undefined });
        }
    }, [params.confirmed, params.action]);

    const handleLogoutConfirmed = async () => {
        await logout();
        router.replace("/login");
    };

    const handleResetCredentialsConfirmed = async () => {
        await logout();
        await clearCredentials();
        router.replace("/login");
    };

    const handleClearCache = () => {
        router.push({
            pathname: "/confirm",
            params: {
                title: "Clear Cache",
                message: "Are you sure you want to clear all cached data?",
                confirmText: "Clear",
                action: "clearCache",
            },
        });
    };

    return (
        <ContentContainer
            headerTitle="Settings"
            hideBackButton={true}
        >

            <StyledButton text="Customise" onPress={handleCustomise} />

            <StyledButton text="Clear Cache" onPress={handleClearCache} />

            <StyledButton text="Reset Credentials" onPress={handleResetCredentials} />

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
