"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { findWork } from "@/lib/catalogueServer";
import { kitFromForm } from "@/lib/pitch";
import { saveKit } from "@/lib/pitchStore";
import { ownerClient } from "@/lib/writersRoom";

export interface LinkState { ok: boolean; message: string; url?: string }

export async function shareAction(_: LinkState, form: FormData): Promise<LinkState> {
  const { supabase, reason } = await ownerClient();
  if (!supabase) return { ok: false, message: reason === "preview" ? "Share links need the library to be connected." : "Only the Keeper can share pitches." };
  const slug = String(form.get("slug") ?? "");
  if (!(await findWork(slug))) return { ok: false, message: "That work isn't on the shelves." };
  const note = String(form.get("note") ?? "").trim().slice(0, 200);
  const days = Math.min(60, Math.max(1, Number.parseInt(String(form.get("days") ?? "14"), 10) || 14));
  const { data, error } = await supabase.rpc("create_pitch_link", { p_slug: slug, p_note: note, p_days: days });
  if (error || typeof data !== "string") return { ok: false, message: "Couldn't make a link just now." };
  const h = await headers();
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  revalidatePath("/pitch-room");
  return { ok: true, message: `Link for ${note || "your reader"}, valid ${days} days. Copy it now — it's shown only once:`, url: `${base}/p/${data}` };
}

export async function revokeLinkAction(_: LinkState, form: FormData): Promise<LinkState> {
  const { supabase } = await ownerClient();
  if (!supabase) return { ok: false, message: "Only the Keeper can do that." };
  const { error } = await supabase.from("pitch_links").update({ revoked_at: new Date().toISOString() }).eq("id", String(form.get("id") ?? ""));
  revalidatePath("/pitch-room");
  return error ? { ok: false, message: "Couldn't revoke that link." } : { ok: true, message: "Link closed." };
}

export interface KitState { ok: boolean; message: string; errors?: string[] }

export async function saveKitAction(_: KitState, form: FormData): Promise<KitState> {
  const slug = String(form.get("slug") ?? "");
  const parsed = kitFromForm(slug, (n) => form.get(n));
  if (!parsed.ok) return { ok: false, message: "Nothing saved yet:", errors: parsed.errors };
  const r = await saveKit(parsed.kit);
  if (r.ok) {
    revalidatePath("/pitch-room");
    revalidatePath(`/pitch-room/${slug}`);
  }
  return r;
}
