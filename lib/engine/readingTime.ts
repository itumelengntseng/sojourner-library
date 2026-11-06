// Reading-time engine for The Sojourner Library.
// Plain-language idea: count words exactly, learn how fast Itu actually reads,
// then answer "how long?", "can I finish by…?" and "minutes per day?".

export const DEFAULT_WPM = 230;
export const IDLE_CUTOFF_MS = 2 * 60 * 1000; // gaps over 2 min don't count as reading
const MIN_SESSION_WORDS = 150; // tiny sessions are too noisy to learn from
const MIN_WPM = 60;
const MAX_WPM = 900;

/** Strip Markdown/frontmatter noise and count real words. */
export function countWords(markdown: string): number {
  const body = markdown
    .replace(/^---[\s\S]*?---\s*/, "") // frontmatter
    .replace(/```[\s\S]*?```/g, " ") // code fences
    .replace(/<!--[\s\S]*?-->/g, " ") // comments
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → their text
    .replace(/[#>*_~`|-]+/g, " ");
  const words = body.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu);
  return words ? words.length : 0;
}

export interface ReadingSession {
  wordsRead: number;
  /** timestamps (ms) of reader activity: page turns, scrolls */
  activity: number[];
  endedAt: number;
}

/** Active reading time: sum of gaps between activity, ignoring idle gaps. */
export function activeMs(activity: number[]): number {
  const sorted = [...activity].sort((a, b) => a - b);
  let total = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap <= IDLE_CUTOFF_MS) total += gap;
  }
  return total;
}

/**
 * Personal reading speed: recency-weighted average of session speeds.
 * With no usable sessions it falls back to the default.
 */
export function personalWpm(sessions: ReadingSession[], halfLifeDays = 14): number {
  return personalWpmFromStats(
    sessions.map((s) => ({ wordsRead: s.wordsRead, activeMs: activeMs(s.activity), endedAt: s.endedAt })),
    halfLifeDays,
  );
}

/** A session boiled down to what the speed calculation needs. */
export interface SessionStats {
  wordsRead: number;
  activeMs: number;
  endedAt: number;
}

/** Same as personalWpm, for sessions already summarised (e.g. stored compactly). */
export function personalWpmFromStats(stats: SessionStats[], halfLifeDays = 14): number {
  const usable = stats
    .map((s) => ({ s, wpm: s.activeMs > 0 ? s.wordsRead / (s.activeMs / 60000) : 0 }))
    .filter(({ s, wpm }) => s.wordsRead >= MIN_SESSION_WORDS && wpm >= MIN_WPM && wpm <= MAX_WPM);
  if (usable.length === 0) return DEFAULT_WPM;

  const latest = Math.max(...usable.map(({ s }) => s.endedAt));
  let weighted = 0;
  let weights = 0;
  for (const { s, wpm } of usable) {
    const ageDays = (latest - s.endedAt) / 86_400_000;
    const w = Math.pow(0.5, ageDays / halfLifeDays) * s.wordsRead;
    weighted += wpm * w;
    weights += w;
  }
  return Math.round(weighted / weights);
}

export function minutesFor(words: number, wpm: number): number {
  if (words <= 0) return 0;
  return Math.ceil(words / wpm);
}

export function formatDuration(minutes: number): string {
  if (minutes < 1) return "under a minute";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export interface FinishPlan {
  remainingWords: number;
  totalMinutes: number;
  days: number;
  minutesPerDay: number;
}

/** Minutes per day needed to finish the remaining words over N days. */
export function planFinish(remainingWords: number, wpm: number, days: number): FinishPlan {
  if (days < 1) throw new Error("days must be at least 1");
  const totalMinutes = minutesFor(remainingWords, wpm);
  return { remainingWords, totalMinutes, days, minutesPerDay: Math.ceil(totalMinutes / days) };
}

/**
 * Can the reader finish before a deadline, given how many minutes a day they read?
 * Counts whole days from `now` up to and including the deadline's day.
 */
export function canFinishBy(
  remainingWords: number,
  wpm: number,
  deadline: Date,
  minutesPerDay: number,
  now: Date = new Date(),
): { possible: boolean; daysAvailable: number; minutesNeeded: number; minutesPerDayNeeded: number } {
  const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const daysAvailable = Math.max(0, Math.floor((startOfDay(deadline) - startOfDay(now)) / 86_400_000) + 1);
  const minutesNeeded = minutesFor(remainingWords, wpm);
  const minutesPerDayNeeded = daysAvailable > 0 ? Math.ceil(minutesNeeded / daysAvailable) : Infinity;
  return {
    possible: daysAvailable > 0 && minutesPerDayNeeded <= minutesPerDay,
    daysAvailable,
    minutesNeeded,
    minutesPerDayNeeded,
  };
}
