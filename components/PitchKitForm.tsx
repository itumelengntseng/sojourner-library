"use client";

import { useActionState, useState } from "react";
import { saveKitAction, type KitState } from "@/app/pitch-room/actions";
import { KIT_LIMITS, loglineWarning, type PitchKit } from "@/lib/pitch";

const initial: KitState = { ok: false, message: "" };
const field = "w-full rounded border border-sandstone/40 bg-ink/60 px-3 py-2 font-sans text-sm text-paper";
const label = "flex flex-col gap-1 font-sans text-xs uppercase tracking-wider text-sandstone";
const hint = "font-sans text-[0.7rem] normal-case tracking-normal text-sandstone/90";

/** The Keeper's editor for one pitch kit. Every field is the author's to fill; nothing is suggested. */
export function PitchKitForm({ kit, canSave }: { kit: PitchKit; canSave: boolean }) {
  const [state, action, pending] = useActionState(saveKitAction, initial);
  const [logline, setLogline] = useState(kit.logline);
  const warn = loglineWarning(logline);
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={kit.slug} />
      <label className={label}>Logline
        <textarea name="logline" rows={2} maxLength={KIT_LIMITS.logline} value={logline} onChange={(e) => setLogline(e.target.value)} className={field} />
        <span className={warn ? `${hint} text-ember` : hint}>{warn ?? "One sentence. Under 50 words lands best."}</span>
      </label>
      <label className={label}>Synopsis
        <textarea name="synopsis" rows={7} maxLength={KIT_LIMITS.synopsis} defaultValue={kit.synopsis} className={field} />
      </label>
      <div className="grid gap-5 sm:grid-cols-3">
        <label className={label}>Themes
          <textarea name="themes" rows={4} defaultValue={kit.themes.join("\n")} className={field} />
          <span className={hint}>One per line.</span>
        </label>
        <label className={label}>Comparable titles
          <textarea name="comparables" rows={4} defaultValue={kit.comparables.join("\n")} className={field} />
          <span className={hint}>One per line.</span>
        </label>
        <label className={label}>Formats
          <textarea name="formats" rows={4} defaultValue={kit.formats.join("\n")} className={field} />
          <span className={hint}>e.g. novel, series, film — one per line.</span>
        </label>
      </div>
      <label className={label}>Audience
        <textarea name="audience" rows={2} maxLength={KIT_LIMITS.audience} defaultValue={kit.audience} className={field} />
      </label>
      <label className={label}>Sample excerpt
        <textarea name="sample" rows={8} maxLength={KIT_LIMITS.sample} defaultValue={kit.sample} className={field} />
        <span className={hint}>The passage you choose to open the door. It is never pulled from the manuscript for you.</span>
      </label>
      <label className={label}>From the author
        <textarea name="authorNote" rows={4} maxLength={KIT_LIMITS.authorNote} defaultValue={kit.authorNote} className={field} />
      </label>
      <label className={label}>Contact
        <input name="contact" maxLength={KIT_LIMITS.contact} defaultValue={kit.contact} className={field} />
        <span className={hint}>Shown on share links only if filled in.</span>
      </label>
      <label className="flex items-start gap-2 font-sans text-sm text-paper">
        <input type="checkbox" name="ownWords" defaultChecked={!kit.isPlaceholder} className="mt-1 accent-lamplight" />
        <span>This kit is in my own words — take off the placeholder mark.</span>
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={!canSave || pending} className="rounded bg-lamplight px-4 py-2 font-sans text-sm font-semibold text-ink hover:bg-ember disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? "Saving…" : "Save the kit"}
        </button>
        {state.message && (
          <div role="status" className={`font-sans text-sm ${state.ok ? "text-lamplight" : "text-ember"}`}>
            {state.message}
            {state.errors && <ul className="mt-1 list-disc pl-5">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          </div>
        )}
      </div>
    </form>
  );
}
