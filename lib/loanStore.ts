import "server-only";
// Where loans live. With Supabase connected: the loans table (rules enforced by RLS +
// the desk triggers). Without it: a preview desk kept in a cookie in this browser only.
import { cookies } from "next/headers";
import type { Loan, LoanPeriod } from "./engine/checkout";
import {
  deskBorrow, deskRenew, deskReturn, parsePreviewLoans, PREVIEW_COOKIE, PREVIEW_READER,
  onLoanNow, rowToLoan, serializePreviewLoans, settleExpired, type DeskResult, type LoanRow, type OnLoan, recentlyReturned, type Returned,
} from "./loanDesk";
import { getWorks } from "./catalogue";
import { countWords } from "./engine/readingTime";
import { supabaseServer } from "./supabase/server";

export type DeskMode = "preview" | "library" | "signed-out" | "not-shelved";

export interface DeskView {
  mode: DeskMode;
  readerId: string;
  workId: string;
  loans: Loan[];
}

const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 60 };

async function previewLoans(): Promise<Loan[]> {
  return settleExpired(parsePreviewLoans((await cookies()).get(PREVIEW_COOKIE)?.value), Date.now());
}

async function libraryContext(slug: string) {
  const supabase = await supabaseServer();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { supabase, user: null, workId: null };
  const { data: work } = await supabase.from("works").select("id").eq("slug", slug).maybeSingle();
  return { supabase, user: auth.user, workId: (work?.id as string | undefined) ?? null };
}

export async function loadDesk(slug: string): Promise<DeskView> {
  const ctx = await libraryContext(slug);
  if (!ctx) return { mode: "preview", readerId: PREVIEW_READER, workId: slug, loans: await previewLoans() };
  if (!ctx.user) return { mode: "signed-out", readerId: "", workId: "", loans: [] };
  if (!ctx.workId) return { mode: "not-shelved", readerId: ctx.user.id, workId: "", loans: [] };
  await ctx.supabase.rpc("return_expired_loans");
  const { data } = await ctx.supabase.from("loans").select("*")
    .eq("work_id", ctx.workId).eq("reader_id", ctx.user.id).order("borrowed_at", { ascending: false }).limit(20);
  return { mode: "library", readerId: ctx.user.id, workId: ctx.workId, loans: ((data ?? []) as LoanRow[]).map(rowToLoan) };
}

type Op = { kind: "borrow"; period: LoanPeriod } | { kind: "renew"; loanId: string } | { kind: "return"; loanId: string };

const FRIENDLY: [RegExp, string][] = [
  [/duplicate key|loans_one_open/, "This work is already on loan to you — renew it instead."],
  [/renewal limit/, "Renewal limit reached (3). Return it and borrow again when you're ready."],
  [/expired/, "That loan has ended — the book is back on the shelf. Borrow it again."],
  [/has been returned/, "That book has already been returned."],
  [/row-level security/, "This work isn't on your shelves."],
];
const friendly = (m: string) => FRIENDLY.find(([re]) => re.test(m))?.[1] ?? "The desk couldn't stamp that just now. Please try again.";

export async function runDesk(slug: string, op: Op): Promise<{ ok: boolean; message: string }> {
  const ctx = await libraryContext(slug);
  const now = Date.now();

  if (!ctx) {
    const loans = await previewLoans();
    let r: DeskResult;
    if (op.kind === "borrow") r = deskBorrow(loans, { id: crypto.randomUUID(), workId: slug, readerId: PREVIEW_READER, period: op.period, now });
    else if (op.kind === "renew") r = deskRenew(loans, op.loanId, now);
    else r = deskReturn(loans, op.loanId, now);
    if (r.ok) (await cookies()).set(PREVIEW_COOKIE, serializePreviewLoans(r.loans), COOKIE_OPTS);
    return { ok: r.ok, message: r.message };
  }
  if (!ctx.user) return { ok: false, message: "Show your reader card at the front desk first." };
  if (!ctx.workId) return { ok: false, message: "This work isn't on your shelves." };

  const { supabase } = ctx;
  await supabase.rpc("return_expired_loans");
  if (op.kind === "borrow") {
    // due_at is stamped by the desk trigger; the value sent here is ignored.
    const { error } = await supabase.from("loans").insert({ work_id: ctx.workId, period: op.period, due_at: new Date(now + 60_000).toISOString() });
    return error ? { ok: false, message: friendly(error.message) } : { ok: true, message: "Stamped. Enjoy the reading room." };
  }
  if (op.kind === "renew") {
    const { data: row } = await supabase.from("loans").select("renewals").eq("id", op.loanId).maybeSingle();
    if (!row) return { ok: false, message: "The desk has no record of that loan." };
    const { error } = await supabase.from("loans").update({ renewals: (row.renewals as number) + 1 }).eq("id", op.loanId);
    return error ? { ok: false, message: friendly(error.message) } : { ok: true, message: "Renewed for another period." };
  }
  const { error } = await supabase.from("loans").update({ returned_at: new Date(now).toISOString() }).eq("id", op.loanId);
  return error ? { ok: false, message: friendly(error.message) } : { ok: true, message: "Returned to the shelf. Your bookmark is kept." };
}

/** What the reader has out right now (front desk). Library: their loans table rows; preview: the cookie desk. */
export async function myOpenLoans(): Promise<OnLoan[]> {
  const now = Date.now();
  const supabase = await supabaseServer();
  if (!supabase) {
    const works = Object.fromEntries(getWorks().map((w) => [w.slug, { slug: w.slug, title: w.title }]));
    return onLoanNow(await previewLoans(), PREVIEW_READER, works, now);
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data: rows } = await supabase.from("loans").select("*")
    .eq("reader_id", auth.user.id).is("returned_at", null).gt("due_at", new Date(now).toISOString());
  const loans = ((rows ?? []) as LoanRow[]).map(rowToLoan);
  if (loans.length === 0) return [];
  const { data: works } = await supabase.from("works").select("id, slug, title").in("id", loans.map((l) => l.workId)).is("archived_at", null);
  const byId = Object.fromEntries(((works ?? []) as { id: string; slug: string; title: string }[]).map((w) => [w.id, { slug: w.slug, title: w.title }]));
  return onLoanNow(loans, auth.user.id, byId, now);
}

/** The reader's own recently returned works (C26). Library mode reads only the reader's own loans (RLS agrees). */
export async function myRecentlyReturned(): Promise<Returned[]> {
  const now = Date.now();
  const supabase = await supabaseServer();
  if (!supabase) {
    const works = Object.fromEntries(getWorks().map((w) => [w.slug, { slug: w.slug, title: w.title }]));
    return recentlyReturned(await previewLoans(), PREVIEW_READER, works, now);
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data: rows } = await supabase.from("loans").select("*")
    .eq("reader_id", auth.user.id).order("borrowed_at", { ascending: false }).limit(60);
  const loans = ((rows ?? []) as LoanRow[]).map(rowToLoan);
  if (loans.length === 0) return [];
  const { data: works } = await supabase.from("works").select("id, slug, title").in("id", [...new Set(loans.map((l) => l.workId))]).is("archived_at", null);
  const byId = Object.fromEntries(((works ?? []) as { id: string; slug: string; title: string }[]).map((w) => [w.id, { slug: w.slug, title: w.title }]));
  return recentlyReturned(loans, auth.user.id, byId, now);
}

/** C74: total words of each work on loan (keyed by slug), for "About N min left in this book" at the front desk. */
export async function myLoanWords(loans: OnLoan[]): Promise<Record<string, number>> {
  if (loans.length === 0) return {};
  const supabase = await supabaseServer();
  if (!supabase) {
    const slugs = new Set(loans.map((l) => l.slug));
    return Object.fromEntries(getWorks().filter((w) => slugs.has(w.slug)).map((w) => [w.slug, w.chapters.reduce((n, c) => n + countWords(c.body), 0)]));
  }
  const { data: rows } = await supabase.from("chapters").select("work_id, word_count").in("work_id", loans.map((l) => l.workKey)).is("archived_at", null);
  const out: Record<string, number> = {};
  for (const l of loans) out[l.slug] = (rows ?? []).filter((r) => r.work_id === l.workKey).reduce((n, r) => n + ((r.word_count as number) ?? 0), 0);
  return out;
}
