import "server-only";
import { cookies } from "next/headers";
import { getWorks } from "./catalogue";
import { activeMs, countWords } from "./engine/readingTime";
import { byMonth, finishedBooks, thisWeek, type Week, chaptersRead, finishedAt, hoursByWork, readByWork, loanHistory, notesMarkdown, streaks, withFinished, type ExportWork, type HistoryRow, type MonthRow, type Streaks, type WorkHours, type WorkSession } from "./ledger";
import { parsePreviewLoans, PREVIEW_COOKIE, rowToLoan, type LoanRow } from "./loanDesk";
import { splitParagraphs } from "./reader";
import { parseStoredStats, PREVIEW_SESSIONS_COOKIE } from "./sessions";
import { supabaseServer } from "./supabase/server";
import { countByChapter, type AnnotationCount, type AnnotationTotals } from "./notesCount";

export interface LedgerView {
  mode: "preview" | "library" | "signed-out";
  readerName: string;
  titles: Record<string, string>;
  slugs: Record<string, string>;
  history: HistoryRow[];
  hours: WorkHours[];
  streaks: Streaks;
  totalMs: number;
  totalWords: number;
  months: MonthRow[];
  week: Week;
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
      streaks: streaks(stats, now), totalMs: stats.reduce((a, s) => a + s.activeMs, 0), totalWords: stats.reduce((a, s) => a + s.wordsRead, 0), months: byMonth(stats, now), week: thisWeek(stats, now),
    };
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { mode: "signed-out", readerName: "", titles: {}, slugs: {}, history: [], hours: [], streaks: EMPTY, totalMs: 0, totalWords: 0, months: [], week: { ms: 0, days: 0 } };
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
    totalWords: sessions.reduce((a, s) => a + s.wordsRead, 0),
    months: byMonth(sessions, now),
    week: thisWeek(sessions, now),
  };
}

/** Library mode: the reader's own notes and highlights as Markdown (null when not signed in). */
/** The reader's own notes and highlights as Markdown — all books, or one (`slug`, C29). */
export async function exportNotes(slug?: string): Promise<string | null> {
  const supabase = await supabaseServer();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const uid = auth.user.id;
  let only: string | null = null;
  if (slug) {
    const { data: w } = await supabase.from("works").select("id").eq("slug", slug).maybeSingle();
    if (!w) return notesMarkdown([], Date.now());
    only = w.id as string;
  }
  const notesQ = supabase.from("notes").select("work_id, chapter_id, anchor_offset, body, created_at").eq("reader_id", uid);
  const hlsQ = supabase.from("highlights").select("work_id, chapter_id, start_offset, end_offset, colour, created_at").eq("reader_id", uid);
  const [{ data: me }, { data: notes }, { data: hls }] = await Promise.all([
    supabase.from("readers").select("display_name").eq("id", uid).maybeSingle(),
    only ? notesQ.eq("work_id", only) : notesQ,
    only ? hlsQ.eq("work_id", only) : hlsQ,
  ]);
  const chapterIds = [...new Set([...(notes ?? []), ...(hls ?? [])].map((x) => x.chapter_id as string))];
  const workIds = [...new Set([...(notes ?? []), ...(hls ?? [])].map((x) => x.work_id as string))];
  const [{ data: chapters }, { data: texts }, { data: works }] = await Promise.all([
    supabase.from("chapters").select("id, work_id, position, title").in("id", chapterIds),
    supabase.from("chapter_texts").select("chapter_id, body_md").in("chapter_id", chapterIds), // only books on loan
    supabase.from("works").select("id, slug, title, author").in("id", workIds),
  ]);
  // C94: a finished book's heading carries its Finished line (own sessions only).
  const workSlugs = (works ?? []).map((w) => w.slug as string);
  const [finishes, firsts] = await Promise.all([myFinishes(workSlugs), myFirstReads(workSlugs)]);
  const body = new Map((texts ?? []).map((t) => [t.chapter_id as string, t.body_md as string]));
  const out: ExportWork[] = (works ?? []).map((w) => ({
    title: w.title as string,
    author: w.author as string,
    ...(finishes[w.slug as string] !== undefined ? { finished: { at: finishes[w.slug as string], firstRead: firsts[w.slug as string] } } : {}),
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

/** C86: when the reader's first session in `slug` ended (own sessions only) — the start of "read over N days". */
export async function myFirstRead(slug: string): Promise<number | undefined> {
  const supabase = await supabaseServer();
  if (!supabase) {
    const times = parseStoredStats((await cookies()).get(PREVIEW_SESSIONS_COOKIE)?.value)
      .filter((s) => s.slug === slug && Number.isFinite(s.endedAt)).map((s) => s.endedAt);
    return times.length ? Math.min(...times) : undefined;
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return undefined;
  const { data: work } = await supabase.from("works").select("id").eq("slug", slug).maybeSingle();
  if (!work) return undefined;
  const { data: first } = await supabase.from("sessions").select("started_at, ended_at")
    .eq("reader_id", auth.user.id).eq("work_id", work.id).order("started_at", { ascending: true }).limit(1).maybeSingle();
  if (!first) return undefined;
  const at = Date.parse((first.ended_at ?? first.started_at) as string);
  return Number.isFinite(at) ? at : undefined;
}

/** C93: `myFirstRead` for several books in one pass — slug → end of the reader's first session in it (own sessions only). */
export async function myFirstReads(slugs: string[]): Promise<Record<string, number>> {
  const uniq = [...new Set(slugs)];
  const out: Record<string, number> = {};
  if (uniq.length === 0) return out;
  const supabase = await supabaseServer();
  if (!supabase) {
    for (const s of parseStoredStats((await cookies()).get(PREVIEW_SESSIONS_COOKIE)?.value)) {
      if (!s.slug || !uniq.includes(s.slug) || !Number.isFinite(s.endedAt)) continue;
      out[s.slug] = Math.min(out[s.slug] ?? s.endedAt, s.endedAt);
    }
    return out;
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return out;
  const { data: works } = await supabase.from("works").select("id, slug").in("slug", uniq);
  if (!works?.length) return out;
  const slugOf = new Map(works.map((w) => [w.id as string, w.slug as string]));
  const { data: rows } = await supabase.from("sessions").select("work_id, started_at, ended_at")
    .eq("reader_id", auth.user.id).in("work_id", [...slugOf.keys()]).order("started_at", { ascending: true }).limit(5000);
  for (const r of rows ?? []) {
    const slug = slugOf.get(r.work_id as string);
    const at = Date.parse((r.ended_at ?? r.started_at) as string);
    if (!slug || !Number.isFinite(at)) continue;
    out[slug] = Math.min(out[slug] ?? at, at);
  }
  return out;
}

/** Positions of the chapters of `slug` the reader has read through, from their own sessions (C28). */
export async function myChaptersRead(slug: string): Promise<number[]> {
  const supabase = await supabaseServer();
  if (!supabase) {
    const work = getWorks().find((w) => w.slug === slug);
    if (!work) return [];
    const stats = parseStoredStats((await cookies()).get(PREVIEW_SESSIONS_COOKIE)?.value).filter((s) => s.slug === slug && s.position);
    const sessions = stats.map((s) => ({ ...s, workKey: slug, chapterKey: String(s.position) }));
    return chaptersRead(sessions, work.chapters.map((c) => ({ key: String(c.position), words: countWords(c.body) }))).map(Number);
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data: work } = await supabase.from("works").select("id").eq("slug", slug).maybeSingle();
  if (!work) return [];
  const { data: chs } = await supabase.from("chapters").select("id, position, word_count").eq("work_id", work.id).is("archived_at", null).order("position").limit(400);
  const list = (chs ?? []) as { id: string; position: number; word_count: number }[];
  if (list.length === 0) return [];
  const { data: rows } = await supabase.from("sessions").select("chapter_id, words_read, started_at, ended_at")
    .eq("reader_id", auth.user.id).eq("work_id", work.id).not("chapter_id", "is", null).limit(5000);
  const sessions = (rows ?? []).map((r) => ({
    workKey: work.id as string, chapterKey: r.chapter_id as string, wordsRead: r.words_read as number, activeMs: 0,
    endedAt: Date.parse((r.ended_at ?? r.started_at) as string),
  }));
  const read = new Set(chaptersRead(sessions, list.map((c) => ({ key: c.id, words: c.word_count }))));
  return list.filter((c) => read.has(c.id)).map((c) => c.position);
}

/** C43: how many margin notes and highlights the reader has in this work (own rows only; null in preview — the browser counts). */
export async function myAnnotationCount(slug: string): Promise<{ notes: number; highlights: number } | null> {
  const supabase = await supabaseServer();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { notes: 0, highlights: 0 };
  const { data: work } = await supabase.from("works").select("id").eq("slug", slug).maybeSingle();
  if (!work) return { notes: 0, highlights: 0 };
  const [{ count: notes }, { count: highlights }] = await Promise.all([
    supabase.from("notes").select("id", { count: "exact", head: true }).eq("reader_id", auth.user.id).eq("work_id", work.id),
    supabase.from("highlights").select("id", { count: "exact", head: true }).eq("reader_id", auth.user.id).eq("work_id", work.id),
  ]);
  return { notes: notes ?? 0, highlights: highlights ?? 0 };
}

/** C197: own notes and highlights per chapter of this work (position → counts; null in preview — the browser counts). */
export async function myAnnotationsByChapter(slug: string): Promise<Record<number, AnnotationCount> | null> {
  const supabase = await supabaseServer();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return {};
  const { data: work } = await supabase.from("works").select("id").eq("slug", slug).maybeSingle();
  if (!work) return {};
  const [{ data: chs }, { data: notes }, { data: hls }] = await Promise.all([
    supabase.from("chapters").select("id, position").eq("work_id", work.id),
    supabase.from("notes").select("chapter_id").eq("reader_id", auth.user.id).eq("work_id", work.id).limit(5000),
    supabase.from("highlights").select("chapter_id").eq("reader_id", auth.user.id).eq("work_id", work.id).limit(5000),
  ]);
  const positions = Object.fromEntries((chs ?? []).map((c) => [c.id as string, c.position as number]));
  return countByChapter((notes ?? []) as { chapter_id: string }[], (hls ?? []) as { chapter_id: string }[], positions);
}

/** C179: the reader's own notes and highlights across the library (null in preview — the browser counts). */
export async function myAnnotationTotals(): Promise<AnnotationTotals | null> {
  const supabase = await supabaseServer();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { notes: 0, highlights: 0, books: 0 };
  const [{ data: notes }, { data: hls }] = await Promise.all([
    supabase.from("notes").select("work_id").eq("reader_id", auth.user.id).limit(5000),
    supabase.from("highlights").select("work_id").eq("reader_id", auth.user.id).limit(5000),
  ]);
  const books = new Set([...(notes ?? []), ...(hls ?? [])].map((r) => r.work_id as string));
  return { notes: notes?.length ?? 0, highlights: hls?.length ?? 0, books: books.size };
}

/** C186: own notes and highlights per work (workKey → counts) for Hours per book; null in preview — the browser counts. */
export async function myAnnotationsByWork(): Promise<Record<string, AnnotationCount> | null> {
  const supabase = await supabaseServer();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return {};
  const [{ data: notes }, { data: hls }] = await Promise.all([
    supabase.from("notes").select("work_id").eq("reader_id", auth.user.id).limit(5000),
    supabase.from("highlights").select("work_id").eq("reader_id", auth.user.id).limit(5000),
  ]);
  const out: Record<string, AnnotationCount> = {};
  for (const r of notes ?? []) (out[r.work_id as string] ??= { notes: 0, highlights: 0 }).notes += 1;
  for (const r of hls ?? []) (out[r.work_id as string] ??= { notes: 0, highlights: 0 }).highlights += 1;
  return out;
}

/** C60: the reader's own reading in the last 7 SA days, for the line on the card page. */
/** C88: how many books the reader has read to the end — the same count as the ledger's Read to the end shelf. */
export async function myFinishedCount(): Promise<number> {
  return finishedBooks((await loadLedger()).hours).length;
}

export async function myWeek(): Promise<Week | null> {
  const now = Date.now();
  const supabase = await supabaseServer();
  if (!supabase) return thisWeek(parseStoredStats((await cookies()).get(PREVIEW_SESSIONS_COOKIE)?.value), now);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: rows } = await supabase.from("sessions").select("words_read, activity, started_at, ended_at")
    .eq("reader_id", auth.user.id).gte("started_at", new Date(now - 9 * 86_400_000).toISOString()).limit(1000);
  return thisWeek((rows ?? []).map((r) => ({
    wordsRead: r.words_read as number,
    activeMs: activeMs(((r.activity as string[]) ?? []).map((t) => Date.parse(t))),
    endedAt: Date.parse((r.ended_at ?? r.started_at) as string),
  })), now);
}

/**
 * C70/C72: which of these works the reader has read to the end (C13 rule, own sessions only) — slug → finish time.
 * One pass for any number of works: preview reads the cookie once; library mode makes three queries in all.
 */
export async function myFinishes(slugs: string[]): Promise<Record<string, number>> {
  const uniq = [...new Set(slugs)];
  if (uniq.length === 0) return {};
  const out: Record<string, number> = {};
  const supabase = await supabaseServer();
  if (!supabase) {
    const stats = parseStoredStats((await cookies()).get(PREVIEW_SESSIONS_COOKIE)?.value);
    for (const slug of uniq) {
      const last = getWorks().find((w) => w.slug === slug)?.chapters.at(-1);
      if (!last) continue;
      const mine = stats.filter((s) => s.slug === slug).map((s) => ({ ...s, workKey: slug, ...(s.position ? { chapterKey: String(s.position) } : {}) }));
      const at = finishedAt(mine, { key: String(last.position), words: countWords(last.body) });
      if (at !== undefined) out[slug] = at;
    }
    return out;
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return {};
  const { data: works } = await supabase.from("works").select("id, slug").in("slug", uniq);
  if (!works?.length) return {};
  const { data: chapters } = await supabase.from("chapters").select("id, work_id, position, word_count")
    .in("work_id", works.map((w) => w.id as string)).is("archived_at", null);
  const lastByWork = new Map<string, { id: string; position: number; words: number }>();
  for (const c of chapters ?? []) {
    const cur = lastByWork.get(c.work_id as string);
    if (!cur || (c.position as number) > cur.position) lastByWork.set(c.work_id as string, { id: c.id as string, position: c.position as number, words: c.word_count as number });
  }
  const lastIds = [...lastByWork.values()].map((c) => c.id);
  if (lastIds.length === 0) return {};
  const { data: rows } = await supabase.from("sessions").select("chapter_id, words_read, started_at, ended_at")
    .eq("reader_id", auth.user.id).in("chapter_id", lastIds).limit(2000);
  for (const w of works) {
    const last = lastByWork.get(w.id as string);
    if (!last) continue;
    const sessions = (rows ?? []).filter((r) => r.chapter_id === last.id).map((r) => ({
      workKey: w.id as string, chapterKey: last.id, wordsRead: r.words_read as number, activeMs: 0,
      endedAt: Date.parse((r.ended_at ?? r.started_at) as string),
    }));
    const at = finishedAt(sessions, { key: last.id, words: last.words });
    if (at !== undefined) out[w.slug as string] = at;
  }
  return out;
}

/** C162: the reader's own reading time per work (slug → active ms), for the halls' "Most read by you" order. */
export async function myHoursBySlug(): Promise<Record<string, number>> {
  const l = await loadLedger();
  const out: Record<string, number> = {};
  for (const [workKey, ms] of Object.entries(readByWork(l.hours))) {
    const slug = l.slugs[workKey];
    if (slug) out[slug] = (out[slug] ?? 0) + ms;
  }
  return out;
}
