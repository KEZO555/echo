import { useEffect, useRef } from "react";
import type {
  SpotifyEpisode,
  SpotifyTrackSimple,
} from "@/shared/types/spotify";
import { getArtistNames } from "@/shared/utils";
import { useLivePlaybackState } from "../../playback/hooks/useLivePlaybackState";
import type { PlaybackSnapshot } from "../../playback/services/playerState";
import {
  type PlayEvent,
  usePlayHistoryStore,
} from "../stores/usePlayHistoryStore";

// Ignore quick skips - only count something once it has been listened to for a
// meaningful stretch.
const MIN_SECONDS = 20;

type Meta = Omit<PlayEvent, "at" | "seconds">;

const buildMeta = (snapshot: PlaybackSnapshot): Meta | null => {
  const item = snapshot.track;
  if (!item?.uri) {
    return null;
  }
  const isEpisode =
    snapshot.currentlyPlayingType === "episode" || item.type === "episode";
  if (isEpisode) {
    const episode = item as SpotifyEpisode;
    return {
      uri: episode.uri,
      name: episode.name,
      subtitle: episode.show?.name ?? "Podcast",
      type: "episode",
      showUri: episode.show?.uri,
    };
  }
  const track = item as SpotifyTrackSimple;
  return {
    uri: track.uri,
    name: track.name,
    subtitle: getArtistNames(track.artists ?? []),
    type: "track",
  };
};

/**
 * App-wide listening logger. Accumulates how long the current track/episode is
 * actually played and records a history entry when it changes, powering the
 * Your Listening stats. Runs regardless of which screen is open.
 */
export function PlayHistoryWatcher() {
  const { snapshot } = useLivePlaybackState();
  const logEvent = usePlayHistoryStore((s) => s.logEvent);
  const hydrate = usePlayHistoryStore((s) => s.hydrate);

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const currentRef = useRef<{ meta: Meta; seconds: number } | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const flush = () => {
      const current = currentRef.current;
      if (current && current.seconds >= MIN_SECONDS) {
        logEvent({ ...current.meta, at: Date.now(), seconds: current.seconds });
      }
      currentRef.current = null;
    };

    const id = setInterval(() => {
      const snap = snapshotRef.current;
      const meta = snap ? buildMeta(snap) : null;
      if (!(snap && meta)) {
        return;
      }
      if (currentRef.current?.meta.uri !== meta.uri) {
        flush();
        currentRef.current = { meta, seconds: 0 };
      }
      if (snap.isPlaying) {
        currentRef.current.seconds += 1;
      }
    }, 1000);

    return () => {
      flush();
      clearInterval(id);
    };
  }, [logEvent]);

  return null;
}
