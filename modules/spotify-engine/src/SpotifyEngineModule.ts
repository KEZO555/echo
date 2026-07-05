import { requireNativeModule } from "expo-modules-core";

export type EnginePlayerEventType =
  | "trackChanged"
  | "loading"
  | "playing"
  | "paused"
  | "positionChanged"
  | "endOfTrack"
  | "unavailable"
  | "connectionLost"
  | "connectionRestored"
  | "error"
  | "queueChanged"
  | "buffering";

export interface EnginePlayerEvent {
  type: EnginePlayerEventType;
  uri?: string;
  positionMs?: number;
  message?: string;
  stalled?: boolean;
}

/** "high" is 320 kbps Vorbis - the best librespot can request. */
export type EngineStreamingQuality = "low" | "normal" | "high";

export interface EngineDebugMetrics {
  transportReconnect: number;
  fullRebuild: number;
  stallEvents: number;
  sinkRecreate: number;
  audiotrackWriteErrors: number;
  audiotrackRoutingEvents: number;
  sinkBackend: string;
  ringOccupancyMs: number;
  pendingOutputMs: number;
  producerBlockMs: number;
  drainPartialWrites: number;
}

export interface EngineQueueSnapshot {
  nowPlayingUri: string | null;
  nextInQueue: string[];
  contextLabel: string | null;
  nextFromContext: string[];
}

interface SpotifyEngineNative {
  beginLogin(): Promise<string>;
  loginWithOauthCode(code: string): Promise<{ loggedIn: boolean }>;
  loginInteractive(): Promise<{ loggedIn: boolean; cancelled: boolean }>;
  loginWithCachedCredentials(): Promise<{ loggedIn: boolean }>;
  isLoggedIn(): Promise<boolean>;
  logout(): Promise<void>;
  playUri(uri: string): Promise<void>;
  playUris(
    uris: string[],
    startIndex: number,
    contextLabel: string | null
  ): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  getShuffle(): Promise<boolean>;
  toggleShuffle(): Promise<boolean>;
  getRepeatMode(): Promise<"off" | "context" | "track">;
  toggleRepeat(): Promise<"off" | "context" | "track">;
  getQueue(): Promise<EngineQueueSnapshot>;
  addToQueue(uri: string): Promise<void>;
  moveQueueItemUp(index: number): Promise<void>;
  moveQueueItemDown(index: number): Promise<void>;
  moveContextItemUp(index: number): Promise<void>;
  moveContextItemDown(index: number): Promise<void>;
  clearManualQueue(): Promise<void>;
  getVolume(): Promise<number>;
  setVolume(percent: number): Promise<void>;
  getStreamingQuality(): Promise<EngineStreamingQuality>;
  setStreamingQuality(value: EngineStreamingQuality): Promise<void>;
  getGaplessEnabled(): Promise<boolean>;
  setGaplessEnabled(enabled: boolean): Promise<void>;
  getDebugMetrics(): Promise<EngineDebugMetrics>;
  isSessionConnected(): Promise<boolean>;
  forceReconnectCheck(): Promise<void>;
  addListener(
    eventName: "onEnginePlayerEvent",
    listener: (event: EnginePlayerEvent) => void
  ): { remove: () => void };
}

export const SpotifyEngineNativeModule =
  requireNativeModule<SpotifyEngineNative>("SpotifyEngine");
