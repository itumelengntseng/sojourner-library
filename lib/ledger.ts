// The reading ledger: history, hours per book, streaks and a notes export.
import type { Loan } from "./engine/checkout";
import type { SessionStats } from "./engine/readingTime";

/** Decision: days roll over at midnight South African time (UTC+2, no daylight saving). */
const SAST_OFFSET_MS = 2 * 3600_000;
const DAY = 86_400_000;

export const dayKey = (ms: number) => Math.floor((ms + SAST_OFFSET_MS) / DAY);

export interface WorkSession extends SessionStats {
  workKey: string; // slug (preview) or work id (library)
  chapterKey?: string; // chapter position (preview) or chapter id (library)
}

export interface WorkHours {
  workKey: string;
  activeMs: number;
  wordsRead: number;
  sessions: number;
  lastRead: number;
  /** When the reader reached the end of the last chapter, if they have. */
  finishedAt?: number;
}

export function hoursByWork(sessions: WorkSession[]): WorkHours[] {
  const map = new Map<string, WorkHours>();
  for (const s of sessions) {
    const h = map.get(s.workKey) ?? { workKey: s.workKey, activeMs: 0, wordsRead: 0, sessions: 0, lastRead: 0 };
    h.activeMs += s.activeMs;
    h.wordsRead += s.wordsRead;
    h.sessions += 1;
    h.lastRead = Math.max(h.lastRead, s.endedAt);
    map.set(s.workKey, h);
  }
  return [...map.values()].sort((a, b) => b.lastRead - a.lastRead);
}

/** A book counts as finished once the words read in its last chapter reach this share of it. */
export const FINISH_SHARE = 0.9;

/** When the reader finished: the session in which their reading of the last chapter reached FINISH_SHARE. */
export function finishedAt(sessions: WorkSession[], last: { key: string; words: number } | undefined): number | undefined {
  if (!last || last.words <= 0) return undefined;
  let read = 0;
  for (const s of sessions.filter((x) => x.chapterKey === last.key).sort((a, b) => a.endedAt - b.endedAt)) {
    read += s.wordsRead;
    if (read >= last.words * FINISH_SHARE) return s.endedAt;
  }
  return undefined;
}

/** Keys of the chapters the reader has read through (same 90% rule as the finish stamp). */
export function chaptersRead(sessions: WorkSession[], chapters: { key: string; words: number }[]): string[] {
  return chapters.filter((c) => finishedAt(sessions, c) !== undefined).map((c) => c.key);
}

/** Adds the finished stamp to each book's hours. `lastChapters` maps workKey → its last chapter. */
export function withFinished(hours: WorkHours[], sessions: WorkSession[], lastChapters: Record<string, { key: string; words: number }>): WorkHours[] {
  return hours.map((h) => {
    const at = finishedAt(sessions.filter((s) => s.workKey === h.workKey), lastChapters[h.workKey]);
    return at === undefined ? h : { ...h, finishedAt: at };
  });
}

/** "3 h 20 min", "12 min", "under a minute". */
/** C41: the books the reader has finished, newest finish first. */
export function finishedBooks(hours: WorkHours[]): { workKey: string; finishedAt: number }[] {
  return hours.flatMap((h) => (h.finishedAt !== undefined ? [{ workKey: h.workKey, finishedAt: h.finishedAt }] : []))
    .sort((a, b) => b.finishedAt - a.finishedAt);
}

export function formatHours(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "under a minute";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export interface MonthRow {
  key: string; // "2026-11"
  short: string; // "Nov"
  long: string; // "November 2026"
  activeMs: number;
  wordsRead: number;
}

/** Minutes read per calendar month (SA time) for the last `count` months, oldest first, empty months included. */
export function byMonth(sessions: SessionStats[], now: number, count = 12): MonthRow[] {
  const ym = (ms: number) => {
    const d = new Date(ms + SAST_OFFSET_MS);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  };
  const end = ym(now);
  const rows: MonthRow[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const t = end.y * 12 + end.m - i;
    const y = Math.floor(t / 12);
    const m = t % 12;
    const mid = Date.UTC(y, m, 15);
    rows.push({
      key: `${y}-${String(m + 1).padStart(2, "0")}`,
      short: new Date(mid).toLocaleDateString("en-ZA", { month: "short", timeZone: "UTC" }).replace(".", ""),
      long: new Date(mid).toLocaleDateString("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" }),
      activeMs: 0,
      wordsRead: 0,
    });
  }
  const index = new Map(rows.map((r, i) => [r.key, i]));
  for (const s of sessions) {
    const { y, m } = ym(s.endedAt);
    const i = index.get(`${y}-${String(m + 1).padStart(2, "0")}`);
    if (i !== undefined) {
      rows[i].activeMs += s.activeMs;
      rows[i].wordsRead += s.wordsRead;
    }
  }
  return rows;
}

/** What a month's bar says aloud: "June 2026: 1 h 5 min · 12 400 words" or "June 2026: no reading". */
export function monthLabel(m: MonthRow): string {
  if (m.activeMs <= 0 && m.wordsRead <= 0) return `${m.long}: no reading`;
  const words = `${m.wordsRead.toLocaleString("en-ZA").replace(/\s/g, "\u00a0")} word${m.wordsRead === 1 ? "" : "s"}`;
  return `${m.long}: ${formatHours(m.activeMs)} · ${words}`;
}

export const STREAK_MIN_MS = 60_000; // a day counts once you've read for a minute

export interface Streaks {
  current: number;
  longest: number;
  readToday: boolean;
  days: number; // distinct reading days
}

/** A streak survives until the end of the day after the last reading day. */
export function streaks(sessions: SessionStats[], now: number): Streaks {
  const perDay = new Map<number, number>();
  for (const s of sessions) perDay.set(dayKey(s.endedAt), (perDay.get(dayKey(s.endedAt)) ?? 0) + s.activeMs);
  const days = [...perDay.entries()].filter(([, ms]) => ms >= STREAK_MIN_MS).map(([d]) => d).sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] === days[i - 1] + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const today = dayKey(now);
  const set = new Set(days);
  let current = 0;
  let d = set.has(today) ? today : today - 1;
  while (set.has(d)) { current++; d--; }
  return { current, longest, readToday: set.has(today), days: days.length };
}

export interface Week { ms: number; days: number }

/** C56: reading time in the last 7 SA days (today included) and on how many of them (a minute counts a day). */
export function thisWeek(sessions: SessionStats[], now: number): Week {
  const today = dayKey(now);
  const perDay = new Map<number, number>();
  for (const s of sessions) {
    const d = dayKey(s.endedAt);
    if (d > today || d <= today - 7) continue;
    perDay.set(d, (perDay.get(d) ?? 0) + s.activeMs);
  }
  const ms = [...perDay.values()].reduce((a, b) => a + b, 0);
  return { ms, days: [...perDay.values()].filter((v) => v >= STREAK_MIN_MS).length };
}

export interface HistoryRow {
  id: string;
  workKey: string;
  borrowedAt: number;
  endedAt: number | null; // returned (or expired) at
  open: boolean;
  renewals: number;
}

/** C46: the history shows the newest `limit` rows unless the reader asks for all of it. */
export const HISTORY_SHORT = 10;
export function historyPage<T>(rows: T[], showAll: boolean, limit = HISTORY_SHORT): { rows: T[]; hidden: number } {
  if (showAll || rows.length <= limit) return { rows, hidden: 0 };
  return { rows: rows.slice(0, limit), hidden: rows.length - limit };
}

export function loanHistory(loans: Loan[], now: number): HistoryRow[] {
  return [...loans]
    .sort((a, b) => b.borrowedAt - a.borrowedAt)
    .map((l) => {
      const ended = l.returnedAt ?? (l.dueAt <= now ? l.dueAt : null);
      return { id: l.id, workKey: l.workId, borrowedAt: l.borrowedAt, endedAt: ended, open: ended === null, renewals: l.renewals };
    });
}

// ── Notes export (Markdown) ────────────────────────────────────────────────

export interface ExportChapter {
  position: number;
  title: string;
  notes: { anchorText: string; body: string; createdAt: number }[];
  highlights: { text: string; colour: string; createdAt: number }[];
}

export interface ExportWork {
  title: string;
  author: string;
  chapters: ExportChapter[];
}

const quote = (t: string) => t.split("\n").map((l) => `> ${l}`).join("\n");
const clip = (t: string, n = 160) => (t.length > n ? `${t.slice(0, n).trimEnd()}…` : t);

const AUTHOR = "Itumeleng Ntseng";
export const NOTES_HEADING = `Notes on the works of ${AUTHOR}`;

/** A chapter's heading in the notes file: its title, or "Chapter N" when it has none (C68). */
export function chapterHeading(c: { position: number; title: string }): string {
  const t = (c.title ?? "").replace(/\s+/g, " ").trim();
  return t || `Chapter ${c.position}`;
}

export function notesMarkdown(works: ExportWork[], exportedAt: number, readerName = ""): string {
  const when = new Date(exportedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" });
  // C68: the file opens with whose works these are and when it was made.
  const out = [`# ${NOTES_HEADING}`, ``, `From The Sojourner Library · ${readerName ? `${readerName} · ` : ""}Exported ${when}. Private to you.`, ``];
  const withContent = works.filter((w) => w.chapters.some((c) => c.notes.length || c.highlights.length));
  if (withContent.length === 0) out.push("_No notes or highlights yet._", "");
  for (const w of withContent) {
    out.push(`## ${w.title}`, ``, `_by ${w.author.trim() || AUTHOR}_`, ``);
    for (const c of [...w.chapters].sort((a, b) => a.position - b.position)) {
      if (!c.notes.length && !c.highlights.length) continue;
      out.push(`### ${chapterHeading(c)}`, ``);
      const items = [
        ...c.highlights.map((h) => ({ at: h.createdAt, md: `${quote(h.text)}\n\n_highlight · ${h.colour}_` })),
        ...c.notes.map((n) => ({ at: n.createdAt, md: `${n.anchorText ? `${quote(clip(n.anchorText))}\n\n` : ""}**Note:** ${n.body}` })),
      ].sort((a, b) => a.at - b.at);
      for (const it of items) out.push(it.md, ``);
    }
  }
  return out.join("\n").trimEnd() + "\n";
}

/** "sojourner-notes.md", or "sojourner-notes-<slug>.md" for one book (C29). */
export function notesFilename(slug?: string): string {
  const clean = (slug ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
  return clean ? `sojourner-notes-${clean}.md` : "sojourner-notes.md";
}
