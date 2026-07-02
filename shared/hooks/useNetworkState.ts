import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

const APP_STATE_PATTERN = /inactive|background/;

// Rely on the OS's own connectivity signal instead of polling an HTTP
// endpoint every 30 seconds (and every 2 seconds while flapping), which
// kept the radio awake for the app's entire lifetime.
NetInfo.configure({
  useNativeReachability: true,
});

type Listener = (isOnline: boolean | null) => void;

let globalIsOnline: boolean | null = null;
const listeners = new Set<Listener>();
let isInitialised = false;

function initialiseNetworkListener() {
  if (isInitialised) {
    return;
  }
  isInitialised = true;

  NetInfo.addEventListener((state: NetInfoState) => {
    globalIsOnline = state.isInternetReachable === true;
    for (const listener of listeners) {
      listener(globalIsOnline);
    }
  });

  let lastAppState = AppState.currentState;
  AppState.addEventListener("change", (nextAppState) => {
    if (APP_STATE_PATTERN.test(lastAppState) && nextAppState === "active") {
      NetInfo.refresh();
    }
    lastAppState = nextAppState;
  });
}

export function useNetworkState() {
  const [isOnline, setIsOnline] = useState<boolean | null>(globalIsOnline);

  useEffect(() => {
    initialiseNetworkListener();

    const listener: Listener = (online) => setIsOnline(online);
    listeners.add(listener);

    if (globalIsOnline !== null) {
      setIsOnline(globalIsOnline);
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const isLoading = isOnline === null;

  return { isOnline: isOnline === true, isLoading };
}
