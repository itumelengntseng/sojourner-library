import "server-only";
import { getPitch } from "@/content/pitches";
import { getWork } from "./catalogue";
import { formatDuration, minutesFor, DEFAULT_WPM } from "./engine/readingTime";
import { isPlausibleToken, type PitchKit } from "./pitch";
import { supabaseServer } from "./supabase/server";
import { workStats } from "./workStats";
import { ownerClient } from "./writersRoom";

export interface PitchWork { title: string; author: string; words: number; readingTime: string }

export function pitchFor(slug: string, fromDb?: { title: string | null; author: string | null; word_count: number | null }): { kit: PitchKit; work: PitchWork } | null {
  const kit = getPitch(slug);
  if (!kit) return null;
  const cat = getWork(slug);
  const words = fromDb?.word_count || (cat ? workStats(cat).words : 0);
  return {
    kit,
    work: {
      title: fromDb?.title ?? cat?.title ?? slug,
      author: fromDb?.author ?? cat?.author ?? "Itumeleng Ntseng",
      words,
      readingTime: formatDuration(minutesFor(words, DEFAULT_WPM)),
    },
  };
}

/** Public share view: null unless the link is live. Works in library mode only. */
export async function openSharedPitch(token: string) {
  if (!isPlausibleToken(token)) return null;
  const supabase = await supabaseServer();
  if (!supabase) return null;
  const { data } = await supabase.rpc("open_pitch_link", { p_token: token });
  const row = (data as { work_slug: string; title: string | null; author: string | null; word_count: number | null }[] | null)?.[0];
  return row ? pitchFor(row.work_slug, row) : null;
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
