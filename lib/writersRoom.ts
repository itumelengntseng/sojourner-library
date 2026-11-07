import "server-only";
import { getWorks, HALLS, type Hall } from "./catalogue";
import { hallsFromRows, type HallRow } from "./catalogueRows";
import { countWords } from "./engine/readingTime";
import type { ShelvedWork } from "./manuscript";
import { supabaseServer } from "./supabase/server";
import { dueBackSoon } from "./loanDesk";
import { myOpenLoans } from "./loanStore";

export interface RoomWork {
  id: string;
  slug: string;
  title: string;
  canonStatus: "canon" | "draft" | "apocrypha";
  visibility: "owner" | "members";
  isPlaceholder: boolean;
  description: string;
  hall: string;
  words: number;
  readers: number;
  openLoans: number;
  minutes: number;
  /** Guest readers who read it to the end (C45); undefined until 0014 is applied to the live database. */
  finished?: number;
  /** Last change to the work row (library mode) — import, settings, description, sharing. */
  updatedAt?: string;
}

export interface RoomInvite {
  id: string;
  note: string;
  expiresAt: string;
  redeemed: boolean;
  revoked: boolean;
}

export type Room =
  | { mode: "preview"; works: RoomWork[]; halls: Hall[]; shelf: Record<string, ShelvedWork>; dueSoon: number }
  | { mode: "closed"; reason: "signed-out" | "not-owner" }
  | { mode: "library"; works: RoomWork[]; invites: RoomInvite[]; halls: Hall[]; hallsNamed: boolean; setAside: { id: string; slug: string; title: string; archivedAt: string }[]; shelf: Record<string, ShelvedWork>; cardHolders: number; dueSoon: number };

/** The owner's client, or null (with why) — every Writer's Room action goes through this. */
export async function ownerClient() {
  const supabase = await supabaseServer();
  if (!supabase) return { supabase: null, reason: "preview" as const };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { supabase: null, reason: "signed-out" as const };
  const { data: me } = await supabase.from("readers").select("role").eq("id", data.user.id).maybeSingle();
  if (me?.role !== "owner") return { supabase: null, reason: "not-owner" as const };
  return { supabase, reason: null };
}

export async function loadRoom(): Promise<Room> {
  const { supabase, reason } = await ownerClient();
  if (reason === "preview") {
    // C122: preview counts the visitor's own cookie desk (the only loans there are).
    const out = await myOpenLoans();
    const outBySlug = new Map<string, number>();
    for (const l of out) outBySlug.set(l.slug, (outBySlug.get(l.slug) ?? 0) + 1);
    return {
      mode: "preview",
      dueSoon: dueBackSoon(out, Date.now()).length,
      works: getWorks().map((w) => ({
        id: w.slug, slug: w.slug, title: w.title, canonStatus: w.canonStatus, visibility: "owner", isPlaceholder: true, description: "", hall: w.hall,
        words: 0, readers: 0, openLoans: outBySlug.get(w.slug) ?? 0, minutes: 0,
      })),
      halls: [...HALLS],
      shelf: Object.fromEntries(getWorks().map((w) => [w.slug, {
        title: w.title, setAside: false,
        chapters: w.chapters.map((c) => ({ position: c.position, title: c.title, words: c.words ?? countWords(c.body), archived: false })),
      }])),
    };
  }
  if (!supabase) return { mode: "closed", reason: reason as "signed-out" | "not-owner" };
  const nowMs = Date.now();
  const [{ data: works }, { data: stats }, { data: invites }, { data: hallRows }, { data: archived }, { data: chapterRows }, { count: cardHolders }, finishedRes, { count: dueSoon }] = await Promise.all([
    supabase.from("works").select("id, slug, title, canon_status, visibility, is_placeholder, description, hall, word_count, updated_at").is("archived_at", null).order("title"),
    supabase.rpc("readership"),
    supabase.from("invites").select("id, note, expires_at, redeemed_at, revoked_at").eq("role", "guest").order("created_at", { ascending: false }).limit(50),
    supabase.from("halls").select("id, name, note, position"),
    supabase.from("works").select("id, slug, title, archived_at").not("archived_at", "is", null).order("archived_at", { ascending: false }).limit(100),
    supabase.from("chapters").select("work_id, position, title, word_count, archived_at").order("position").limit(10000),
    supabase.from("readers").select("id", { count: "exact", head: true }).eq("role", "guest"),
    supabase.rpc("finished_readers"), // C45 — an error (0014 not applied yet) simply leaves the counts off
    // C122: open loans due back within the day — a head count only (the owner can read loans under RLS).
    supabase.from("loans").select("id", { count: "exact", head: true }).is("returned_at", null)
      .gt("due_at", new Date(nowMs).toISOString()).lte("due_at", new Date(nowMs + 24 * 3600_000).toISOString()),
  ]);
  const finishedBy = finishedRes.error ? null
    : new Map(((finishedRes.data ?? []) as { work_id: string; finished: number | string }[]).map((r) => [r.work_id, Number(r.finished)]));
  // What a re-import would touch: every shelved work (set-aside ones too) with its chapter list.
  const shelf: Record<string, ShelvedWork> = {};
  const byId = new Map<string, ShelvedWork>();
  for (const w of [...(works ?? []).map((x) => ({ ...x, archived_at: null })), ...(archived ?? [])]) {
    const entry: ShelvedWork = { title: w.title as string, setAside: !!w.archived_at, chapters: [] };
    shelf[w.slug as string] = entry;
    byId.set(w.id as string, entry);
  }
  for (const c of (chapterRows ?? []) as { work_id: string; position: number; title: string; word_count: number; archived_at: string | null }[]) {
    byId.get(c.work_id)?.chapters.push({ position: c.position, title: c.title, words: c.word_count, archived: !!c.archived_at });
  }
  const by = new Map(((stats ?? []) as { work_id: string; readers: number; open_loans: number; minutes: number }[]).map((s) => [s.work_id, s]));
  return {
    mode: "library",
    halls: hallsFromRows((hallRows ?? []) as HallRow[]),
    hallsNamed: (hallRows ?? []).length > 0,
    shelf,
    cardHolders: cardHolders ?? 0,
    dueSoon: dueSoon ?? 0,
    setAside: (archived ?? []).map((w) => ({ id: w.id as string, slug: w.slug as string, title: w.title as string, archivedAt: w.archived_at as string })),
    works: (works ?? []).map((w) => ({
      id: w.id as string, slug: w.slug as string, title: w.title as string,
      canonStatus: w.canon_status as RoomWork["canonStatus"], visibility: w.visibility as RoomWork["visibility"],
      isPlaceholder: w.is_placeholder as boolean, description: (w.description as string | null) ?? "", hall: (w.hall as string | null) ?? "main", words: w.word_count as number,
      readers: Number(by.get(w.id as string)?.readers ?? 0), openLoans: Number(by.get(w.id as string)?.open_loans ?? 0),
      minutes: Number(by.get(w.id as string)?.minutes ?? 0),
      updatedAt: (w.updated_at as string | null) ?? undefined,
      ...(finishedBy ? { finished: finishedBy.get(w.id as string) ?? 0 } : {}),
    })),
    invites: (invites ?? []).map((i) => ({
      id: i.id as string, note: i.note as string, expiresAt: i.expires_at as string,
      redeemed: !!i.redeemed_at, revoked: !!i.revoked_at,
    })),
  };
}

