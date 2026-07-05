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
}

/**
 * Fetch the most recent episode(s) from each followed show and merge them into
 * a single list sorted newest-first. Used for the Home preview (a few shows,
 * one episode each) and the full New Episodes screen (all shows).
 */
export const fetchNewEpisodesForShows = async (
  shows: SpotifySavedShow[],
  options: FetchNewEpisodesOptions = {}
): Promise<NewEpisodeEntry[]> => {
  const { showLimit = 50, perShow = 1, resultLimit = 50 } = options;
  const limited = shows.slice(0, showLimit);

  const results = await Promise.all(
    limited.map(async (entry) => {
      try {
        const data = await apiGet<{ items: SpotifyEpisode[] }>(
          `https://api.spotify.com/v1/shows/${entry.show.id}/episodes?limit=${perShow}&market=from_token`
        );
        return (data?.items ?? [])
          .filter((episode): episode is SpotifyEpisode => Boolean(episode?.id))
          .map((episode) => ({
            episode,
            showId: entry.show.id,
            showName: entry.show.name,
          }));
      } catch {
        return [];
      }
    })
  );

  return results
    .flat()
    .sort((a, b) =>
      (b.episode.release_date ?? "").localeCompare(a.episode.release_date ?? "")
    )
    .slice(0, resultLimit);
};
