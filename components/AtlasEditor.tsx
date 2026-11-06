"use client";

import { useActionState, useMemo, useState } from "react";
import { saveAtlasAction, type AtlasState } from "@/app/writers-room/atlas/actions";
import { checkAtlas, parseForForm, toAtlasText, type AtlasKind } from "@/lib/atlas";
import { LineageForm, TimelineForm } from "./AtlasForms";

const initial: AtlasState = { ok: false, message: "" };

/** One person / place / event at a time, or the whole document as JSON; the file checks run as the Keeper edits. */
export function AtlasEditor({ kind, text, works, canSave }: { kind: AtlasKind; text: string; works: Record<string, string>; canSave: boolean }) {
  const knownWorks = useMemo(() => Object.keys(works), [works]);
  const [mode, setMode] = useState<"form" | "json">("form");
  const [state, action, pending] = useActionState(saveAtlasAction, initial);
  const [body, setBody] = useState(text);
  const check = useMemo(() => checkAtlas(kind, body, knownWorks), [kind, body, knownWorks]);
  const count = check.ok ? ("people" in check.value ? `${check.value.people.length} people` : `${check.value.places.length} places · ${check.value.events.length} events`) : null;
  const id = `atlas-${kind}`;
  const parsed = useMemo(() => (kind === "lineage" ? parseForForm("lineage", body) : parseForForm("timeline", body)), [kind, body]);
  const tab = (m: "form" | "json", label: string) => (
    <button type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
      className={`rounded px-3 py-1 font-sans text-xs ${mode === m ? "bg-lamplight text-ink" : "text-sandstone hover:text-lamplight"}`}>{label}</button>
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="kind" value={kind} />
      <div role="group" aria-label="How to edit" className="flex gap-1">{tab("form", "One at a time")}{tab("json", "Whole file (JSON)")}</div>
      {mode === "form" ? (
        <>
          <input type="hidden" name="body" value={body} />
          {!parsed ? <p className="font-sans text-sm text-ember">The JSON has a problem the form can&apos;t open — fix it under “Whole file (JSON)”, or Undo my changes.</p>
            : "people" in parsed ? <LineageForm value={parsed} works={works} onChange={(v) => setBody(toAtlasText(v))} />
            : <TimelineForm value={parsed} works={works} onChange={(v) => setBody(toAtlasText(v))} />}
        </>
      ) : (
        <>
          <label htmlFor={id} className="font-sans text-xs uppercase tracking-wider text-sandstone">{kind === "lineage" ? "Lineage (JSON)" : "Timeline (JSON)"}</label>
          <textarea id={id} name="body" rows={16} spellCheck={false} value={body} onChange={(e) => setBody(e.target.value)}
            className="w-full rounded border border-sandstone/40 bg-ink/60 px-3 py-2 font-mono text-xs leading-relaxed text-paper" />
        </>
      )}
      <div role="status" aria-live="polite" className={`font-sans text-xs ${check.ok ? "text-lamplight" : "text-ember"}`}>
        {check.ok ? `Checks out — ${count}.` : (
          <ul className="list-disc pl-5">{check.errors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}{check.errors.length > 8 && <li>…and {check.errors.length - 8} more.</li>}</ul>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={!canSave || pending || !check.ok} className="rounded bg-lamplight px-4 py-2 font-sans text-sm font-semibold text-ink hover:bg-ember disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? "Saving…" : kind === "lineage" ? "Save the family wall" : "Save the timeline"}
        </button>
        <button type="button" onClick={() => setBody(text)} className="font-sans text-sm text-sandstone underline underline-offset-2 hover:text-lamplight">Undo my changes</button>
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
