import "server-only";
// Loads "Continue reading" (C34) for the front hall: own open loans + own sessions only.
import { cookies } from "next/headers";
import { getWorks } from "./catalogue";
import { countWords } from "./engine/readingTime";
import { continueReading, type ContinueCard, type ContinueChapter, type ContinueLoan } from "./continueReading";
import type { WorkSession } from "./ledger";
import { parsePreviewLoans, PREVIEW_COOKIE, PREVIEW_READER, rowToLoan, settleExpired, type LoanRow } from "./loanDesk";
import { parseStoredStats, PREVIEW_SESSIONS_COOKIE } from "./sessions";
import { myPace } from "./sessionStore";
import { supabaseServer } from "./supabase/server";

export async function myContinueReading(): Promise<ContinueCard | null> {
  const now = Date.now();
  const supabase = await supabaseServer();
  if (!supabase) {
    const store = await cookies();
    const open = settleExpired(parsePreviewLoans(store.get(PREVIEW_COOKIE)?.value), now)
      .filter((l) => l.readerId === PREVIEW_READER && l.returnedAt === null);
    if (open.length === 0) return null;
    const works = getWorks();
    const loans: ContinueLoan[] = open.flatMap((l) => {
      const w = works.find((x) => x.slug === l.workId);
      return w ? [{ workKey: w.slug, slug: w.slug, title: w.title, bookmarkOffset: l.bookmark.wordOffset }] : [];
    });
    const chapters: Record<string, ContinueChapter[]> = Object.fromEntries(works.map((w) => [w.slug,
      w.chapters.map((c) => ({ key: String(c.position), position: c.position, title: c.title, words: c.words ?? countWords(c.body) }))]));
    const sessions: WorkSession[] = parseStoredStats(store.get(PREVIEW_SESSIONS_COOKIE)?.value)
      .filter((s) => s.slug)
      .map((s) => ({ ...s, workKey: s.slug!, ...(s.position ? { chapterKey: String(s.position) } : {}) }));
    return continueReading(loans, sessions, chapters, (await myPace()).wpm);
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: rows } = await supabase.from("loans").select("*")
    .eq("reader_id", auth.user.id).is("returned_at", null).gt("due_at", new Date(now).toISOString());
  const open = ((rows ?? []) as LoanRow[]).map(rowToLoan);
  if (open.length === 0) return null;
  const ids = open.map((l) => l.workId);
  const [{ data: works }, { data: chs }, { data: sess }] = await Promise.all([
    supabase.from("works").select("id, slug, title").in("id", ids).is("archived_at", null),
    supabase.from("chapters").select("id, work_id, position, title, word_count").in("work_id", ids).is("archived_at", null).limit(2000),
    supabase.from("sessions").select("work_id, chapter_id, words_read, started_at, ended_at")
      .eq("reader_id", auth.user.id).in("work_id", ids).order("started_at", { ascending: false }).limit(1000),
  ]);
  const byId = new Map(((works ?? []) as { id: string; slug: string; title: string }[]).map((w) => [w.id, w]));
  const loans: ContinueLoan[] = open.flatMap((l) => {
    const w = byId.get(l.workId);
    return w ? [{ workKey: w.id, slug: w.slug, title: w.title, bookmarkOffset: l.bookmark.wordOffset }] : [];
  });
  const chapters: Record<string, ContinueChapter[]> = {};
  for (const c of (chs ?? []) as { id: string; work_id: string; position: number; title: string; word_count: number }[]) {
    (chapters[c.work_id] ??= []).push({ key: c.id, position: c.position, title: c.title, words: c.word_count });
  }
  const sessions: WorkSession[] = (sess ?? []).map((r) => ({
    workKey: r.work_id as string, ...(r.chapter_id ? { chapterKey: r.chapter_id as string } : {}),
    wordsRead: r.words_read as number, activeMs: 0, endedAt: Date.parse((r.ended_at ?? r.started_at) as string),
  }));
  return continueReading(loans, sessions, chapters, (await myPace()).wpm);
}
