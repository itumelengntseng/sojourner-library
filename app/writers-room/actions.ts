"use server";

import { revalidatePath } from "next/cache";
import { importedMessage, parseManuscript, slugify } from "@/lib/manuscript";
import { ownerClient } from "@/lib/writersRoom";
import { checkHall } from "@/lib/catalogueRows";

export interface RoomState {
  ok: boolean;
  message: string;
  code?: string;
  /** C216: a follow-on link shown with the message (e.g. the proof copy after an import). */
  link?: { href: string; label: string };
}

const CANON = ["canon", "draft", "apocrypha"];
const closed = (reason: string | null): RoomState => ({
  ok: false,
  message: reason === "preview" ? "Saving needs the library to be connected (see NEEDS ITU)." : "Only the Keeper of the Library can do that.",
});

export async function importAction(_: RoomState, form: FormData): Promise<RoomState> {
  const { supabase, reason } = await ownerClient();
  if (!supabase) return closed(reason);
  const md = String(form.get("manuscript") ?? "");
  const parsed = parseManuscript(md); // re-parsed here: the browser preview is never trusted
  if (parsed.chapters.length === 0) return { ok: false, message: "There's no text to import." };
  const title = String(form.get("title") ?? "").trim() || parsed.title || "Untitled";
  const slug = slugify(String(form.get("slug") ?? "") || title);
  const canon = String(form.get("canon") ?? "draft");
  if (!CANON.includes(canon)) return { ok: false, message: "Choose canon, draft or apocrypha." };
  const { error } = await supabase.rpc("import_manuscript", {
    p_slug: slug, p_title: title, p_canon_status: canon,
    p_chapters: parsed.chapters.map((c) => ({ title: c.title, body: c.body, words: c.words })),
  });
  if (error) return { ok: false, message: `The import didn't go through: ${error.message}` };
  revalidatePath("/writers-room");
  // C216: say where it now stands (a re-import keeps the work's sharing) and offer the proof copy.
  const { data: row } = await supabase.from("works").select("visibility").eq("slug", slug).maybeSingle();
  const visibility = row?.visibility === "members" ? "members" : "owner";
  return { ok: true, message: importedMessage(title, parsed.chapters.length, parsed.words, canon, visibility), link: { href: `/works/${slug}/proof`, label: "Open the proof copy" } };
}

export async function workSettingsAction(_: RoomState, form: FormData): Promise<RoomState> {
  const { supabase, reason } = await ownerClient();
  if (!supabase) return closed(reason);
  const id = String(form.get("id") ?? "");
  const visibility = String(form.get("visibility") ?? "");
  const canon = String(form.get("canon") ?? "");
  const hall = String(form.get("hall") ?? "main");
  if (!["owner", "members"].includes(visibility) || !CANON.includes(canon) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(hall)) return { ok: false, message: "Unknown setting." };
  const { error } = await supabase.from("works").update({ visibility, canon_status: canon, hall, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, message: "Couldn't save that." };
  revalidatePath("/writers-room");
  revalidatePath("/halls");
  return { ok: true, message: visibility === "members" ? "Saved — on the shelves for card holders." : "Saved — visible only to you." };
}

const DESCRIPTION_MAX = 2000;

export async function descriptionAction(_: RoomState, form: FormData): Promise<RoomState> {
  const { supabase, reason } = await ownerClient();
  if (!supabase) return closed(reason);
  const id = String(form.get("id") ?? "");
  const description = String(form.get("description") ?? "").replace(/\r\n?/g, "\n").trim();
  if (description.length > DESCRIPTION_MAX) return { ok: false, message: `Keep it under ${DESCRIPTION_MAX} characters (it's ${description.length}).` };
  const { error } = await supabase.from("works").update({ description, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, message: "Couldn't save that." };
  revalidatePath("/writers-room");
  revalidatePath("/", "layout");
  return { ok: true, message: description ? "Description saved." : "Description cleared." };
}

export async function inviteAction(_: RoomState, form: FormData): Promise<RoomState> {
  const { supabase, reason } = await ownerClient();
  if (!supabase) return closed(reason);
  const note = String(form.get("note") ?? "").trim().slice(0, 200);
  const days = Math.min(90, Math.max(1, Number.parseInt(String(form.get("days") ?? "14"), 10) || 14));
  const { data, error } = await supabase.rpc("create_invite", { p_note: note, p_days: days });
  if (error || typeof data !== "string") return { ok: false, message: "Couldn't issue an invite just now." };
  revalidatePath("/writers-room");
  return { ok: true, message: `Invite for ${note || "a guest"}, valid ${days} days. This code is shown only once:`, code: data };
}

export async function revokeAction(_: RoomState, form: FormData): Promise<RoomState> {
  const { supabase, reason } = await ownerClient();
  if (!supabase) return closed(reason);
  const { error } = await supabase.from("invites").update({ revoked_at: new Date().toISOString() }).eq("id", String(form.get("id") ?? "")).is("redeemed_at", null);
  if (error) return { ok: false, message: "Couldn't revoke that invite." };
  revalidatePath("/writers-room");
  return { ok: true, message: "Invite revoked." };
}

/** Name a new hall, or rename / re-note / reorder one. Halls are never deleted. */
export async function hallAction(_: RoomState, form: FormData): Promise<RoomState> {
  const { supabase, reason } = await ownerClient();
  if (!supabase) return closed(reason);
  const checked = checkHall(form.get("name"), form.get("note"), form.get("position"));
  if (!checked.ok) return { ok: false, message: checked.message };
  const existing = String(form.get("id") ?? "");
  const id = existing || slugify(checked.name);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) || id.length > 60) return { ok: false, message: "That name doesn't make a usable hall address." };
  if (!existing) {
    const { data: clash } = await supabase.from("halls").select("id").eq("id", id).maybeSingle();
    if (clash) return { ok: false, message: "There's already a hall with that name." };
  }
  const { error } = await supabase.from("halls").upsert({ id, name: checked.name, note: checked.note, position: checked.position }, { onConflict: "id" });
  if (error) return { ok: false, message: "Couldn't save the hall." };
  revalidatePath("/writers-room");
  revalidatePath("/halls");
  return { ok: true, message: existing ? `Saved "${checked.name}".` : `"${checked.name}" is open.` };
}

/** Set a work aside (hidden from every shelf, kept whole) or bring it back. Nothing is deleted. */
export async function archiveAction(_: RoomState, form: FormData): Promise<RoomState> {
  const { supabase, reason } = await ownerClient();
  if (!supabase) return closed(reason);
  const id = String(form.get("id") ?? "");
  const intent = String(form.get("intent") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["archive", "restore"].includes(intent)) return { ok: false, message: "Unknown request." };
  const now = new Date().toISOString();
  const { error } = await supabase.from("works").update({ archived_at: intent === "archive" ? now : null, updated_at: now }).eq("id", id);
  if (error) return { ok: false, message: "Couldn't do that just now." };
  revalidatePath("/writers-room");
  revalidatePath("/", "layout");
  return { ok: true, message: intent === "archive" ? "Set aside — off the shelves, kept safe. Restore it below any time." : "Back on the shelves." };
}
