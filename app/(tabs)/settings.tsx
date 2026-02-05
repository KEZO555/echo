import * as Application from "expo-application";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth";
import { useCredentials } from "@/features/credentials";
import { clearCachedData } from "@/features/library";
import ContentContainer from "@/shared/components/ContentContainer";
import { StyledButton } from "@/shared/components/StyledButton";

export default function SettingsScreen() {
  const { logout } = useAuth();
  const { clearCredentials } = useCredentials();
  const router = useRouter();
  const params = useLocalSearchParams<{
    confirmed?: string;
    action?: string;
  }>();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
        title: "Reset API Credentials",
        message:
          "Are you sure you want to reset your API Credentials?\n\nThis will log you out and clear your Client ID and Secret.",
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
      router.setParams({ confirmed: undefined, action: undefined });
      if (params.action === "clearCache") {
        clearCachedData();
      } else if (params.action === "resetCredentials") {
        handleResetCredentialsConfirmed();
      } else if (params.action === "logout") {
        handleLogoutConfirmed();
      }
    }
  }, [params.confirmed, params.action]);

  const handleLogoutConfirmed = async () => {
    setIsLoggingOut(true);
    await logout();
    router.replace("/login");
  };

  const handleResetCredentialsConfirmed = async () => {
    setIsLoggingOut(true);
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

  if (isLoggingOut) {
    return null;
  }

  return (
    <ContentContainer
      headerTitle={`Settings (v${Application.nativeApplicationVersion})`}
      hideBackButton={true}
    >
      <StyledButton onPress={handleCustomise} text="Customise" />

      <StyledButton onPress={handleClearCache} text="Clear Cache" />

      <StyledButton
        onPress={handleResetCredentials}
        text="Reset API Credentials"
      />

      <StyledButton onPress={handleLogout} text="Logout" />
    </ContentContainer>
  );
}
