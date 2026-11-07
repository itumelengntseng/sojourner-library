// Reading sessions: what the reading room reports, checked before it is trusted.
import { b36, compactSafe, fitCookie, packRecords, readNum, unpackRecords } from "./cookieBudget";
import { activeMs, DEFAULT_WPM, personalWpmFromStats, type SessionStats } from "./engine/readingTime";

export const MAX_ACTIVITY = 2000;
export const MAX_SESSION_AGE_MS = 12 * 60 * 60 * 1000;
export const ACTIVITY_THROTTLE_MS = 5000;

export interface SessionPayload {
  sessionId: string;
  slug: string;
  position: number;
  startedAt: number;
  activity: number[];
  wordsRead: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Returns a cleaned payload, or null if anything is off. Timestamps must be recent and not in the future. */
export function parseSessionPayload(raw: unknown, now: number): SessionPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const int = (v: unknown) => typeof v === "number" && Number.isInteger(v);
  if (typeof r.sessionId !== "string" || !UUID.test(r.sessionId)) return null;
  if (typeof r.slug !== "string" || !SLUG.test(r.slug) || r.slug.length > 120) return null;
  if (!int(r.position) || (r.position as number) < 1) return null;
  if (!int(r.wordsRead) || (r.wordsRead as number) < 0 || (r.wordsRead as number) > 500_000) return null;
  if (!int(r.startedAt)) return null;
  const startedAt = r.startedAt as number;
  if (startedAt < now - MAX_SESSION_AGE_MS || startedAt > now + 60_000) return null;
  if (!Array.isArray(r.activity)) return null;
  const activity = r.activity
    .filter((t): t is number => int(t) && (t as number) >= startedAt && (t as number) <= now + 60_000)
    .sort((a, b) => a - b)
    .slice(-MAX_ACTIVITY);
  return { sessionId: r.sessionId, slug: r.slug, position: r.position as number, startedAt, activity, wordsRead: r.wordsRead as number };
}

/** The reading room can't claim more words than the chapter holds. */
export function capWords(p: SessionPayload, chapterWords: number): SessionPayload {
  return { ...p, wordsRead: Math.min(p.wordsRead, chapterWords) };
}

export function toStats(p: SessionPayload): SessionStats {
  return { wordsRead: p.wordsRead, activeMs: activeMs(p.activity), endedAt: p.activity[p.activity.length - 1] ?? p.startedAt };
}

// ── Preview store (cookie) ──────────────────────────────────────────────────

export const PREVIEW_SESSIONS_COOKIE = "soj_preview_sessions";
const PREVIEW_LIMIT = 40;

export interface StoredStats extends SessionStats {
  id: string;
  slug?: string; // which work (absent on summaries saved before the ledger existed)
  position?: number; // which chapter (absent on older summaries)
}

// C48: compact shape — id~slug~chapter~words~activeMs~endedAt (ms in base 36; slug/chapter empty when unknown).
function statsRecord(s: StoredStats): string[] {
  return [s.id, s.slug ?? "", s.position === undefined ? "" : String(s.position), String(Math.round(s.wordsRead)), b36(s.activeMs), b36(s.endedAt)];
}

function recordStats(r: string[]): StoredStats | null {
  if (r.length !== 6) return null;
  const [id, slug, pos, w, a, e] = r;
  const position = pos === "" ? undefined : readNum(pos, 10);
  const wordsRead = readNum(w, 10), activeMs = readNum(a, 36), endedAt = readNum(e, 36);
  if (!id || position === null || (position !== undefined && position < 1) || wordsRead === null || activeMs === null || endedAt === null) return null;
  const out: StoredStats = { id, wordsRead, activeMs, endedAt };
  if (slug !== "") out.slug = slug;
  if (position !== undefined) out.position = position;
  return out;
}

export function parseStoredStats(raw: string | undefined): StoredStats[] {
  if (!raw) return [];
  const records = unpackRecords(raw);
  if (records) return records.map(recordStats).filter((s): s is StoredStats => s !== null).slice(0, PREVIEW_LIMIT);
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((x): x is StoredStats => {
      const s = x as Record<string, unknown>;
      return !!s && typeof s.id === "string" && (s.slug === undefined || typeof s.slug === "string") && (s.position === undefined || (Number.isInteger(s.position) && (s.position as number) >= 1)) && [s.wordsRead, s.activeMs, s.endedAt].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0);
    }).slice(0, PREVIEW_LIMIT);
  } catch {
    return [];
  }
}

function writeStats(list: StoredStats[]): string {
  const records = list.map(statsRecord);
  return records.every((r) => compactSafe(r) && r[0] !== "") ? packRecords(records) : JSON.stringify(list);
}

/** The preview sessions cookie, kept under the browser's size limit by dropping the oldest summaries. */
export function serializeStoredStats(list: StoredStats[]): string {
  return fitCookie(list, writeStats, (l) => {
    if (l.length === 0) return -1;
    let oldest = 0;
    l.forEach((s, i) => { if (s.endedAt < l[oldest].endedAt) oldest = i; });
    return oldest;
  });
}

/** Replaces the session with the same id (heartbeats re-send it), newest first. */
export function upsertStats(list: StoredStats[], s: StoredStats): StoredStats[] {
  return [s, ...list.filter((x) => x.id !== s.id)].sort((a, b) => b.endedAt - a.endedAt).slice(0, PREVIEW_LIMIT);
}

// ── Speed ────────────────────────────────────────────────────────────────────

export interface Pace {
  wpm: number;
  source: "default" | "learned" | "set";
  sessions: number;
  minutesPerDay: number; // usual reading per reading-day, for the librarian's deadline answers
}

/** Decision: assume half an hour a day until the reader's habits say otherwise. */
export const DEFAULT_MINUTES_PER_DAY = 30;

/** Average active minutes on the days the reader read, over the last 14 days of reading. */
export function usualMinutesPerDay(stats: SessionStats[]): number {
  if (stats.length === 0) return DEFAULT_MINUTES_PER_DAY;
  const latest = Math.max(...stats.map((s) => s.endedAt));
  const byDay = new Map<number, number>();
  for (const s of stats) {
    if (latest - s.endedAt > 14 * 86_400_000) continue;
    const day = Math.floor(s.endedAt / 86_400_000);
    byDay.set(day, (byDay.get(day) ?? 0) + s.activeMs);
  }
  const total = [...byDay.values()].reduce((a, b) => a + b, 0) / 60_000;
  const avg = byDay.size ? Math.round(total / byDay.size) : 0;
  return avg >= 5 ? avg : DEFAULT_MINUTES_PER_DAY;
}

export function paceFrom(stats: SessionStats[], override: number | null = null): Pace {
  const minutesPerDay = usualMinutesPerDay(stats);
  if (override && override >= 50 && override <= 1500) return { wpm: override, source: "set", sessions: stats.length, minutesPerDay };
  const wpm = personalWpmFromStats(stats);
  const learned = stats.some((s) => s.wordsRead >= 150) && wpm !== DEFAULT_WPM;
  return { wpm, source: learned ? "learned" : "default", sessions: stats.length, minutesPerDay };
}

export function paceNote(p: Pace): string {
  if (p.source === "set") return `at your chosen pace of ${p.wpm} wpm`;
  if (p.source === "learned") return `at your pace — ${p.wpm} wpm, learned from your reading`;
  return `at ${p.wpm} wpm until we learn your pace`;
}
