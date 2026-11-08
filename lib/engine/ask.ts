// The librarian's desk: turns plain questions into reading-time answers.
import { canFinishBy, formatDuration, minutesFor, planFinish } from "./readingTime";

export interface ReaderContext {
  wpm: number;
  totalWords: number;
  wordsRead: number;
  chapterWordsRemaining: number;
  usualMinutesPerDay: number;
  now: Date;
  /** C177: the reader's own reading time in this book (ms); undefined where it isn't kept (the Keeper's proof copy). */
  readMs?: number;
  /** C183: the reader's own notes and highlights in this book; undefined where they aren't kept (the proof copy). */
  annotations?: { notes: number; highlights: number };
  /** C199: titles of the chapters holding the reader's own notes or highlights, in book order; undefined where unknown. */
  notesWhere?: string[];
}

export type Answer =
  | { kind: "time_left"; minutes: number; text: string }
  | { kind: "chapter_left"; minutes: number; text: string }
  | { kind: "per_day"; days: number; minutesPerDay: number; text: string }
  | { kind: "deadline"; possible: boolean; minutesPerDayNeeded: number; text: string }
  | { kind: "read_so_far"; minutes: number; text: string }
  | { kind: "notes"; notes: number; highlights: number; text: string }
  | { kind: "notes_where"; chapters: string[]; text: string }
  | { kind: "unknown"; text: string };

/** C183: "How many notes have I made?", "Have I highlighted anything?", "my notes in this book" */
export function isNotesQuestion(question: string): boolean {
  const q = question.toLowerCase().replace(/[’]/g, "'");
  return /\b(notes?|highlights?|highlighted|annotations?|annotated)\b/.test(q) && /\b(how many|have i|did i|i've|i have|my|any)\b/.test(q);
}

/** C199: "Where are my notes?", "Which chapters have my highlights?", "where did I make notes" */
export function isNotesWhereQuestion(question: string): boolean {
  const q = question.toLowerCase().replace(/[’]/g, "'");
  return /\b(notes?|highlights?|highlighted|annotations?)\b/.test(q) && /\b(where|which chapters?|what chapters?|in which)\b/.test(q);
}

/** "A", "A and B", "A, B and C". */
export function listTitles(titles: string[]): string {
  return titles.length <= 1 ? (titles[0] ?? "") : `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** C177: the question as the desk offers it (a chip, and in the fallback reply — C180). */
export const READ_SO_FAR_QUESTION = "How long have I read this book?";
/** C185: offered once the book holds a note or highlight of the reader's. */
export const NOTES_QUESTION = "How many notes have I made?";
export const hasNotes = (a: { notes: number; highlights: number } | undefined) => !!a && a.notes + a.highlights > 0;
/** C200: offered once the reader's notes sit in two or more chapters (one chapter needs no map). */
export const NOTES_WHERE_QUESTION = "Where are my notes?";
export const hasNotesWhere = (where: string[] | undefined) => (where?.length ?? 0) >= 2;

/** C177/C180: the desk offers it once there's a minute or more to report. */
export const hasReadSoFar = (readMs: number | undefined) => (readMs ?? 0) >= 60_000;

/** C177: "How long have I read this book?", "How much time have I spent on it?", "How long have I been reading?" */
export function isReadSoFarQuestion(question: string): boolean {
  const q = question.toLowerCase().replace(/[’]/g, "'");
  if (/\b(left|remaining|remain|finish|to go|chapter)\b/.test(q)) return false;
  return /\b(have i|i've|i have|did i)\b.*\b(read|reading|spent|spend)\b/.test(q) || /\btime (i've |i have )?(spent|read)\b/.test(q);
}

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

  // C199: where the notes are — chapter titles only (checked before the count question, which it also matches).
  if (isNotesWhereQuestion(q) && ctx.annotations && ctx.notesWhere) {
    const where = ctx.notesWhere;
    if (where.length === 0 && hasNotes(ctx.annotations)) { /* counts and places disagree for a moment — answer with the count */ }
    else if (where.length === 0) return { kind: "notes_where", chapters: [], text: "You haven't made any notes or highlights in this book yet." };
    else return { kind: "notes_where", chapters: where, text: `Your notes and highlights are in ${listTitles(where)}.` };
  }

  if (isNotesQuestion(q)) {
    if (!ctx.annotations) return { kind: "notes", notes: 0, highlights: 0, text: "Notes and highlights aren't kept in this copy." };
    const { notes, highlights } = ctx.annotations;
    const parts = [notes ? plural(notes, "margin note") : "", highlights ? plural(highlights, "highlight") : ""].filter(Boolean);
    return { kind: "notes", notes, highlights, text: parts.length ? `You have ${parts.join(" and ")} in this book.` : "You haven't made any notes or highlights in this book yet." };
  }

  if (isReadSoFarQuestion(q)) {
    if (ctx.readMs === undefined) return { kind: "read_so_far", minutes: 0, text: "Reading time isn't kept in this copy." };
    const minutes = Math.floor(Math.max(0, ctx.readMs) / 60_000);
    if (ctx.readMs <= 0) return { kind: "read_so_far", minutes: 0, text: "You haven't read in this book yet." };
    return { kind: "read_so_far", minutes, text: `You've read for ${formatDuration(minutes)} in this book so far.` };
  }

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

  // C180: the fallback lists what the chips offer, the read-so-far question included once there's time to report.
  const tries = ["How long to finish?", "Can I finish by Friday?", "How much a day to finish in 2 weeks?", "Time left in this chapter?", ...(hasReadSoFar(ctx.readMs) ? [READ_SO_FAR_QUESTION] : []), ...(hasNotes(ctx.annotations) ? [NOTES_QUESTION] : []), ...(hasNotes(ctx.annotations) && hasNotesWhere(ctx.notesWhere) ? [NOTES_WHERE_QUESTION] : [])].map((t) => `"${t}"`);
  return { kind: "unknown", text: `Try: ${tries.slice(0, -1).join(", ")} or ${tries[tries.length - 1]}` };
}
