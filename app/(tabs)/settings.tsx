import React, { useEffect } from "react";
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
                title: "Reset Server Info",
                message: "Are you sure you want to reset your server info?\n\nThis will log you out and clear your Client ID and Server URL.",
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
            headerTitle={`Settings (v${Application.nativeApplicationVersion})`}
            hideBackButton={true}
        >

            <StyledButton text="Customise" onPress={handleCustomise} />

            <StyledButton text="Clear Cache" onPress={handleClearCache} />

            <StyledButton text="Reset Server Info" onPress={handleResetCredentials} />

            <StyledButton text="Logout" onPress={handleLogout} />
        </ContentContainer>
    );
}
