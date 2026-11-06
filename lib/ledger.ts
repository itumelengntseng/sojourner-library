// The reading ledger: history, hours per book, streaks and a notes export.
import type { Loan } from "./engine/checkout";
import type { SessionStats } from "./engine/readingTime";

/** Decision: days roll over at midnight South African time (UTC+2, no daylight saving). */
const SAST_OFFSET_MS = 2 * 3600_000;
const DAY = 86_400_000;

export const dayKey = (ms: number) => Math.floor((ms + SAST_OFFSET_MS) / DAY);

export interface WorkSession extends SessionStats {
  workKey: string; // slug (preview) or work id (library)
}

export interface WorkHours {
  workKey: string;
  activeMs: number;
  wordsRead: number;
  sessions: number;
  lastRead: number;
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

/** "3 h 20 min", "12 min", "under a minute". */
export function formatHours(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "under a minute";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
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

export interface HistoryRow {
  id: string;
  workKey: string;
  borrowedAt: number;
  endedAt: number | null; // returned (or expired) at
  open: boolean;
  renewals: number;
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

export function notesMarkdown(works: ExportWork[], exportedAt: number, readerName = ""): string {
  const when = new Date(exportedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" });
  const out = [`# My notes from The Sojourner Library`, ``, `${readerName ? `${readerName} · ` : ""}Exported ${when}. Private to you.`, ``];
  const withContent = works.filter((w) => w.chapters.some((c) => c.notes.length || c.highlights.length));
  if (withContent.length === 0) out.push("_No notes or highlights yet._", "");
  for (const w of withContent) {
    out.push(`## ${w.title}`, ``, `_by ${w.author}_`, ``);
    for (const c of [...w.chapters].sort((a, b) => a.position - b.position)) {
      if (!c.notes.length && !c.highlights.length) continue;
      out.push(`### ${c.title}`, ``);
      const items = [
        ...c.highlights.map((h) => ({ at: h.createdAt, md: `${quote(h.text)}\n\n_highlight · ${h.colour}_` })),
        ...c.notes.map((n) => ({ at: n.createdAt, md: `${n.anchorText ? `${quote(clip(n.anchorText))}\n\n` : ""}**Note:** ${n.body}` })),
      ].sort((a, b) => a.at - b.at);
      for (const it of items) out.push(it.md, ``);
    }
  }
  return out.join("\n").trimEnd() + "\n";
}
