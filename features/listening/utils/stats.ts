import type { PlayEvent } from "../stores/usePlayHistoryStore";

const DAY_MS = 86_400_000;

export type StatsRange = "week" | "month" | "all";

export interface AggregatedItem {
  key: string;
  name: string;
  subtitle: string;
  seconds: number;
  plays: number;
}

export const filterByRange = (
  events: PlayEvent[],
  range: StatsRange
): PlayEvent[] => {
  if (range === "all") {
    return events;
  }
  const days = range === "week" ? 7 : 30;
  const cutoff = Date.now() - days * DAY_MS;
  return events.filter((event) => event.at >= cutoff);
};

export const totalMinutes = (events: PlayEvent[]): number =>
  Math.round(events.reduce((sum, event) => sum + event.seconds, 0) / 60);

const aggregate = (
  events: PlayEvent[],
  keyOf: (event: PlayEvent) => string,
  nameOf: (event: PlayEvent) => string,
  subtitleOf: (event: PlayEvent) => string,
  limit: number
): AggregatedItem[] => {
  const map = new Map<string, AggregatedItem>();
  for (const event of events) {
    const key = keyOf(event);
    const existing = map.get(key);
    if (existing) {
      existing.seconds += event.seconds;
      existing.plays += 1;
    } else {
      map.set(key, {
        key,
        name: nameOf(event),
        subtitle: subtitleOf(event),
        seconds: event.seconds,
        plays: 1,
      });
    }
  }
  return [...map.values()]
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, limit);
};

export const topTracks = (events: PlayEvent[], limit = 10): AggregatedItem[] =>
  aggregate(
    events.filter((event) => event.type === "track"),
    (event) => event.uri,
    (event) => event.name,
    (event) => event.subtitle,
    limit
  );

export const topShows = (events: PlayEvent[], limit = 10): AggregatedItem[] =>
  aggregate(
    events.filter((event) => event.type === "episode"),
    (event) => event.showUri ?? event.subtitle,
    (event) => event.subtitle,
    () => "",
    limit
  );

// Consecutive days (ending today or yesterday) with any listening.
export const listeningStreak = (events: PlayEvent[]): number => {
  if (events.length === 0) {
    return 0;
  }
  const days = new Set(events.map((event) => Math.floor(event.at / DAY_MS)));
  let day = Math.floor(Date.now() / DAY_MS);
  if (!days.has(day)) {
    day -= 1;
    if (!days.has(day)) {
      return 0;
    }
  }
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day -= 1;
  }
  return streak;
};

export const formatListenTime = (seconds: number): string => {
  const totalMinutesValue = Math.round(seconds / 60);
  if (totalMinutesValue < 60) {
    return `${totalMinutesValue} min`;
  }
  const hours = Math.floor(totalMinutesValue / 60);
  const minutes = totalMinutesValue % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
};
