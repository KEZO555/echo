import type { SpotifyEpisode, SpotifySavedShow } from "@/shared/types/spotify";
import { apiGet } from "@/shared/utils/api-client";

export interface NewEpisodeEntry {
  episode: SpotifyEpisode;
  showId: string;
  showName: string;
}

interface FetchNewEpisodesOptions {
  /** How many followed shows to query (each is one request). */
  showLimit?: number;
  /** How many recent episodes to take from each show. */
  perShow?: number;
  /** Cap on the merged, date-sorted result. */
  resultLimit?: number;
  /**
   * Called with the running, sorted result each time a show responds, so the
   * UI can fill in progressively instead of waiting for every request.
   */
  onPartial?: (entries: NewEpisodeEntry[]) => void;
}

const byNewest = (a: NewEpisodeEntry, b: NewEpisodeEntry): number =>
  (b.episode.release_date ?? "").localeCompare(a.episode.release_date ?? "");

/**
 * Fetch the most recent episode(s) from each followed show and merge them into
 * a single list sorted newest-first. Emits partial results as each show's
 * request lands (via onPartial) so the list appears quickly rather than after
 * the slowest of ~50 requests. Used for the Home preview and the full New
 * Episodes screen.
 */
export const fetchNewEpisodesForShows = async (
  shows: SpotifySavedShow[],
  options: FetchNewEpisodesOptions = {}
): Promise<NewEpisodeEntry[]> => {
  const { showLimit = 50, perShow = 1, resultLimit = 50, onPartial } = options;
  const limited = shows.slice(0, showLimit);
  const collected: NewEpisodeEntry[] = [];

  const snapshot = (): NewEpisodeEntry[] =>
    [...collected].sort(byNewest).slice(0, resultLimit);

  await Promise.all(
    limited.map(async (entry) => {
      try {
        const data = await apiGet<{ items: SpotifyEpisode[] }>(
          `https://api.spotify.com/v1/shows/${entry.show.id}/episodes?limit=${perShow}&market=from_token`
        );
        const mapped = (data?.items ?? [])
          .filter((episode): episode is SpotifyEpisode => Boolean(episode?.id))
          .map((episode) => ({
            episode,
            showId: entry.show.id,
            showName: entry.show.name,
          }));
        if (mapped.length > 0) {
          collected.push(...mapped);
          onPartial?.(snapshot());
        }
      } catch {
        // A single show failing shouldn't abort the rest.
      }
    })
  );

  return snapshot();
};
