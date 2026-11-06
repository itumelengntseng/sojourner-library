"use client";

import { useActionState } from "react";
import type { LoanPeriod } from "@/lib/engine/checkout";
import { deskAction, type DeskState } from "./actions";

const initial: DeskState = { ok: false, message: "" };
const primary =
  "rounded bg-lamplight px-4 py-2 font-sans text-sm font-semibold text-ink hover:bg-ember disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "rounded border border-sandstone/50 px-4 py-2 font-sans text-sm text-paper hover:border-lamplight hover:text-lamplight disabled:cursor-not-allowed disabled:opacity-50";

function Status({ state }: { state: DeskState }) {
  if (!state.message) return null;
  return <p role="status" className={`font-sans text-sm ${state.ok ? "text-lamplight" : "text-ember"}`}>{state.message}</p>;
}

export function BorrowForm({ slug, periods }: { slug: string; periods: { id: LoanPeriod; label: string; hint: string }[] }) {
  const [state, action, pending] = useActionState(deskAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="intent" value="borrow" />
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-2 font-sans text-xs uppercase tracking-wider text-sandstone">How long would you like it?</legend>
        {periods.map((p, i) => (
          <label key={p.id} className="flex cursor-pointer flex-col rounded-sm border border-timber-dark bg-ink/40 px-3 py-2 has-[:checked]:border-lamplight has-[:checked]:bg-timber-dark/60">
            <span className="flex items-center gap-2">
              <input type="radio" name="period" value={p.id} defaultChecked={i === 1} className="accent-[#f2c57c]" />
              <span>{p.label}</span>
            </span>
            <span className="pl-5 font-sans text-[0.7rem] text-sandstone/80">{p.hint}</span>
          </label>
        ))}
      </fieldset>
      <div><button type="submit" disabled={pending} className={primary}>{pending ? "Stamping…" : "Borrow this work"}</button></div>
      <Status state={state} />
    </form>
  );
}

export function LoanActions({ slug, loanId, canRenew, canReturn }: { slug: string; loanId: string; canRenew: boolean; canReturn: boolean }) {
  const [state, action, pending] = useActionState(deskAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="loanId" value={loanId} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="intent" value="renew" disabled={pending || !canRenew} className={primary}>Renew</button>
        <button type="submit" name="intent" value="return" disabled={pending || !canReturn} className={secondary}>Return to shelf</button>
      </div>
      <Status state={state} />
    </form>
  );
}
