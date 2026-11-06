import "server-only";
// Records reading sessions and reads back the reader's pace.
import { cookies } from "next/headers";
import { getWork } from "./catalogue";
import { activeMs, countWords } from "./engine/readingTime";
import { openLoan, parsePreviewLoans, PREVIEW_COOKIE, PREVIEW_READER, settleExpired } from "./loanDesk";
import { capWords, paceFrom, parseStoredStats, PREVIEW_SESSIONS_COOKIE, toStats, upsertStats, type Pace, type SessionPayload } from "./sessions";
import { supabaseServer } from "./supabase/server";

const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 180 };

export async function recordSession(p: SessionPayload): Promise<boolean> {
  const supabase = await supabaseServer();
  const now = Date.now();
  if (!supabase) {
    const work = getWork(p.slug);
    const ch = work?.chapters.find((c) => c.position === p.position);
    const store = await cookies();
    const loans = settleExpired(parsePreviewLoans(store.get(PREVIEW_COOKIE)?.value), now);
    if (!work || !ch || !openLoan(loans, p.slug, PREVIEW_READER, now)) return false;
    const stats = toStats(capWords(p, countWords(ch.body)));
    const list = upsertStats(parseStoredStats(store.get(PREVIEW_SESSIONS_COOKIE)?.value), { id: p.sessionId, slug: p.slug, ...stats });
    store.set(PREVIEW_SESSIONS_COOKIE, JSON.stringify(list), COOKIE_OPTS);
    return true;
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { data: work } = await supabase.from("works").select("id").eq("slug", p.slug).maybeSingle();
  if (!work) return false;
  const { data: ch } = await supabase.from("chapters").select("id, word_count").eq("work_id", work.id).eq("position", p.position).maybeSingle();
  if (!ch) return false;
  const capped = capWords(p, ch.word_count as number);
  const { error } = await supabase.from("sessions").upsert({
    id: p.sessionId, work_id: work.id, chapter_id: ch.id,
    started_at: new Date(p.startedAt).toISOString(),
    ended_at: new Date(capped.activity[capped.activity.length - 1] ?? p.startedAt).toISOString(),
    words_read: capped.wordsRead,
    activity: capped.activity.map((t) => new Date(t).toISOString()),
  });
  if (error) console.error("session", error.message);
  return !error;
}

export async function myPace(): Promise<Pace> {
  const supabase = await supabaseServer();
  if (!supabase) return paceFrom(parseStoredStats((await cookies()).get(PREVIEW_SESSIONS_COOKIE)?.value));
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return paceFrom([]);
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const [{ data: me }, { data: rows }] = await Promise.all([
    supabase.from("readers").select("wpm_override").eq("id", auth.user.id).maybeSingle(),
    supabase.from("sessions").select("words_read, activity, ended_at, started_at")
      .eq("reader_id", auth.user.id).gte("started_at", since).order("started_at", { ascending: false }).limit(200),
  ]);
  const stats = (rows ?? []).map((r) => {
    const act = ((r.activity as string[]) ?? []).map((t) => Date.parse(t));
    return { wordsRead: r.words_read as number, activeMs: activeMs(act), endedAt: Date.parse((r.ended_at ?? r.started_at) as string) };
  });
  return paceFrom(stats, (me?.wpm_override as number | null) ?? null);
}
