import { nativeApplicationVersion } from "expo-application";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, ToastAndroid, View } from "react-native";
import { useAuth } from "@/features/auth";
import { useCredentials } from "@/features/credentials";
import { clearCachedData } from "@/features/library";
import { ensureEngineSession } from "@/features/playback";
import { useSettings } from "@/features/settings";
import { spotifyEngine } from "@/modules/spotify-engine";
import ContentContainer from "@/shared/components/ContentContainer";
import CustomScrollView from "@/shared/components/CustomScrollView";
import { StyledButton } from "@/shared/components/StyledButton";
import { ToggleSwitch } from "@/shared/components/ToggleSwitch";
import { n } from "@/shared/utils";
import { logError } from "@/shared/utils/logger";

const ENGINE_LOG_RELEVANCE =
  /error|unavailable|denied|forbidden|token|audio key|country|premium|load|restrict/i;

type SettingsItem =
  | {
      type: "toggle";
      label: string;
      value: boolean;
      onValueChange: (value: boolean) => void;
    }
  | { type: "button"; text: string; onPress: () => void };

export default function SettingsScreen() {
  const { logout } = useAuth();
  const { clearCredentials } = useCredentials();
  const { useBuiltInEngine, setUseBuiltInEngine } = useSettings();
  const router = useRouter();
  const params = useLocalSearchParams<{
    confirmed?: string;
    action?: string;
  }>();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isEngineLoginBusy, setIsEngineLoginBusy] = useState(false);

  const handleBuiltInEngineToggle = useCallback(
    async (value: boolean) => {
      if (!value) {
        setUseBuiltInEngine(false);
        spotifyEngine.pause().catch(() => undefined);
        return;
      }
      if (isEngineLoginBusy) {
        return;
      }
      setIsEngineLoginBusy(true);
      try {
        let loggedIn = await ensureEngineSession();
        if (!loggedIn) {
          ToastAndroid.show(
            "Log in to Spotify to continue",
            ToastAndroid.SHORT
          );
          const result = await spotifyEngine.loginInteractive();
          loggedIn = result.loggedIn;
          if (!loggedIn) {
            ToastAndroid.show("Login cancelled", ToastAndroid.SHORT);
            return;
          }
        }
        setUseBuiltInEngine(true);
        ToastAndroid.show("Built-in player enabled", ToastAndroid.SHORT);
      } catch (error) {
        logError("Engine login failed:", error);
        ToastAndroid.show(
          "Couldn't log in to the built-in player",
          ToastAndroid.LONG
        );
      } finally {
        setIsEngineLoginBusy(false);
      }
    },
    [isEngineLoginBusy, setUseBuiltInEngine]
  );

  const handleEngineDiagnostics = useCallback(async () => {
    try {
      const [metrics, loggedIn, sessionConnected, recentLogs] =
        await Promise.all([
          spotifyEngine.getDebugMetrics(),
          spotifyEngine.isLoggedIn(),
          spotifyEngine.isSessionConnected(),
          spotifyEngine.getRecentLogs(),
        ]);
      const lines = [
        `logged in: ${loggedIn}`,
        `session connected: ${sessionConnected}`,
        `sink backend: ${metrics.sinkBackend}`,
        `audio write errors: ${metrics.audiotrackWriteErrors}`,
        `ring occupancy: ${metrics.ringOccupancyMs} ms`,
        `pending output: ${metrics.pendingOutputMs} ms`,
        `stall events: ${metrics.stallEvents}`,
      ];
      // The load-failure reason lives in librespot's own log lines; show the
      // most relevant recent ones so the cause is visible without a logcat.
      const relevant = recentLogs.filter((entry) =>
        ENGINE_LOG_RELEVANCE.test(entry)
      );
      const tail = (relevant.length > 0 ? relevant : recentLogs).slice(-12);
      if (tail.length > 0) {
        lines.push("", "recent engine logs:", ...tail);
      }
      Alert.alert("Engine Diagnostics", lines.join("\n"));
    } catch (error) {
      logError("Engine diagnostics failed:", error);
      ToastAndroid.show("Couldn't read engine diagnostics", ToastAndroid.SHORT);
    }
  }, []);

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
    router.push("/customise" as never);
  };

  const handleRecentlyPlayed = () => {
    router.push("/recently-played" as never);
  };

  const handleLogoutConfirmed = useCallback(async () => {
    setIsLoggingOut(true);
    await logout();
    router.replace("/login");
  }, [logout, router]);

  const handleResetCredentialsConfirmed = useCallback(async () => {
    setIsLoggingOut(true);
    await logout();
    await clearCredentials();
    router.replace("/login");
  }, [logout, clearCredentials, router]);

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
  }, [
    params.confirmed,
    params.action,
    handleLogoutConfirmed,
    handleResetCredentialsConfirmed,
    router,
  ]);

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

  const settingsItems: SettingsItem[] = [
    { type: "button", text: "Customise", onPress: handleCustomise },
    {
      type: "button",
      text: "Recently Played",
      onPress: handleRecentlyPlayed,
    },
    {
      type: "toggle",
      label: "Built-in Player (Beta)",
      value: useBuiltInEngine,
      onValueChange: handleBuiltInEngineToggle,
    },
    ...(useBuiltInEngine
      ? [
          {
            type: "button" as const,
            text: "Engine Diagnostics",
            onPress: handleEngineDiagnostics,
          },
        ]
      : []),
    { type: "button", text: "Clear Cache", onPress: handleClearCache },
    {
      type: "button",
      text: "Reset API Credentials",
      onPress: handleResetCredentials,
    },
    { type: "button", text: "Logout", onPress: handleLogout },
  ];

  const renderItem = ({ item }: { item: SettingsItem }) => {
    if (item.type === "toggle") {
      return (
        <ToggleSwitch
          label={item.label}
          onValueChange={item.onValueChange}
          value={item.value}
        />
      );
    }
    return <StyledButton onPress={item.onPress} text={item.text} />;
  };

  return (
    <ContentContainer
      headerTitle={`Settings (v${nativeApplicationVersion})`}
      hideBackButton={true}
      style={{ paddingHorizontal: n(37), paddingBottom: n(20), gap: 0 }}
    >
      <CustomScrollView
        data={settingsItems}
        ItemSeparatorComponent={() => <View style={{ height: n(47) }} />}
        keyExtractor={(item: SettingsItem) =>
          item.type === "toggle" ? item.label : item.text
        }
        overScrollMode="never"
        renderItem={renderItem}
      />
    </ContentContainer>
  );
}
