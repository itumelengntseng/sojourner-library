"use client";

import { useActionState, useMemo, useState } from "react";
import { descriptionAction, importAction, inviteAction, revokeAction, workSettingsAction, type RoomState } from "@/app/writers-room/actions";
import { formatDuration, minutesFor, DEFAULT_WPM } from "@/lib/engine/readingTime";
import { parseManuscript, slugify } from "@/lib/manuscript";

const initial: RoomState = { ok: false, message: "" };
const field = "w-full rounded border border-sandstone/40 bg-ink/60 px-3 py-2 font-sans text-sm text-paper";
const button = "rounded bg-lamplight px-4 py-2 font-sans text-sm font-semibold text-ink hover:bg-ember disabled:cursor-not-allowed disabled:opacity-50";

function Status({ s }: { s: RoomState }) {
  if (!s.message) return null;
  return (
    <div role="status" className={`font-sans text-sm ${s.ok ? "text-lamplight" : "text-ember"}`}>
      {s.message}
      {s.code && <p className="mt-1 select-all font-mono text-lg tracking-widest text-paper">{s.code}</p>}
    </div>
  );
}

export function ManuscriptImport({ canSave }: { canSave: boolean }) {
  const [state, action, pending] = useActionState(importAction, initial);
  const [md, setMd] = useState("");
  const [title, setTitle] = useState("");
  const parsed = useMemo(() => parseManuscript(md), [md]);
  const shownTitle = title || parsed.title || "";

  const loadFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 3_000_000) return alert("That file is over 3 MB — import it in parts.");
    setMd(await f.text());
  };

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 font-sans text-xs uppercase tracking-wider text-sandstone">Title
          <input name="title" value={shownTitle} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="Taken from the # heading if present" />
        </label>
        <label className="flex flex-col gap-1 font-sans text-xs uppercase tracking-wider text-sandstone">Web address
          <input name="slug" readOnly value={shownTitle ? slugify(shownTitle) : ""} className={`${field} opacity-80`} />
        </label>
        <label className="flex flex-col gap-1 font-sans text-xs uppercase tracking-wider text-sandstone">Standing
          <select name="canon" defaultValue="draft" className={field}>
            <option value="draft">Draft — not canon</option>
            <option value="canon">Canon</option>
            <option value="apocrypha">Apocrypha — outside canon</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 font-sans text-xs uppercase tracking-wider text-sandstone">Markdown file
          <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={(e) => loadFile(e.target.files?.[0])} className="font-sans text-sm text-paper file:mr-3 file:rounded file:border-0 file:bg-timber file:px-3 file:py-1.5 file:text-paper" />
        </label>
      </div>
      <label className="flex flex-col gap-1 font-sans text-xs uppercase tracking-wider text-sandstone">Or paste the manuscript
        <textarea name="manuscript" rows={8} value={md} onChange={(e) => setMd(e.target.value)} className={`${field} font-mono text-xs`}
          placeholder={"# Title of the work\n\n## Chapter one\n\nText…\n\n## Chapter two\n\nText…"} />
      </label>

      {parsed.chapters.length > 0 && (
        <section aria-label="Import preview" className="rounded-sm border border-timber-dark bg-ink/40 p-3 font-sans text-sm">
          <p className="text-paper">{parsed.chapters.length} chapter{parsed.chapters.length === 1 ? "" : "s"} · {parsed.words.toLocaleString("en-ZA")} words · about {parsed.readingTime}</p>
          {parsed.warnings.map((w) => <p key={w} className="text-ember">{w}</p>)}
          <ol className="mt-2 max-h-48 overflow-y-auto">
            {parsed.chapters.map((c) => (
              <li key={c.position} className="flex justify-between gap-3 border-t border-timber-dark/60 py-1">
                <span>{c.position}. {c.title}</span>
                <span className="shrink-0 text-sandstone">{c.words.toLocaleString("en-ZA")} words · {formatDuration(minutesFor(c.words, DEFAULT_WPM))}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!canSave || pending || parsed.chapters.length === 0} className={button}>
          {pending ? "Shelving…" : "Save to the library"}
        </button>
        {!canSave && <span className="font-sans text-xs text-sandstone">Preview only — saving starts once the library is connected.</span>}
      </div>
      <Status s={state} />
    </form>
  );
}

export function WorkSettings({ id, visibility, canon }: { id: string; visibility: string; canon: string }) {
  const [state, action, pending] = useActionState(workSettingsAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 font-sans text-xs">
      <input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor={`v-${id}`}>Who can see it</label>
      <select id={`v-${id}`} name="visibility" defaultValue={visibility} className="rounded border border-sandstone/40 bg-ink px-2 py-1 text-paper">
        <option value="owner">Only me</option>
        <option value="members">Card holders</option>
      </select>
      <label className="sr-only" htmlFor={`c-${id}`}>Standing</label>
      <select id={`c-${id}`} name="canon" defaultValue={canon} className="rounded border border-sandstone/40 bg-ink px-2 py-1 text-paper">
        <option value="canon">Canon</option>
        <option value="draft">Draft</option>
        <option value="apocrypha">Apocrypha</option>
      </select>
      <button type="submit" disabled={pending} className="rounded border border-lamplight/60 px-2 py-1 text-lamplight hover:bg-lamplight hover:text-ink">Save</button>
      {state.message && <span role="status" className={state.ok ? "text-lamplight" : "text-ember"}>{state.message}</span>}
    </form>
  );
}

/** The author's own description of a work, shown on its page. */
export function DescriptionForm({ id, title, description }: { id: string; title: string; description: string }) {
  const [state, action, pending] = useActionState(descriptionAction, initial);
  const [text, setText] = useState(description);
  return (
    <details className="font-sans text-xs">
      <summary className="cursor-pointer text-lamplight underline underline-offset-2">{description ? "Edit description" : "Add a description"}</summary>
      <form action={action} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="id" value={id} />
        <label htmlFor={`d-${id}`} className="sr-only">Description of {title}</label>
        <textarea id={`d-${id}`} name="description" rows={4} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} className={field} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending || text.trim() === description.trim()} className="rounded border border-lamplight/60 px-2 py-1 text-lamplight hover:bg-lamplight hover:text-ink disabled:opacity-50">Save description</button>
          <span className="text-sandstone">{text.length}/2000</span>
          {state.message && <span role="status" className={state.ok ? "text-lamplight" : "text-ember"}>{state.message}</span>}
        </div>
      </form>
    </details>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <label className="flex flex-col gap-1 font-sans text-xs uppercase tracking-wider text-sandstone">Who it&apos;s for
          <input name="note" maxLength={200} className={field} placeholder="A name, for your records" />
        </label>
        <label className="flex flex-col gap-1 font-sans text-xs uppercase tracking-wider text-sandstone">Valid for (days)
          <input name="days" type="number" min={1} max={90} defaultValue={14} className={field} />
        </label>
      </div>
      <div><button type="submit" disabled={pending} className={button}>Issue an invite</button></div>
      <Status s={state} />
    </form>
  );
}

export function RevokeInvite({ id }: { id: string }) {
  const [state, action, pending] = useActionState(revokeAction, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="font-sans text-xs text-ember underline">Revoke</button>
      {state.message && <span role="status" className="ml-2 font-sans text-xs">{state.message}</span>}
    </form>
  );
}
