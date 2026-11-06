"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { checkPrefs, friendlyRedeemError, isPlausibleEmail, isPlausibleInviteCode } from "@/lib/membership";

export interface FormState {
  ok: boolean;
  message: string;
}

async function siteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

export async function sendMagicLink(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim();
  if (!isPlausibleEmail(email)) return { ok: false, message: "That doesn't look like an email address." };
  const supabase = await supabaseServer();
  if (!supabase) return { ok: false, message: "The library isn't connected yet." };
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await siteUrl()}/auth/callback?next=/card`, shouldCreateUser: true },
  });
  // Same reply either way, so the form can't be used to probe who is a member.
  if (error) console.error("magic link", error.message);
  return { ok: true, message: "If that address can receive mail, a link to the front desk is on its way." };
}

export async function redeemInvite(_: FormState, form: FormData): Promise<FormState> {
  const code = String(form.get("code") ?? "");
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  if (!isPlausibleInviteCode(code)) return { ok: false, message: "Invite codes look like SOJ-XXXX-XXXX-XXXX." };
  const supabase = await supabaseServer();
  if (!supabase) return { ok: false, message: "The library isn't connected yet." };
  const { error } = await supabase.rpc("redeem_invite", { p_code: code, p_display_name: name });
  if (error) return { ok: false, message: friendlyRedeemError(error.message) };
  redirect("/card");
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase?.auth.signOut();
  redirect("/card");
}

/** The reader's own name and (optional) fixed reading pace. RLS limits this to their own row. */
export async function savePrefs(_: FormState, form: FormData): Promise<FormState> {
  const checked = checkPrefs(form.get("name"), form.get("wpm"), form.get("learn"));
  if (!checked.ok) return { ok: false, message: checked.message };
  const supabase = await supabaseServer();
  if (!supabase) return { ok: false, message: "The library isn't connected yet." };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Sign in first." };
  const { error } = await supabase.from("readers").update({ display_name: checked.displayName, wpm_override: checked.wpmOverride }).eq("id", auth.user.id);
  if (error) return { ok: false, message: "Couldn't save that just now." };
  revalidatePath("/", "layout");
  return { ok: true, message: checked.wpmOverride ? `Saved. The library will time your reading at ${checked.wpmOverride} words a minute.` : "Saved. The library will learn your pace as you read." };
}
