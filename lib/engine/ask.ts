// The librarian's desk: turns plain questions into reading-time answers.
import { canFinishBy, formatDuration, minutesFor, planFinish } from "./readingTime";

export interface ReaderContext {
  wpm: number;
  totalWords: number;
  wordsRead: number;
  chapterWordsRemaining: number;
  usualMinutesPerDay: number;
  now: Date;
}

export type Answer =
  | { kind: "time_left"; minutes: number; text: string }
  | { kind: "chapter_left"; minutes: number; text: string }
  | { kind: "per_day"; days: number; minutesPerDay: number; text: string }
  | { kind: "deadline"; possible: boolean; minutesPerDayNeeded: number; text: string }
  | { kind: "unknown"; text: string };

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const UNIT_DAYS: Record<string, number> = { day: 1, days: 1, week: 7, weeks: 7, month: 30, months: 30 };
const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10 };

function parseCount(token: string): number | null {
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  return NUMBER_WORDS[token] ?? null;
}

export function parseDeadline(q: string, now: Date): Date | null {
  const s = q.toLowerCase();
  if (/\btonight\b|\btoday\b/.test(s)) return now;
  if (/\btomorrow\b/.test(s)) return new Date(now.getTime() + 86_400_000);
  const wd = WEEKDAYS.findIndex((d) => s.includes(d));
  if (wd >= 0) {
    let diff = (wd - now.getUTCDay() + 7) % 7;
    if (diff === 0) diff = 7; // "by Friday" on a Friday means next Friday
    return new Date(now.getTime() + diff * 86_400_000);
  }
  const iso = s.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return new Date(iso[1] + "T00:00:00Z");
  const rel = s.match(/\b(?:in|within)\s+(\w+)\s+(days?|weeks?|months?)\b/);
  if (rel) {
    const n = parseCount(rel[1]);
    if (n) return new Date(now.getTime() + (n * UNIT_DAYS[rel[2]] - 1) * 86_400_000);
  }
  return null;
}

function parseSpanDays(q: string): number | null {
  const m = q.toLowerCase().match(/\b(?:in|within|over)\s+(\w+)\s+(days?|weeks?|months?)\b/);
  if (!m) return null;
  const n = parseCount(m[1]);
  return n ? n * UNIT_DAYS[m[2]] : null;
}

export function ask(question: string, ctx: ReaderContext): Answer {
  const q = question.toLowerCase();
  const remaining = Math.max(0, ctx.totalWords - ctx.wordsRead);
  // C73: at the very end there is nothing left to time — say so plainly rather than "About 0 min".
  const atEnd = ctx.totalWords > 0 && remaining === 0;
  const END = "You're at the end of this book.";

  if (/chapter/.test(q)) {
    const minutes = minutesFor(ctx.chapterWordsRemaining, ctx.wpm);
    if (ctx.chapterWordsRemaining <= 0 && ctx.totalWords > 0) {
      return { kind: "chapter_left", minutes: 0, text: atEnd ? END : "You're at the end of this chapter." };
    }
    return { kind: "chapter_left", minutes, text: `About ${formatDuration(minutes)} left in this chapter.` };
  }

  if (/per day|a day|each day|daily/.test(q)) {
    const days = parseSpanDays(q);
    if (days && atEnd) return { kind: "per_day", days, minutesPerDay: 0, text: END };
    if (days) {
      const plan = planFinish(remaining, ctx.wpm, days);
      return {
        kind: "per_day",
        days,
        minutesPerDay: plan.minutesPerDay,
        text: `Read about ${formatDuration(plan.minutesPerDay)} a day to finish in ${days} day${days === 1 ? "" : "s"}.`,
      };
    }
  }

  if (/\b(by|before|until)\b|can i finish/.test(q)) {
    const deadline = parseDeadline(q, ctx.now);
    if (deadline && atEnd) return { kind: "deadline", possible: true, minutesPerDayNeeded: 0, text: END };
    if (deadline) {
      const r = canFinishBy(remaining, ctx.wpm, deadline, ctx.usualMinutesPerDay, ctx.now);
      const text = r.possible
        ? `Yes — at your usual ${formatDuration(ctx.usualMinutesPerDay)} a day you'll finish in time (you need about ${formatDuration(r.minutesPerDayNeeded)} a day).`
        : `Not at your usual pace. You'd need about ${formatDuration(r.minutesPerDayNeeded)} a day across ${r.daysAvailable} day${r.daysAvailable === 1 ? "" : "s"}.`;
      return { kind: "deadline", possible: r.possible, minutesPerDayNeeded: r.minutesPerDayNeeded, text };
    }
  }

  if (/how long|time left|finish|remaining|left/.test(q)) {
    if (atEnd) return { kind: "time_left", minutes: 0, text: END };
    const minutes = minutesFor(remaining, ctx.wpm);
    return { kind: "time_left", minutes, text: `About ${formatDuration(minutes)} to finish at your pace of ${ctx.wpm} words a minute.` };
  }

  return {
    kind: "unknown",
    text: 'Try: "How long to finish?", "Can I finish by Friday?", "How much a day to finish in 2 weeks?" or "Time left in this chapter?"',
  };
}
