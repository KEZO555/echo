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

// Ignore quick skips - only record something listened to for a real stretch.
const MIN_SECONDS = 20;

type Meta = Omit<PlayEvent, "at" | "seconds">;

interface Current {
  meta: Meta;
  // Seconds banked from finished play segments.
  bankedSeconds: number;
  // Wall-clock ms when the current play segment started, or null while paused.
  playingSince: number | null;
}

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

const elapsedSeconds = (current: Current): number =>
  current.bankedSeconds +
  (current.playingSince === null
    ? 0
    : (Date.now() - current.playingSince) / 1000);

/**
 * App-wide listening logger, powering the Your Listening stats. Fully
 * event-driven (no polling): it reacts to App Remote player-state changes and
 * measures listened time from play/pause/track-change transitions, so it costs
 * no battery while a track plays uninterrupted.
 */
export function PlayHistoryWatcher() {
  const { snapshot } = useLivePlaybackState();
  const logEvent = usePlayHistoryStore((s) => s.logEvent);
  const hydrate = usePlayHistoryStore((s) => s.hydrate);
  const currentRef = useRef<Current | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const flush = () => {
      const current = currentRef.current;
      if (current) {
        const seconds = elapsedSeconds(current);
        if (seconds >= MIN_SECONDS) {
          logEvent({
            ...current.meta,
            at: Date.now(),
            seconds: Math.round(seconds),
          });
        }
      }
    };

    const meta = snapshot ? buildMeta(snapshot) : null;
    const current = currentRef.current;

    if (!(snapshot && meta)) {
      flush();
      currentRef.current = null;
      return;
    }

    // New item: bank the previous one and start fresh.
    if (current?.meta.uri !== meta.uri) {
      flush();
      currentRef.current = {
        meta,
        bankedSeconds: 0,
        playingSince: snapshot.isPlaying ? Date.now() : null,
      };
      return;
    }

    // Same item: reconcile play/pause transitions.
    if (snapshot.isPlaying && current.playingSince === null) {
      current.playingSince = Date.now();
    } else if (!snapshot.isPlaying && current.playingSince !== null) {
      current.bankedSeconds += (Date.now() - current.playingSince) / 1000;
      current.playingSince = null;
    }
  }, [snapshot, logEvent]);

  // Bank whatever is in progress when the app tears this down.
  useEffect(() => {
    return () => {
      const current = currentRef.current;
      if (!current) {
        return;
      }
      const seconds = elapsedSeconds(current);
      if (seconds >= MIN_SECONDS) {
        logEvent({
          ...current.meta,
          at: Date.now(),
          seconds: Math.round(seconds),
        });
      }
    };
  }, [logEvent]);

  return null;
}
