import "server-only";
// Pitch kits: stored in Supabase (owner-only, edited in the Writer's Room) with
// content/pitches.ts as the preview fallback. Work details come from the catalogue.
import { getPitch } from "@/content/pitches";
import { findWork, loadCatalogue } from "./catalogueServer";
import { chooseKit, isPlausibleToken, kitFromRow, kitToRow, pitchWork, sharedPitch, type KitRow, type PitchKit, type PitchWork, type SharedRow } from "./pitch";
import { supabaseServer } from "./supabase/server";
import { workStats } from "./workStats";
import type { Work } from "./catalogue";
export type { PitchWork };
import { ownerClient } from "./writersRoom";

export interface Pitch { kit: PitchKit; work: PitchWork; stored: boolean }

const KIT_COLUMNS = "work_slug, is_placeholder, logline, synopsis, themes, comparables, audience, formats, sample, author_note, contact";

const workInfo = (w: Work | undefined) => (w ? { title: w.title, author: w.author, words: workStats(w).words } : undefined);

/** Every work on the Keeper's shelves with its kit (stored → file → blank). Owner-only. */
export async function roomPitches(): Promise<{ live: boolean; allowed: boolean; pitches: Pitch[] }> {
  const { supabase, reason } = await ownerClient();
  if (reason !== "preview" && !supabase) return { live: true, allowed: false, pitches: [] };
  const { works } = await loadCatalogue();
  let stored = new Map<string, PitchKit>();
  if (supabase) {
    const { data } = await supabase.from("pitch_kits").select(KIT_COLUMNS);
    stored = new Map(((data ?? []) as KitRow[]).map((r) => [r.work_slug, kitFromRow(r)]));
  }
  return {
    live: !!supabase, allowed: true,
    pitches: works.map((w) => ({ kit: chooseKit(w.slug, stored.get(w.slug), getPitch(w.slug)), work: pitchWork(w.slug, workInfo(w)), stored: stored.has(w.slug) })),
  };
}

/** One work's pitch for the Keeper (sheet, one-pager, editor), or null if not allowed / no such work. */
export async function ownerPitch(slug: string): Promise<(Pitch & { live: boolean }) | null> {
  const { supabase, reason } = await ownerClient();
  if (reason !== "preview" && !supabase) return null;
  const work = await findWork(slug);
  if (!work) return null;
  let stored: PitchKit | undefined;
  if (supabase) {
    const { data } = await supabase.from("pitch_kits").select(KIT_COLUMNS).eq("work_slug", slug).maybeSingle();
    if (data) stored = kitFromRow(data as KitRow);
  }
  return { kit: chooseKit(slug, stored, getPitch(slug)), work: pitchWork(slug, workInfo(work)), stored: !!stored, live: !!supabase };
}

export async function saveKit(kit: PitchKit): Promise<{ ok: boolean; message: string }> {
  const { supabase, reason } = await ownerClient();
  if (!supabase) return { ok: false, message: reason === "preview" ? "Saving kits needs the library to be connected." : "Only the Keeper can edit pitches." };
  if (!(await findWork(kit.slug))) return { ok: false, message: "That work isn't on the shelves." };
  const { error } = await supabase.from("pitch_kits").upsert(kitToRow(kit), { onConflict: "work_slug" });
  return error ? { ok: false, message: "Couldn't save the kit just now." } : { ok: true, message: kit.isPlaceholder ? "Saved — still marked as a placeholder." : "Saved in your own words." };
}

/** Public share view: null unless the link is live. Works in library mode only. */
export async function openSharedPitch(token: string): Promise<{ kit: PitchKit; work: PitchWork } | null> {
  if (!isPlausibleToken(token)) return null;
  const supabase = await supabaseServer();
  if (!supabase) return null;
  const { data } = await supabase.rpc("open_pitch_link", { p_token: token });
  const row = (data as SharedRow[] | null)?.[0];
  if (!row) return null;
  return sharedPitch(row, getPitch(row.work_slug));
}

export interface PitchLinkRow { id: string; slug: string; note: string; expiresAt: string; revoked: boolean; views: number }

export async function ownerPitchLinks(): Promise<{ live: boolean; allowed: boolean; links: PitchLinkRow[] }> {
  const { supabase, reason } = await ownerClient();
  if (reason === "preview") return { live: false, allowed: true, links: [] };
  if (!supabase) return { live: true, allowed: false, links: [] };
  const { data } = await supabase.from("pitch_links").select("id, work_slug, note, expires_at, revoked_at, views").order("created_at", { ascending: false }).limit(100);
  return {
    live: true, allowed: true,
    links: (data ?? []).map((l) => ({ id: l.id as string, slug: l.work_slug as string, note: l.note as string, expiresAt: l.expires_at as string, revoked: !!l.revoked_at, views: l.views as number })),
  };
}
