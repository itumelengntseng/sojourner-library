"use client";

import { useActionState } from "react";
import { revokeLinkAction, shareAction, type LinkState } from "@/app/pitch-room/actions";

const initial: LinkState = { ok: false, message: "" };

export function ShareForm({ slug, enabled }: { slug: string; enabled: boolean }) {
  const [state, action, pending] = useActionState(shareAction, initial);
  return (
    <form action={action} className="flex flex-col gap-2 font-sans text-sm">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 text-xs uppercase tracking-wider text-sandstone">For
          <input name="note" maxLength={200} placeholder="Who you're sending it to" className="rounded border border-sandstone/40 bg-ink/60 px-2 py-1.5 text-sm normal-case tracking-normal text-paper" />
        </label>
        <label className="flex w-24 flex-col gap-1 text-xs uppercase tracking-wider text-sandstone">Days
          <input name="days" type="number" min={1} max={60} defaultValue={14} className="rounded border border-sandstone/40 bg-ink/60 px-2 py-1.5 text-sm text-paper" />
        </label>
        <button type="submit" disabled={!enabled || pending} className="rounded bg-lamplight px-3 py-1.5 font-semibold text-ink hover:bg-ember disabled:cursor-not-allowed disabled:opacity-50">Make a private link</button>
      </div>
      {state.message && (
        <div role="status" className={state.ok ? "text-lamplight" : "text-ember"}>
          {state.message}
          {state.url && <p className="mt-1 select-all break-all font-mono text-xs text-paper">{state.url}</p>}
        </div>
      )}
    </form>
  );
}

export function RevokeLink({ id }: { id: string }) {
  const [state, action, pending] = useActionState(revokeLinkAction, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="text-ember underline">Close link</button>
      {state.message && <span role="status" className="ml-2">{state.message}</span>}
    </form>
  );
}
