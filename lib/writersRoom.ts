import "server-only";
import { getWorks, HALLS, type Hall } from "./catalogue";
import { hallsFromRows, type HallRow } from "./catalogueRows";
import { supabaseServer } from "./supabase/server";

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
}

export interface RoomInvite {
  id: string;
  note: string;
  expiresAt: string;
  redeemed: boolean;
  revoked: boolean;
}

export type Room =
  | { mode: "preview"; works: RoomWork[]; halls: Hall[] }
  | { mode: "closed"; reason: "signed-out" | "not-owner" }
  | { mode: "library"; works: RoomWork[]; invites: RoomInvite[]; halls: Hall[]; hallsNamed: boolean };

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
    return {
      mode: "preview",
      works: getWorks().map((w) => ({
        id: w.slug, slug: w.slug, title: w.title, canonStatus: w.canonStatus, visibility: "owner", isPlaceholder: true, description: "", hall: w.hall,
        words: 0, readers: 0, openLoans: 0, minutes: 0,
      })),
      halls: [...HALLS],
    };
  }
  if (!supabase) return { mode: "closed", reason: reason as "signed-out" | "not-owner" };
  const [{ data: works }, { data: stats }, { data: invites }, { data: hallRows }] = await Promise.all([
    supabase.from("works").select("id, slug, title, canon_status, visibility, is_placeholder, description, hall, word_count").is("archived_at", null).order("title"),
    supabase.rpc("readership"),
    supabase.from("invites").select("id, note, expires_at, redeemed_at, revoked_at").eq("role", "guest").order("created_at", { ascending: false }).limit(50),
    supabase.from("halls").select("id, name, note, position"),
  ]);
  const by = new Map(((stats ?? []) as { work_id: string; readers: number; open_loans: number; minutes: number }[]).map((s) => [s.work_id, s]));
  return {
    mode: "library",
    halls: hallsFromRows((hallRows ?? []) as HallRow[]),
    hallsNamed: (hallRows ?? []).length > 0,
    works: (works ?? []).map((w) => ({
      id: w.id as string, slug: w.slug as string, title: w.title as string,
      canonStatus: w.canon_status as RoomWork["canonStatus"], visibility: w.visibility as RoomWork["visibility"],
      isPlaceholder: w.is_placeholder as boolean, description: (w.description as string | null) ?? "", hall: (w.hall as string | null) ?? "main", words: w.word_count as number,
      readers: Number(by.get(w.id as string)?.readers ?? 0), openLoans: Number(by.get(w.id as string)?.open_loans ?? 0),
      minutes: Number(by.get(w.id as string)?.minutes ?? 0),
    })),
    invites: (invites ?? []).map((i) => ({
      id: i.id as string, note: i.note as string, expiresAt: i.expires_at as string,
      redeemed: !!i.redeemed_at, revoked: !!i.revoked_at,
    })),
  };
}
