import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/features/settings";
import { spotify } from "@/modules/spotify-sdk";
import { log } from "@/shared/utils/logger";
import {
  getEngineSnapshot,
  subscribeEngineChanges,
} from "../services/engineState";
import {
  type PlaybackSnapshot,
  toPlaybackSnapshot,
} from "../services/playerState";

interface LivePlaybackStateResult {
  snapshot: PlaybackSnapshot | null;
  hasResolvedInitialState: boolean;
}

export function useLivePlaybackState(): LivePlaybackStateResult {
  const { useBuiltInEngine } = useSettings();
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot | null>(null);
  const [hasResolvedInitialState, setHasResolvedInitialState] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const hasReceivedLiveEventRef = useRef(false);

  // Built-in engine: playback state comes straight from engine events.
  useEffect(() => {
    if (!useBuiltInEngine) {
      return;
    }
    const update = () => {
      setSnapshot(getEngineSnapshot());
      setHasResolvedInitialState(true);
    };
    const unsubscribe = subscribeEngineChanges(update);
    update();
    return unsubscribe;
  }, [useBuiltInEngine]);

  useEffect(() => {
    if (useBuiltInEngine) {
      return;
    }
    let cancelled = false;

    spotify
      .isConnected()
      .then((connected) => {
        if (!cancelled) {
          setIsConnected(connected);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsConnected(false);
        }
      });

    const unsubscribe = spotify.onConnectionChanged((connected) => {
      setIsConnected(connected);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [useBuiltInEngine]);

  useEffect(() => {
    if (useBuiltInEngine) {
      return;
    }
    const unsubscribe = spotify.onPlayerStateChanged((playerState) => {
      hasReceivedLiveEventRef.current = true;
      setSnapshot(toPlaybackSnapshot(playerState));
      setHasResolvedInitialState(true);
    });

    return unsubscribe;
  }, [useBuiltInEngine]);

  useEffect(() => {
    if (useBuiltInEngine || isConnected === null) {
      return;
    }

    if (!isConnected) {
      hasReceivedLiveEventRef.current = false;
      setSnapshot(null);
      setHasResolvedInitialState(true);
      return;
    }

    let cancelled = false;
    hasReceivedLiveEventRef.current = false;
    setHasResolvedInitialState(false);

    const loadInitialState = async () => {
      try {
        const playerState = await spotify.getPlayerState();

        if (cancelled || hasReceivedLiveEventRef.current) {
          return;
        }

        setSnapshot(
          playerState?.track ? toPlaybackSnapshot(playerState) : null
        );
      } catch (error) {
        if (!(cancelled || hasReceivedLiveEventRef.current)) {
          log("Playback: Failed to seed live playback state:", error);
          setSnapshot(null);
        }
      } finally {
        if (!(cancelled || hasReceivedLiveEventRef.current)) {
          setHasResolvedInitialState(true);
        }
      }
    };

    loadInitialState();

    return () => {
      cancelled = true;
    };
  }, [isConnected, useBuiltInEngine]);

  return { snapshot, hasResolvedInitialState };
}
