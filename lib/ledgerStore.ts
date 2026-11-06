import "server-only";
import { cookies } from "next/headers";
import { getWorks } from "./catalogue";
import { activeMs, countWords } from "./engine/readingTime";
import { byMonth, finishedAt, hoursByWork, loanHistory, notesMarkdown, streaks, withFinished, type ExportWork, type HistoryRow, type MonthRow, type Streaks, type WorkHours, type WorkSession } from "./ledger";
import { parsePreviewLoans, PREVIEW_COOKIE, rowToLoan, type LoanRow } from "./loanDesk";
import { splitParagraphs } from "./reader";
import { parseStoredStats, PREVIEW_SESSIONS_COOKIE } from "./sessions";
import { supabaseServer } from "./supabase/server";

export interface LedgerView {
  mode: "preview" | "library" | "signed-out";
  readerName: string;
  titles: Record<string, string>;
  slugs: Record<string, string>;
  history: HistoryRow[];
  hours: WorkHours[];
  streaks: Streaks;
  totalMs: number;
  months: MonthRow[];
}

const EMPTY: Streaks = { current: 0, longest: 0, readToday: false, days: 0 };

export async function loadLedger(): Promise<LedgerView> {
  const now = Date.now();
  const supabase = await supabaseServer();
  if (!supabase) {
    const store = await cookies();
    const loans = parsePreviewLoans(store.get(PREVIEW_COOKIE)?.value);
    const stats = parseStoredStats(store.get(PREVIEW_SESSIONS_COOKIE)?.value);
    const sessions: WorkSession[] = stats.map((s) => ({ ...s, workKey: s.slug ?? "unknown", ...(s.position ? { chapterKey: String(s.position) } : {}) }));
    const lastChapters = Object.fromEntries(getWorks().flatMap((w) => {
      const last = w.chapters.at(-1);
      return last ? [[w.slug, { key: String(last.position), words: countWords(last.body) }]] : [];
    }));
    const titles = Object.fromEntries(getWorks().map((w) => [w.slug, w.title]));
    const slugs = Object.fromEntries(getWorks().map((w) => [w.slug, w.slug]));
    return {
      mode: "preview", readerName: "", titles, slugs,
      history: loanHistory(loans, now), hours: withFinished(hoursByWork(sessions.filter((s) => s.workKey !== "unknown")), sessions, lastChapters),
      streaks: streaks(stats, now), totalMs: stats.reduce((a, s) => a + s.activeMs, 0), months: byMonth(stats, now),
    };
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { mode: "signed-out", readerName: "", titles: {}, slugs: {}, history: [], hours: [], streaks: EMPTY, totalMs: 0, months: [] };
  const uid = auth.user.id;
  const since = new Date(now - 400 * 86_400_000).toISOString();
  const [{ data: me }, { data: loans }, { data: rows }, { data: works }] = await Promise.all([
    supabase.from("readers").select("display_name").eq("id", uid).maybeSingle(),
    supabase.from("loans").select("*").eq("reader_id", uid).order("borrowed_at", { ascending: false }).limit(200),
    supabase.from("sessions").select("work_id, chapter_id, words_read, activity, started_at, ended_at").eq("reader_id", uid).gte("started_at", since).limit(2000),
    supabase.from("works").select("id, slug, title"),
  ]);
  const sessions: WorkSession[] = (rows ?? []).map((r) => ({
    workKey: r.work_id as string,
    ...(r.chapter_id ? { chapterKey: r.chapter_id as string } : {}),
    wordsRead: r.words_read as number,
    activeMs: activeMs(((r.activity as string[]) ?? []).map((t) => Date.parse(t))),
    endedAt: Date.parse((r.ended_at ?? r.started_at) as string),
  }));
  const workIds = [...new Set(sessions.map((s) => s.workKey))];
  const { data: chs } = workIds.length
    ? await supabase.from("chapters").select("id, work_id, position, word_count").in("work_id", workIds).is("archived_at", null)
    : { data: [] };
  const lastChapters: Record<string, { key: string; words: number; position: number }> = {};
  for (const c of (chs ?? []) as { id: string; work_id: string; position: number; word_count: number }[]) {
    if (!lastChapters[c.work_id] || c.position > lastChapters[c.work_id].position) lastChapters[c.work_id] = { key: c.id, words: c.word_count, position: c.position };
  }
  return {
    mode: "library",
    readerName: (me?.display_name as string | undefined) ?? "",
    titles: Object.fromEntries((works ?? []).map((w) => [w.id as string, w.title as string])),
    slugs: Object.fromEntries((works ?? []).map((w) => [w.id as string, w.slug as string])),
    history: loanHistory(((loans ?? []) as LoanRow[]).map(rowToLoan), now),
    hours: withFinished(hoursByWork(sessions), sessions, lastChapters),
    streaks: streaks(sessions, now),
    totalMs: sessions.reduce((a, s) => a + s.activeMs, 0),
    months: byMonth(sessions, now),
  };
}

/** Library mode: the reader's own notes and highlights as Markdown (null when not signed in). */
export async function exportNotes(): Promise<string | null> {
  const supabase = await supabaseServer();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const uid = auth.user.id;
  const [{ data: me }, { data: notes }, { data: hls }] = await Promise.all([
    supabase.from("readers").select("display_name").eq("id", uid).maybeSingle(),
    supabase.from("notes").select("work_id, chapter_id, anchor_offset, body, created_at").eq("reader_id", uid),
    supabase.from("highlights").select("work_id, chapter_id, start_offset, end_offset, colour, created_at").eq("reader_id", uid),
  ]);
  const chapterIds = [...new Set([...(notes ?? []), ...(hls ?? [])].map((x) => x.chapter_id as string))];
  const workIds = [...new Set([...(notes ?? []), ...(hls ?? [])].map((x) => x.work_id as string))];
  const [{ data: chapters }, { data: texts }, { data: works }] = await Promise.all([
    supabase.from("chapters").select("id, work_id, position, title").in("id", chapterIds),
    supabase.from("chapter_texts").select("chapter_id, body_md").in("chapter_id", chapterIds), // only books on loan
    supabase.from("works").select("id, title, author").in("id", workIds),
  ]);
  const body = new Map((texts ?? []).map((t) => [t.chapter_id as string, t.body_md as string]));
  const out: ExportWork[] = (works ?? []).map((w) => ({
    title: w.title as string,
    author: w.author as string,
    chapters: (chapters ?? []).filter((c) => c.work_id === w.id).map((c) => {
      const text = body.get(c.id as string);
      const paras = text ? splitParagraphs(text) : [];
      return {
        position: c.position as number,
        title: c.title as string,
        notes: (notes ?? []).filter((n) => n.chapter_id === c.id).map((n) => ({
          anchorText: paras.find((p) => (n.anchor_offset as number) >= p.start && (n.anchor_offset as number) < p.end)?.text ?? "",
          body: n.body as string, createdAt: Date.parse(n.created_at as string),
        })),
        highlights: (hls ?? []).filter((h) => h.chapter_id === c.id).map((h) => ({
          text: text ? text.slice(h.start_offset as number, h.end_offset as number) : "(highlighted passage — borrow the book again to see the words)",
          colour: h.colour as string, createdAt: Date.parse(h.created_at as string),
        })),
      };
    }),
  }));
  return notesMarkdown(out, Date.now(), (me?.display_name as string | undefined) ?? "");
}


/** When this reader finished this work, if they have (work page stamp). */
export async function myFinish(slug: string): Promise<number | undefined> {
  const supabase = await supabaseServer();
  if (!supabase) {
    const work = getWorks().find((w) => w.slug === slug);
    const last = work?.chapters.at(-1);
    if (!last) return undefined;
    const stats = parseStoredStats((await cookies()).get(PREVIEW_SESSIONS_COOKIE)?.value).filter((s) => s.slug === slug);
    return finishedAt(stats.map((s) => ({ ...s, workKey: slug, ...(s.position ? { chapterKey: String(s.position) } : {}) })), { key: String(last.position), words: countWords(last.body) });
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return undefined;
  const { data: work } = await supabase.from("works").select("id").eq("slug", slug).maybeSingle();
  if (!work) return undefined;
  const { data: last } = await supabase.from("chapters").select("id, word_count").eq("work_id", work.id).is("archived_at", null)
    .order("position", { ascending: false }).limit(1).maybeSingle();
  if (!last) return undefined;
  const { data: rows } = await supabase.from("sessions").select("words_read, started_at, ended_at")
    .eq("reader_id", auth.user.id).eq("chapter_id", last.id).limit(500);
  const sessions = (rows ?? []).map((r) => ({
    workKey: work.id as string, chapterKey: last.id as string, wordsRead: r.words_read as number, activeMs: 0,
    endedAt: Date.parse((r.ended_at ?? r.started_at) as string),
  }));
  return finishedAt(sessions, { key: last.id as string, words: last.word_count as number });
}
