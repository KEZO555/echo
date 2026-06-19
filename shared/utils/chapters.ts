export interface EpisodeChapter {
  title: string;
  positionMs: number;
}

const LEADING_TIMESTAMP =
  /^[([]?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*[)\]]?\s*(?:[-–—:.]\s*|\s+)(.+)$/;

const TRAILING_TIMESTAMP =
  /^(.+?)\s*(?:[-–—:]\s*)?[([]?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*[)\]]?$/;

const TITLE_LEADING_TRIM = /^[\s\-–—:.*•|]+/;
const TITLE_TRAILING_TRIM = /[\s\-–—:|]+$/;
const WHITESPACE = /\s+/g;
const LINE_SPLIT = /\r?\n/;

const HTML_BREAK = /<\s*(?:br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi;
const HTML_TAG = /<[^>]+>/g;
const HTML_ENTITY = /&(amp|lt|gt|quot|#0?39|apos|nbsp);/g;
const INLINE_TIMESTAMP = /(?:^|[\s([])((?:\d{1,2}:)?\d{1,2}:\d{2})[)\]]?/g;

const ENTITY_VALUES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  "#039": "'",
  apos: "'",
  nbsp: " ",
};

const normaliseText = (input: string): string =>
  input
    .replace(HTML_BREAK, "\n")
    .replace(HTML_TAG, "")
    .replace(
      HTML_ENTITY,
      (_match, entity: string) => ENTITY_VALUES[entity] ?? _match
    );

const timestampToMs = (timestamp: string): number => {
  const parts = timestamp.split(":").map(Number);
  if (parts.length === 3) {
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  if (parts.length === 2) {
    return (parts[0] * 60 + parts[1]) * 1000;
  }
  return 0;
};

const toMs = (first: string, second: string, third?: string): number => {
  if (third !== undefined) {
    return (Number(first) * 3600 + Number(second) * 60 + Number(third)) * 1000;
  }
  return (Number(first) * 60 + Number(second)) * 1000;
};

const cleanTitle = (raw: string): string =>
  raw
    .replace(TITLE_LEADING_TRIM, "")
    .replace(TITLE_TRAILING_TRIM, "")
    .replace(WHITESPACE, " ")
    .trim();

const collectLeadingChapters = (lines: string[]): EpisodeChapter[] => {
  const chapters: EpisodeChapter[] = [];
  for (const line of lines) {
    const match = LEADING_TIMESTAMP.exec(line.trim());
    if (!match) {
      continue;
    }
    const title = cleanTitle(match[4]);
    if (title) {
      chapters.push({ title, positionMs: toMs(match[1], match[2], match[3]) });
    }
  }
  return chapters;
};

const collectTrailingChapters = (lines: string[]): EpisodeChapter[] => {
  const chapters: EpisodeChapter[] = [];
  for (const line of lines) {
    const match = TRAILING_TIMESTAMP.exec(line.trim());
    if (!match) {
      continue;
    }
    const title = cleanTitle(match[1]);
    if (title) {
      chapters.push({ title, positionMs: toMs(match[2], match[3], match[4]) });
    }
  }
  return chapters;
};

const collectInlineChapters = (text: string): EpisodeChapter[] => {
  const chapters: EpisodeChapter[] = [];
  const matches = [...text.matchAll(INLINE_TIMESTAMP)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const matchIndex = match.index ?? 0;
    const contentStart = matchIndex + match[0].length;
    const contentEnd =
      i + 1 < matches.length
        ? (matches[i + 1].index ?? text.length)
        : text.length;
    const firstLine = text.slice(contentStart, contentEnd).split("\n")[0];
    const title = cleanTitle(firstLine);
    if (title) {
      chapters.push({ title, positionMs: timestampToMs(match[1]) });
    }
  }

  return chapters;
};

const finaliseChapters = (
  chapters: EpisodeChapter[],
  durationMs: number
): EpisodeChapter[] => {
  const sorted = chapters
    .filter(
      (chapter) =>
        chapter.positionMs >= 0 &&
        (durationMs <= 0 || chapter.positionMs <= durationMs)
    )
    .sort((a, b) => a.positionMs - b.positionMs);

  const deduped: EpisodeChapter[] = [];
  for (const chapter of sorted) {
    if (
      !deduped.some((existing) => existing.positionMs === chapter.positionMs)
    ) {
      deduped.push(chapter);
    }
  }

  return deduped.length >= 2 ? deduped : [];
};

export const parseEpisodeChapters = (
  description: string | undefined,
  durationMs: number
): EpisodeChapter[] => {
  if (!description) {
    return [];
  }

  const text = normaliseText(description);
  const lines = text.split(LINE_SPLIT);

  const leading = collectLeadingChapters(lines);
  if (leading.length >= 2) {
    return finaliseChapters(leading, durationMs);
  }

  const trailing = collectTrailingChapters(lines);
  if (trailing.length >= 2) {
    return finaliseChapters(trailing, durationMs);
  }

  const inline = collectInlineChapters(text);
  if (inline.length >= 2) {
    return finaliseChapters(inline, durationMs);
  }

  return [];
};

export const getCurrentChapterIndex = (
  chapters: EpisodeChapter[],
  positionMs: number
): number => {
  let index = -1;
  for (const [i, chapter] of chapters.entries()) {
    if (positionMs >= chapter.positionMs) {
      index = i;
    } else {
      break;
    }
  }
  return index;
};
