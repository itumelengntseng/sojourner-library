"use client";
import { startTransition, useActionState, useState } from "react";
import { flushReadingSession } from "./useSessionTracker";
import { returnFromRoomAction, type DeskState } from "@/app/works/[slug]/actions";

const initial: DeskState = { ok: false, message: "" };

/** C40: hand the book back from the end-of-book card; on success the desk walks you back to the work page. */
export function ReturnFromRoom({ slug, loanId, title }: { slug: string; loanId: string; title: string }) {
  const [state, action, pending] = useActionState(returnFromRoomAction, initial);
  const [saving, setSaving] = useState(false);
  const busy = pending || saving;
  return (
    <form
      action={action}
      // Save the last of the reading (it needs the open loan) before the book goes back.
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setSaving(true);
        await flushReadingSession();
        setSaving(false);
        startTransition(() => action(data));
      }}
      className="mt-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="loanId" value={loanId} />
      <input type="hidden" name="intent" value="return" />
      <button type="submit" disabled={busy} className="rounded border border-current px-4 py-2 disabled:opacity-50">
        {busy ? "Stamping…" : "Return to shelf"}<span className="sr-only">: {title}</span>
      </button>
      <p className="mt-1 text-xs opacity-80">Your bookmark is kept if you borrow it again.</p>
      {state.message && <p role="status" className="mt-1">{state.message}</p>}
    </form>
  );
}
