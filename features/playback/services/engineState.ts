import { ToastAndroid } from "react-native";
import {
  type EnginePlayerEvent,
  spotifyEngine,
} from "@/modules/spotify-engine";
import type {
  SpotifyCurrentlyPlaying,
  SpotifyEpisode,
  SpotifyTrackSimple,
} from "@/shared/types/spotify";
import { apiGet } from "@/shared/utils/api-client";
import { log, logError } from "@/shared/utils/logger";
import type { PlaybackSnapshot } from "./playerState";

export type EngineItem = SpotifyTrackSimple | SpotifyEpisode;

// Mirror of the engine's now-playing state, updated by native events. The
// engine only reports URIs; track/episode metadata is filled in from the
// Web API and cached so repeated lookups stay off the network.
const nowPlaying = {
  uri: null as string | null,
  isPlaying: false,
  positionMs: 0,
  receivedAt: 0,
};

const metadataByUri = new Map<string, EngineItem>();
const inFlightMetadata = new Map<string, Promise<EngineItem | null>>();
const listeners = new Set<() => void>();
let eventsInitialised = false;

const ENGINE_DEVICE: SpotifyCurrentlyPlaying["device"] = {
  id: "echo_builtin_engine",
  is_active: true,
  is_private_session: false,
  is_restricted: false,
  name: "Echo Built-in Player",
  type: "smartphone",
  volume_percent: 100,
  supports_volume: true,
  uri: "spotify:device:echo_builtin_engine",
};

const notifyListeners = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

const getIdFromUri = (uri: string): string => uri.split(":").pop() ?? "";

const isEpisodeUri = (uri: string): boolean =>
  uri.startsWith("spotify:episode:");

export const fetchEngineItem = async (
  uri: string
): Promise<EngineItem | null> => {
  const cached = metadataByUri.get(uri);
  if (cached) {
    return cached;
  }
  const existing = inFlightMetadata.get(uri);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    const id = getIdFromUri(uri);
    const endpoint = isEpisodeUri(uri)
      ? `https://api.spotify.com/v1/episodes/${id}`
      : `https://api.spotify.com/v1/tracks/${id}`;
    const item = await apiGet<EngineItem>(endpoint);
    if (item) {
      metadataByUri.set(uri, item);
    }
    return item;
  })();

  inFlightMetadata.set(uri, request);
  try {
    return await request;
  } catch (error) {
    logError("Engine: failed to fetch item metadata:", error);
    return null;
  } finally {
    inFlightMetadata.delete(uri);
  }
};

const BATCH_LIMIT = 50;

const batchFetch = async (endpoint: string, ids: string[]): Promise<void> => {
  for (let offset = 0; offset < ids.length; offset += BATCH_LIMIT) {
    const chunk = ids.slice(offset, offset + BATCH_LIMIT);
    const response = await apiGet<Record<string, (EngineItem | null)[]>>(
      `https://api.spotify.com/v1/${endpoint}?ids=${chunk.join(",")}`
    );
    const items = response?.[endpoint] ?? [];
    for (const item of items) {
      if (item?.uri) {
        metadataByUri.set(item.uri, item);
      }
    }
  }
};

/** Batch-resolve metadata for a list of URIs, preserving input order. */
export const fetchEngineItems = async (
  uris: string[]
): Promise<EngineItem[]> => {
  const missingTrackIds: string[] = [];
  const missingEpisodeIds: string[] = [];
  for (const uri of uris) {
    if (metadataByUri.has(uri)) {
      continue;
    }
    if (isEpisodeUri(uri)) {
      missingEpisodeIds.push(getIdFromUri(uri));
    } else if (uri.startsWith("spotify:track:")) {
      missingTrackIds.push(getIdFromUri(uri));
    }
  }

  try {
    if (missingTrackIds.length > 0) {
      await batchFetch("tracks", missingTrackIds);
    }
    if (missingEpisodeIds.length > 0) {
      await batchFetch("episodes", missingEpisodeIds);
    }
  } catch (error) {
    logError("Engine: batch metadata fetch failed:", error);
  }

  const items: EngineItem[] = [];
  for (const uri of uris) {
    const item = metadataByUri.get(uri);
    if (item) {
      items.push(item);
    }
  }
  return items;
};

// Beta diagnostics: the engine otherwise skips failed tracks silently, which
// is indistinguishable from a stall. Surface the actual failure event so it is
// diagnosable on-device without a logcat. Debounced so a burst of skips does
// not spam toasts.
const DIAGNOSTIC_DEBOUNCE_MS = 4000;
let lastDiagnosticAt = 0;

const surfaceDiagnostic = (message: string): void => {
  const now = Date.now();
  if (now - lastDiagnosticAt < DIAGNOSTIC_DEBOUNCE_MS) {
    return;
  }
  lastDiagnosticAt = now;
  ToastAndroid.show(message, ToastAndroid.LONG);
};

const applyPositionEvent = (event: EnginePlayerEvent): void => {
  if (typeof event.positionMs === "number") {
    nowPlaying.positionMs = event.positionMs;
    nowPlaying.receivedAt = Date.now();
  }
};

const handleTrackChanged = (uri: string | undefined): void => {
  nowPlaying.uri = uri ?? null;
  nowPlaying.positionMs = 0;
  nowPlaying.receivedAt = Date.now();
  if (nowPlaying.uri && !metadataByUri.has(nowPlaying.uri)) {
    // Re-notify once metadata lands so screens can swap in the real title.
    fetchEngineItem(nowPlaying.uri)
      .then(() => notifyListeners())
      .catch(() => undefined);
  }
};

const handleEngineEvent = (event: EnginePlayerEvent): void => {
  switch (event.type) {
    case "trackChanged":
      handleTrackChanged(event.uri);
      break;
    case "playing":
      nowPlaying.isPlaying = true;
      applyPositionEvent(event);
      break;
    case "paused":
      nowPlaying.isPlaying = false;
      applyPositionEvent(event);
      break;
    case "positionChanged":
      applyPositionEvent(event);
      break;
    case "unavailable":
      logError("Engine: track unavailable:", event.uri);
      surfaceDiagnostic("Engine: track unavailable — couldn't load audio");
      break;
    case "connectionLost":
      log("Engine: connection lost");
      surfaceDiagnostic("Engine: connection lost");
      break;
    case "error":
      logError("Engine: player error:", event.message);
      surfaceDiagnostic(`Engine error: ${event.message ?? "unknown"}`);
      break;
    default:
      break;
  }
  notifyListeners();
};

export const initEngineEvents = (): void => {
  if (eventsInitialised) {
    return;
  }
  eventsInitialised = true;
  spotifyEngine.addListener("onEnginePlayerEvent", handleEngineEvent);
};

/**
 * Make sure the engine has a logged-in session, restoring cached
 * credentials if needed. Returns false when an interactive login is
 * required.
 */
export const ensureEngineSession = async (): Promise<boolean> => {
  initEngineEvents();
  try {
    if (await spotifyEngine.isLoggedIn()) {
      return true;
    }
    const result = await spotifyEngine.loginWithCachedCredentials();
    return result.loggedIn;
  } catch (error) {
    logError("Engine: failed to restore session:", error);
    return false;
  }
};

export const subscribeEngineChanges = (callback: () => void): (() => void) => {
  initEngineEvents();
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

const extrapolatedPositionMs = (): number => {
  if (!nowPlaying.isPlaying) {
    return nowPlaying.positionMs;
  }
  return nowPlaying.positionMs + (Date.now() - nowPlaying.receivedAt);
};

export const getEngineNowPlayingUri = (): string | null => nowPlaying.uri;

export const getEngineSnapshot = (): PlaybackSnapshot | null => {
  if (!nowPlaying.uri) {
    return null;
  }
  return {
    track: metadataByUri.get(nowPlaying.uri) ?? null,
    isPlaying: nowPlaying.isPlaying,
    progressMs: extrapolatedPositionMs(),
    receivedAt: Date.now(),
    currentlyPlayingType: isEpisodeUri(nowPlaying.uri) ? "episode" : "track",
  };
};

const getEngineModes = async (): Promise<{
  shuffle: boolean;
  repeat: SpotifyCurrentlyPlaying["repeat_state"];
}> => {
  try {
    const [shuffle, repeat] = await Promise.all([
      spotifyEngine.getShuffle(),
      spotifyEngine.getRepeatMode(),
    ]);
    return { shuffle, repeat };
  } catch (error) {
    log("Engine: failed to read shuffle/repeat state:", error);
    return { shuffle: false, repeat: "off" };
  }
};

export const getEngineCurrentlyPlaying =
  async (): Promise<SpotifyCurrentlyPlaying | null> => {
    const uri = nowPlaying.uri;
    if (!uri) {
      return null;
    }
    const item = await fetchEngineItem(uri);
    if (!item) {
      return null;
    }
    const { shuffle, repeat } = await getEngineModes();
    return {
      timestamp: Date.now(),
      context: null,
      progress_ms: extrapolatedPositionMs(),
      is_playing: nowPlaying.isPlaying,
      item,
      currently_playing_type: isEpisodeUri(uri) ? "episode" : "track",
      actions: { disallows: {} },
      device: ENGINE_DEVICE,
      shuffle_state: shuffle,
      repeat_state: repeat,
    };
  };
