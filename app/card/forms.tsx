"use client";

import { useActionState } from "react";
import { redeemInvite, sendMagicLink, type FormState } from "./actions";

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
