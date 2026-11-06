import "server-only";
// Loads the family wall and timeline: the library's stored copy when there is one,
// otherwise the files in content/. Saves are owner-only and validated first.
import { cache } from "react";
import { LINEAGE } from "@/content/lineage";
import { TIMELINE } from "@/content/timeline";
import { checkAtlas, storedOr, type AtlasKind } from "./atlas";
import { loadCatalogue } from "./catalogueServer";
import type { Lineage } from "./lineage";
import type { Timeline } from "./timeline";
import { supabaseServer } from "./supabase/server";
import { ownerClient } from "./writersRoom";

export interface Atlas {
  mode: "preview" | "library";
  signedIn: boolean;
  lineage: Lineage;
  timeline: Timeline;
  stored: Record<AtlasKind, boolean>;
}

export const loadAtlas = cache(async (): Promise<Atlas> => {
  const supabase = await supabaseServer();
  const files = { lineage: LINEAGE, timeline: TIMELINE };
  if (!supabase) return { mode: "preview", signedIn: false, ...files, stored: { lineage: false, timeline: false } };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { mode: "library", signedIn: false, ...files, stored: { lineage: false, timeline: false } };
  const { data } = await supabase.from("atlas_documents").select("kind, body");
  const rows = new Map(((data ?? []) as { kind: AtlasKind; body: unknown }[]).map((r) => [r.kind, r.body]));
  const lineage = storedOr("lineage", rows.get("lineage"), LINEAGE);
  const timeline = storedOr("timeline", rows.get("timeline"), TIMELINE);
  return { mode: "library", signedIn: true, lineage: lineage.value, timeline: timeline.value, stored: { lineage: lineage.fromLibrary, timeline: timeline.fromLibrary } };
});

export async function saveAtlas(kind: AtlasKind, text: string): Promise<{ ok: boolean; message: string; errors?: string[] }> {
  const { supabase, reason } = await ownerClient();
  if (!supabase) return { ok: false, message: reason === "preview" ? "Saving needs the library to be connected." : "Only the Keeper can edit this." };
  const known = (await loadCatalogue()).works.map((w) => w.slug);
  const checked = checkAtlas(kind, text, known);
  if (!checked.ok) return { ok: false, message: "Nothing saved yet:", errors: checked.errors };
  const { error } = await supabase.from("atlas_documents").upsert({ kind, body: checked.value }, { onConflict: "kind" });
  if (error) return { ok: false, message: "Couldn't save just now." };
  return { ok: true, message: kind === "lineage" ? "The family wall is updated." : "The timeline is updated." };
}
