"use client";

import { useActionState } from "react";
import { redeemInvite, savePrefs, sendMagicLink, type FormState } from "./actions";
import { WPM_MAX, WPM_MIN } from "@/lib/membership";

const initial: FormState = { ok: false, message: "" };
const field =
  "w-full rounded border border-sandstone/40 bg-ink/60 px-3 py-2 font-sans text-paper placeholder:text-sandstone/50";
const button =
  "rounded bg-lamplight px-4 py-2 font-sans text-sm font-semibold text-ink hover:bg-ember disabled:opacity-60";

function Status({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p role="status" className={`font-sans text-sm ${state.ok ? "text-lamplight" : "text-ember"}`}>
      {state.message}
    </p>
  );
}

export function SignInForm() {
  const [state, action, pending] = useActionState(sendMagicLink, initial);
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-3">
      <label htmlFor="email" className="font-sans text-sm text-sandstone">Your email</label>
      <input id="email" name="email" type="email" autoComplete="email" required className={field} />
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Sending…" : "Send me a link to the desk"}
      </button>
      <Status state={state} />
    </form>
  );
}

export function RedeemForm() {
  const [state, action, pending] = useActionState(redeemInvite, initial);
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-3">
      <label htmlFor="code" className="font-sans text-sm text-sandstone">Invite code</label>
      <input id="code" name="code" required placeholder="SOJ-XXXX-XXXX-XXXX" autoComplete="off" className={`${field} font-mono uppercase`} />
      <label htmlFor="name" className="font-sans text-sm text-sandstone">Name for your card</label>
      <input id="name" name="name" maxLength={80} autoComplete="name" className={field} />
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Stamping…" : "Issue my card"}
      </button>
      <Status state={state} />
    </form>
  );
}

/** Name on the card and reading pace — the reader's own settings. */
export function PrefsForm({ name, wpm }: { name: string; wpm: number | null }) {
  const [state, action, pending] = useActionState(savePrefs, initial);
  return (
    <details className="w-full max-w-md text-left">
      <summary className="cursor-pointer text-center font-sans text-sm text-lamplight underline underline-offset-4">Your name and reading pace</summary>
      <form action={action} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1 font-sans text-xs uppercase tracking-wider text-sandstone">Name on your card
          <input name="name" maxLength={60} defaultValue={name} className={field} />
        </label>
        <label className="flex flex-col gap-1 font-sans text-xs uppercase tracking-wider text-sandstone">Reading pace (words a minute)
          <input name="wpm" type="number" min={WPM_MIN} max={WPM_MAX} defaultValue={wpm ?? ""} placeholder="Learned as you read" className={field} />
        </label>
        <label className="flex items-center gap-2 font-sans text-sm text-paper">
          <input type="checkbox" name="learn" defaultChecked={wpm === null} className="accent-lamplight" />
          Let the library learn my pace instead
        </label>
        <div><button type="submit" disabled={pending} className={button}>{pending ? "Saving…" : "Save"}</button></div>
        <Status state={state} />
      </form>
    </details>
  );
}
