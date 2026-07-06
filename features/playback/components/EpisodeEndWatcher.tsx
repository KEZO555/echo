import { useEffect, useRef } from "react";
import { useSettings } from "@/features/settings";
import { logError } from "@/shared/utils/logger";
import { usePlayback } from "../contexts/PlaybackContext";
import { useLivePlaybackState } from "../hooks/useLivePlaybackState";
import type { PlaybackSnapshot } from "../services/playerState";

// Pause just before the end so we beat Spotify's auto-advance to the next
// episode.
const END_GUARD_MS = 1500;
// Once we have stopped an episode, only re-arm if it is playing again from
// meaningfully before the end (e.g. the user replayed it).
const REARM_MS = 4000;

type EndAction = "stop" | "rearm" | "none";

const evaluateEpisodeEnd = (
  snap: PlaybackSnapshot,
  stoppedUri: string | null
): { action: EndAction; uri: string | null } => {
  if (snap.currentlyPlayingType !== "episode" || !snap.isPlaying) {
    return { action: "none", uri: null };
  }
  const uri = snap.track?.uri ?? null;
  const duration = snap.track?.duration_ms ?? 0;
  if (!uri || duration <= 0) {
    return { action: "none", uri: null };
  }
  const positionMs = snap.progressMs + (Date.now() - snap.receivedAt);
  if (stoppedUri === uri) {
    return positionMs < duration - REARM_MS
      ? { action: "rearm", uri }
      : { action: "none", uri };
  }
  if (positionMs >= duration - END_GUARD_MS) {
    return { action: "stop", uri };
  }
  return { action: "none", uri };
};

/**
 * App-wide guard that stops podcast playback at the end of an episode instead
 * of letting Spotify roll on to the next one. Runs regardless of which screen
 * is open (the Now Playing screen is not always mounted), driven by the App
 * Remote player-state stream plus local interpolation between events.
 */
export function EpisodeEndWatcher() {
  const { snapshot } = useLivePlaybackState();
  const { stopEpisodesAtEnd } = useSettings();
  const { pausePlayback } = usePlayback();

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const stopEnabledRef = useRef(stopEpisodesAtEnd);
  stopEnabledRef.current = stopEpisodesAtEnd;
  const stoppedUriRef = useRef<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const snap = snapshotRef.current;
      if (!(snap && stopEnabledRef.current)) {
        return;
      }
      const { action, uri } = evaluateEpisodeEnd(snap, stoppedUriRef.current);
      if (action === "rearm") {
        stoppedUriRef.current = null;
        return;
      }
      if (action === "stop" && uri) {
        stoppedUriRef.current = uri;
        pausePlayback().catch((error) =>
          logError("EpisodeEndWatcher: failed to stop finished episode", error)
        );
      }
    }, 1000);

    return () => clearInterval(id);
  }, [pausePlayback]);

  return null;
}
