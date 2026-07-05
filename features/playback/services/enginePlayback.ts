import { spotifyEngine } from "@/modules/spotify-engine";
import type { SpotifyQueueResponse } from "@/shared/types/spotify";
import { apiGet } from "@/shared/utils/api-client";
import { log, logError } from "@/shared/utils/logger";
import { fetchEngineItem, fetchEngineItems } from "./engineState";
import type { PlayContextOptions, SourceContext } from "./spotifyPlayback";

// The engine plays explicit URI lists, not context URIs, so contexts are
// resolved to their tracks via the Web API first. Capped to keep the
// resolution fetch bounded; longer contexts play their first 200 items.
const MAX_CONTEXT_TRACKS = 200;
const QUEUE_PREVIEW_LIMIT = 20;

const getIdFromUri = (uri: string): string => uri.split(":").pop() ?? "";

type UriExtractor = (entry: unknown) => string | null;

const extractOwnUri: UriExtractor = (entry) =>
  (entry as { uri?: string }).uri ?? null;

const extractPlaylistItemUri: UriExtractor = (entry) =>
  (entry as { item?: { uri?: string } | null }).item?.uri ?? null;

const extractSavedTrackUri: UriExtractor = (entry) =>
  (entry as { track?: { uri?: string } | null }).track?.uri ?? null;

interface ContextPage {
  items: unknown[];
  next: string | null;
}

const fetchPagedUris = async (
  firstUrl: string,
  extract: UriExtractor
): Promise<string[]> => {
  const uris: string[] = [];
  let url: string | null = firstUrl;
  while (url && uris.length < MAX_CONTEXT_TRACKS) {
    const page: ContextPage | null = await apiGet<ContextPage>(url);
    if (!page) {
      break;
    }
    for (const entry of page.items ?? []) {
      const uri = extract(entry);
      if (uri) {
        uris.push(uri);
      }
    }
    url = page.next;
  }
  if (uris.length >= MAX_CONTEXT_TRACKS) {
    log(`Engine: context capped at ${MAX_CONTEXT_TRACKS} items`);
  }
  return uris.slice(0, MAX_CONTEXT_TRACKS);
};

const resolveContextUris = async (contextUri: string): Promise<string[]> => {
  const id = getIdFromUri(contextUri);
  if (contextUri.startsWith("spotify:album:")) {
    return await fetchPagedUris(
      `https://api.spotify.com/v1/albums/${id}/tracks?limit=50`,
      extractOwnUri
    );
  }
  if (contextUri.startsWith("spotify:playlist:")) {
    return await fetchPagedUris(
      `https://api.spotify.com/v1/playlists/${id}/items?limit=100`,
      extractPlaylistItemUri
    );
  }
  if (contextUri.startsWith("spotify:show:")) {
    return await fetchPagedUris(
      `https://api.spotify.com/v1/shows/${id}/episodes?limit=50`,
      extractOwnUri
    );
  }
  if (contextUri.includes(":collection")) {
    return await fetchPagedUris(
      "https://api.spotify.com/v1/me/tracks?limit=50",
      extractSavedTrackUri
    );
  }
  return [];
};

const contextLabelFor = (contextUri: string): string | null => {
  if (contextUri.startsWith("spotify:album:")) {
    return "Album";
  }
  if (contextUri.startsWith("spotify:playlist:")) {
    return "Playlist";
  }
  if (contextUri.startsWith("spotify:show:")) {
    return "Podcast";
  }
  if (contextUri.includes(":collection")) {
    return "Liked Songs";
  }
  return null;
};

const resolveStartIndex = (
  uris: string[],
  options?: PlayContextOptions
): number => {
  if (options?.offsetUri) {
    const found = uris.indexOf(options.offsetUri);
    if (found >= 0) {
      return found;
    }
  }
  if (typeof options?.offsetPosition === "number") {
    return Math.min(Math.max(options.offsetPosition, 0), uris.length - 1);
  }
  return 0;
};

export const enginePlayContext = async (
  contextUri: string,
  options?: PlayContextOptions
): Promise<void> => {
  const uris = await resolveContextUris(contextUri);
  if (uris.length === 0) {
    throw new Error(`Engine: nothing playable in context ${contextUri}`);
  }
  const startIndex = resolveStartIndex(uris, options);
  await spotifyEngine.playUris(uris, startIndex, contextLabelFor(contextUri));
  if (typeof options?.positionMs === "number" && options.positionMs > 0) {
    await spotifyEngine.seek(Math.floor(options.positionMs));
  }
};

export const enginePlayTracks = async (uris: string[]): Promise<void> => {
  if (uris.length === 0) {
    return;
  }
  await spotifyEngine.playUris(uris, 0, null);
};

const extractSourceUris = (sourceContext?: SourceContext): string[] => {
  if (!sourceContext?.tracks?.length) {
    return [];
  }
  const uris: string[] = [];
  for (const entry of sourceContext.tracks) {
    if (!entry) {
      continue;
    }
    if (typeof entry === "string") {
      uris.push(entry);
      continue;
    }
    const uri = entry.uri ?? entry.track?.uri;
    if (uri) {
      uris.push(uri);
    }
  }
  return uris;
};

export const enginePlayTrackWithContext = async (
  trackUri: string,
  sourceContext?: SourceContext
): Promise<void> => {
  const contextTracks = extractSourceUris(sourceContext);
  if (contextTracks.length > 0) {
    const index = contextTracks.indexOf(trackUri);
    await spotifyEngine.playUris(contextTracks, Math.max(index, 0), null);
    return;
  }
  if (sourceContext?.uri) {
    await enginePlayContext(sourceContext.uri, { offsetUri: trackUri });
    return;
  }
  await spotifyEngine.playUri(trackUri);
};

export const enginePlayUriWithSkipToUri = async (
  contextUri: string,
  skipToUri: string
): Promise<void> => {
  try {
    await enginePlayContext(contextUri, { offsetUri: skipToUri });
  } catch (error) {
    log("Engine: context resolution failed, playing track directly:", error);
    await spotifyEngine.playUri(skipToUri);
  }
};

export const engineGetQueue =
  async (): Promise<SpotifyQueueResponse | null> => {
    try {
      const snapshot = await spotifyEngine.getQueue();
      const upNext = [
        ...snapshot.nextInQueue,
        ...snapshot.nextFromContext,
      ].slice(0, QUEUE_PREVIEW_LIMIT);
      const [currentlyPlaying, queueItems] = await Promise.all([
        snapshot.nowPlayingUri
          ? fetchEngineItem(snapshot.nowPlayingUri)
          : Promise.resolve(null),
        fetchEngineItems(upNext),
      ]);
      return { currently_playing: currentlyPlaying, queue: queueItems };
    } catch (error) {
      logError("Engine: failed to read queue:", error);
      return null;
    }
  };

export const engineSetShuffle = async (state: boolean): Promise<void> => {
  const current = await spotifyEngine.getShuffle();
  if (current !== state) {
    await spotifyEngine.toggleShuffle();
  }
};

export const engineSetRepeat = async (
  state: "off" | "context" | "track"
): Promise<void> => {
  let mode = await spotifyEngine.getRepeatMode();
  for (let i = 0; i < 2 && mode !== state; i++) {
    mode = await spotifyEngine.toggleRepeat();
  }
};
