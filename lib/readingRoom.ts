import "server-only";
// Loads a chapter for the reading room and saves bookmarks / annotations.
// Library mode: Supabase (RLS gives chapter text only during an active loan).
// Preview mode: the placeholder catalogue + the preview loan cookie; notes and
// highlights then stay in the reader's own browser (localStorage).
import { cookies } from "next/headers";
import { getWork } from "./catalogue";
import { countWords } from "./engine/readingTime";
import { MAX_RENEWALS, updateBookmark } from "./engine/checkout";
import { openLoan, parsePreviewLoans, PREVIEW_COOKIE, PREVIEW_READER, serializePreviewLoans, settleExpired } from "./loanDesk";
import { cleanNote, locateBookmark, normaliseSelection, HIGHLIGHT_COLOURS, type Highlight, type HighlightColour, type MarginNote } from "./reader";
import { supabaseServer } from "./supabase/server";
import { ownerClient } from "./writersRoom";
import { withAuthor } from "./catalogueRows";

export interface ChapterInfo { position: number; title: string; words: number }

export interface ReadingData {
  /** proof = the Keeper reading without a loan; nothing is recorded. */
  mode: "preview" | "library" | "proof";
  loanId: string;
  dueAt: number;
  /** C106: renewals still allowed on the open loan (missing = unknown, treated as renewable). */
  renewalsLeft?: number;
  /** C147: when the open loan was taken out (missing in the proof copy). */
  borrowedAt?: number;
  title: string;
  author: string;
  canonStatus: "canon" | "draft" | "apocrypha";
  /** C233: still placeholder text — the reading room says so above every chapter. */
  isPlaceholder?: boolean;
  chapter: { position: number; title: string; body: string };
  chapters: ChapterInfo[];
  bookmark: { position: number; wordsIntoChapter: number } | null;
  notes: MarginNote[];
  highlights: Highlight[];
}

export type Gate = "missing" | "signed-out" | "no-loan";
export type Loaded = { ok: true; data: ReadingData } | { ok: false; gate: Gate };

const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 60 };

async function library() {
  const supabase = await supabaseServer();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

type Sb = NonNullable<Awaited<ReturnType<typeof supabaseServer>>>;

async function libraryLoan(supabase: Sb, slug: string, readerId: string) {
  const { data: work } = await supabase.from("works").select("id, title, author, canon_status, is_placeholder").eq("slug", slug).maybeSingle();
  if (!work) return null;
  await supabase.rpc("return_expired_loans");
  const { data: loan } = await supabase.from("loans").select("id, due_at, bookmark_offset, renewals, borrowed_at")
    .eq("work_id", work.id).eq("reader_id", readerId).is("returned_at", null).gt("due_at", new Date().toISOString()).maybeSingle();
  return { work, loan };
}

async function libraryChapter(supabase: Sb, workId: string, position: number) {
  const { data } = await supabase.from("chapters").select("id").eq("work_id", workId).eq("position", position).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function loadReading(slug: string, position: number): Promise<Loaded> {
  const lib = await library();
  if (!lib) {
    const work = getWork(slug);
    if (!work) return { ok: false, gate: "missing" };
    const loans = settleExpired(parsePreviewLoans((await cookies()).get(PREVIEW_COOKIE)?.value), Date.now());
    const loan = openLoan(loans, slug, PREVIEW_READER, Date.now());
    if (!loan) return { ok: false, gate: "no-loan" };
    const chapters = work.chapters.map((c) => ({ position: c.position, title: c.title, words: countWords(c.body) }));
    const ch = work.chapters.find((c) => c.position === position) ?? work.chapters[0];
    const hasBookmark = loan.bookmark.wordOffset > 0 || loan.bookmark.chapterIndex > 0;
    return {
      ok: true,
      data: {
        mode: "preview", loanId: loan.id, dueAt: loan.dueAt, borrowedAt: loan.borrowedAt, renewalsLeft: Math.max(0, MAX_RENEWALS - loan.renewals), title: work.title, author: work.author, canonStatus: work.canonStatus, isPlaceholder: work.isPlaceholder,
        chapter: { position: ch.position, title: ch.title, body: ch.body }, chapters,
        bookmark: hasBookmark ? locateBookmark(chapters, loan.bookmark.wordOffset) : null,
        notes: [], highlights: [],
      },
    };
  }
  if (!lib.user) return { ok: false, gate: "signed-out" };
  const found = await libraryLoan(lib.supabase, slug, lib.user.id);
  if (!found) return { ok: false, gate: "missing" };
  if (!found.loan) return { ok: false, gate: "no-loan" };
  const { supabase } = lib;
  const { data: rows } = await supabase.from("chapters").select("id, position, title, word_count").eq("work_id", found.work.id).is("archived_at", null).order("position");
  const list = (rows ?? []) as { id: string; position: number; title: string; word_count: number }[];
  if (list.length === 0) return { ok: false, gate: "missing" };
  const ch = list.find((c) => c.position === position) ?? list[0];
  const { data: text } = await supabase.from("chapter_texts").select("body_md").eq("chapter_id", ch.id).maybeSingle();
  const [{ data: notes }, { data: hls }] = await Promise.all([
    supabase.from("notes").select("id, anchor_offset, body, created_at").eq("chapter_id", ch.id),
    supabase.from("highlights").select("id, start_offset, end_offset, colour").eq("chapter_id", ch.id),
  ]);
  const chapters = list.map((c) => ({ position: c.position, title: c.title, words: c.word_count }));
  const offset = found.loan.bookmark_offset as number;
  return {
    ok: true,
    data: {
      mode: "library", loanId: found.loan.id as string, dueAt: Date.parse(found.loan.due_at as string),
      renewalsLeft: Math.max(0, MAX_RENEWALS - ((found.loan.renewals as number | undefined) ?? 0)),
      borrowedAt: found.loan.borrowed_at ? Date.parse(found.loan.borrowed_at as string) : undefined,
      title: found.work.title as string, author: withAuthor(found.work.author as string), isPlaceholder: found.work.is_placeholder !== false,
      canonStatus: found.work.canon_status as ReadingData["canonStatus"],
      chapter: { position: ch.position, title: ch.title, body: (text?.body_md as string | undefined) ?? "" },
      chapters,
      bookmark: offset > 0 ? locateBookmark(chapters, offset) : null,
      notes: (notes ?? []).map((n) => ({ id: n.id as string, anchor: n.anchor_offset as number, body: n.body as string, createdAt: Date.parse(n.created_at as string) })),
      highlights: (hls ?? []).map((h) => ({ id: h.id as string, start: h.start_offset as number, end: h.end_offset as number, colour: h.colour as HighlightColour })),
    },
  };
}

export async function saveBookmark(slug: string, position: number, wordOffset: number): Promise<boolean> {
  if (!Number.isInteger(wordOffset) || wordOffset < 0 || !Number.isInteger(position) || position < 1) return false;
  const lib = await library();
  if (!lib) {
    const store = await cookies();
    const now = Date.now();
    const loans = settleExpired(parsePreviewLoans(store.get(PREVIEW_COOKIE)?.value), now);
    const loan = openLoan(loans, slug, PREVIEW_READER, now);
    if (!loan) return false;
    const moved = updateBookmark(loan, { chapterIndex: position - 1, wordOffset }, now);
    store.set(PREVIEW_COOKIE, serializePreviewLoans(loans.map((l) => (l.id === loan.id ? moved : l))), COOKIE_OPTS);
    return true;
  }
  if (!lib.user) return false;
  const found = await libraryLoan(lib.supabase, slug, lib.user.id);
  if (!found?.loan) return false;
  const chapterId = await libraryChapter(lib.supabase, found.work.id as string, position);
  const { error } = await lib.supabase.from("loans")
    .update({ bookmark_chapter: chapterId, bookmark_offset: wordOffset }).eq("id", found.loan.id);
  return !error;
}

/** Library mode only — in preview the browser keeps annotations itself. */
async function annotationContext(slug: string, position: number) {
  const lib = await library();
  if (!lib?.user) return null;
  const { data: work } = await lib.supabase.from("works").select("id").eq("slug", slug).maybeSingle();
  if (!work) return null;
  const chapterId = await libraryChapter(lib.supabase, work.id as string, position);
  if (!chapterId) return null;
  const { data: text } = await lib.supabase.from("chapter_texts").select("body_md").eq("chapter_id", chapterId).maybeSingle();
  return { supabase: lib.supabase, workId: work.id as string, chapterId, body: (text?.body_md as string | undefined) ?? "" };
}

export async function addNote(slug: string, position: number, anchor: number, body: string): Promise<MarginNote | null> {
  const clean = cleanNote(body);
  const ctx = await annotationContext(slug, position);
  if (!ctx || !clean || anchor < 0 || anchor > ctx.body.length) return null;
  const { data, error } = await ctx.supabase.from("notes")
    .insert({ work_id: ctx.workId, chapter_id: ctx.chapterId, anchor_offset: anchor, body: clean })
    .select("id, created_at").single();
  return error || !data ? null : { id: data.id as string, anchor, body: clean, createdAt: Date.parse(data.created_at as string) };
}

export async function addHighlight(slug: string, position: number, start: number, end: number, colour: string): Promise<Highlight | null> {
  const ctx = await annotationContext(slug, position);
  if (!ctx || !HIGHLIGHT_COLOURS.includes(colour as HighlightColour)) return null;
  const sel = normaliseSelection(ctx.body, start, end);
  if (!sel) return null;
  const { data, error } = await ctx.supabase.from("highlights")
    .insert({ work_id: ctx.workId, chapter_id: ctx.chapterId, start_offset: sel.start, end_offset: sel.end, colour })
    .select("id").single();
  return error || !data ? null : { id: data.id as string, ...sel, colour: colour as HighlightColour };
}

export async function removeAnnotation(kind: "notes" | "highlights", id: string): Promise<boolean> {
  const lib = await library();
  if (!lib?.user || !/^[0-9a-f-]{36}$/i.test(id)) return false;
  const { error } = await lib.supabase.from(kind).delete().eq("id", id); // RLS: only your own
  return !error;
}

export type ProofGate = "missing" | "not-owner";

/**
 * The Keeper's proof copy: read any work (shared or not) without a loan. Nothing is
 * written — no loan, bookmark, session or annotations. Preview mode uses the placeholders.
 */
export async function loadProof(slug: string, position: number): Promise<{ ok: true; data: ReadingData } | { ok: false; gate: ProofGate }> {
  const { supabase, reason } = await ownerClient();
  const base = { loanId: "", dueAt: 0, bookmark: null, notes: [], highlights: [] };
  if (reason === "preview") {
    const work = getWork(slug);
    if (!work) return { ok: false, gate: "missing" };
    const chapters = work.chapters.map((c) => ({ position: c.position, title: c.title, words: countWords(c.body) }));
    const ch = work.chapters.find((c) => c.position === position) ?? work.chapters[0];
    return { ok: true, data: { ...base, mode: "proof", title: work.title, author: work.author, canonStatus: work.canonStatus, isPlaceholder: work.isPlaceholder, chapter: { position: ch.position, title: ch.title, body: ch.body }, chapters } };
  }
  if (!supabase) return { ok: false, gate: "not-owner" };
  const { data: work } = await supabase.from("works").select("id, title, author, canon_status, is_placeholder").eq("slug", slug).is("archived_at", null).maybeSingle();
  if (!work) return { ok: false, gate: "missing" };
  const { data: rows } = await supabase.from("chapters").select("id, position, title, word_count").eq("work_id", work.id).is("archived_at", null).order("position");
  const list = (rows ?? []) as { id: string; position: number; title: string; word_count: number }[];
  if (list.length === 0) return { ok: false, gate: "missing" };
  const ch = list.find((c) => c.position === position) ?? list[0];
  const { data: text } = await supabase.from("chapter_texts").select("body_md").eq("chapter_id", ch.id).maybeSingle();
  return {
    ok: true,
    data: {
      ...base, mode: "proof", title: work.title as string, author: withAuthor(work.author as string), isPlaceholder: work.is_placeholder !== false,
      canonStatus: work.canon_status as ReadingData["canonStatus"],
      chapter: { position: ch.position, title: ch.title, body: (text?.body_md as string | undefined) ?? "" },
      chapters: list.map((c) => ({ position: c.position, title: c.title, words: c.word_count })),
    },
  };
}
