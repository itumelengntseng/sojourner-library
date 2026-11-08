"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { connection, describeConnection, findPeople, generations, relativesOf, type Person } from "@/lib/lineage";

// Stone plaques set into a courtyard wall, one row per generation.
export function LineageWall({ people, works }: { people: Person[]; works: Record<string, string> }) {
  const rows = useMemo(() => generations(people), [people]);
  const [selected, setSelected] = useState<string>(people[0]?.id ?? "");
  const [a, setA] = useState(people[0]?.id ?? "");
  const [b, setB] = useState(people[people.length - 1]?.id ?? "");
  const me = people.find((p) => p.id === selected);
  const rel = relativesOf(people, selected);
  const path = a && b ? connection(people, a, b) : null;
  const [query, setQuery] = useState("");
  const found = useMemo(() => findPeople(people, query), [people, query]);
  const searching = query.trim() !== "";

  const plaque = (p: Person) => {
    const on = p.id === selected;
    const near = [...rel.parents, ...rel.children, ...rel.partners, ...rel.siblings].some((x) => x.id === p.id);
    return (
      <li key={p.id}>
        <button type="button" onClick={() => setSelected(p.id)} aria-pressed={on}
          className={`min-w-36 rounded-sm border px-3 py-2 text-left transition-colors ${
            on ? "border-lamplight bg-sandstone text-ink" : near ? "border-sandstone bg-stone-floor text-paper" : "border-timber-dark bg-stone-floor/70 text-paper/90"}`}>
          <span className="block">{p.name}</span>
          {p.isPlaceholder && <span className={`font-sans text-[0.6rem] uppercase tracking-wider ${on ? "text-ink" : "text-sandstone"}`}>Placeholder</span>}
        </button>
      </li>
    );
  };
  const names = (list: Person[]) => (list.length ? list.map((p) => p.name).join(", ") : "—");

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="overflow-x-auto rounded-sm border border-timber-dark bg-stone-wall/60 p-4">
        <div role="search" className="mb-4 flex flex-wrap items-center gap-2 font-sans text-sm">
          <label htmlFor="find-person" className="sr-only">Find a person</label>
          <input id="find-person" type="search" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={60} autoComplete="off"
            placeholder="Find a person…"
            className="min-w-0 flex-1 rounded-sm border border-timber bg-stone-floor/80 px-3 py-1.5 text-paper placeholder:text-sandstone/70" />
          {searching && <button type="button" onClick={() => setQuery("")} className="text-sandstone underline underline-offset-2 hover:text-lamplight">Clear</button>}
          <p role="status" className="w-full text-xs text-sandstone">
            {searching ? (found.size === 0 ? `No one on the wall matches “${query.trim()}”.` : `${found.size} ${found.size === 1 ? "person matches" : "people match"} “${query.trim()}”.`) : ""}
          </p>
        </div>
        {rows.map((row, i) => {
          const shown = searching ? row.filter((p) => found.has(p.id)) : row;
          if (shown.length === 0) return null;
          return (
            <section key={i} aria-label={`Generation ${i + 1}`} className="mb-4 last:mb-0">
              <p className="font-sans text-[0.6rem] uppercase tracking-[0.3em] text-sandstone">Generation {i + 1}</p>
              <ul className="mt-2 flex flex-wrap gap-2">{shown.map(plaque)}</ul>
              {!searching && i < rows.length - 1 && <div className="threshold mt-4 opacity-40" aria-hidden="true" />}
            </section>
          );
        })}
      </div>

      <aside className="flex flex-col gap-6">
        {me && (
          <section aria-live="polite" className="rounded-sm bg-paper p-4 text-ink">
            <h2 className="text-lg">{me.name}</h2>
            {/* C231: the detail card says a placeholder is one, as the plaque does. */}
            {me.isPlaceholder && <p className="font-sans text-[0.65rem] uppercase tracking-wider text-timber" data-placeholder-mark>Placeholder — the author&apos;s own words will replace it</p>}
            {me.note && <p className="font-sans text-xs text-timber">{me.note}</p>}
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-sans text-sm">
              <dt className="text-timber">Parents</dt><dd>{names(rel.parents)}</dd>
              <dt className="text-timber">Partners</dt><dd>{names(rel.partners)}</dd>
              <dt className="text-timber">Siblings</dt><dd>{names(rel.siblings)}</dd>
              <dt className="text-timber">Children</dt><dd>{names(rel.children)}</dd>
            </dl>
            <p className="mt-3 font-sans text-xs uppercase tracking-wider text-timber">Appears in</p>
            <ul className="mt-1 font-sans text-sm">
              {me.appearsIn.map((w) => <li key={w}><Link href={`/works/${w}`} className="underline underline-offset-2">{works[w] ?? w}</Link></li>)}
            </ul>
          </section>
        )}

        <section className="rounded-sm border border-timber-dark bg-ink/40 p-4">
          <h2 className="text-lg text-paper">How are they connected?</h2>
          <div className="mt-3 flex flex-col gap-2 font-sans text-sm">
            {([["From", a, setA], ["To", b, setB]] as const).map(([label, value, set]) => (
              <label key={label} className="flex items-center gap-2 text-sandstone">
                <span className="w-10">{label}</span>
                <select value={value} onChange={(e) => set(e.target.value)} className="flex-1 rounded border border-sandstone/40 bg-ink px-2 py-1 text-paper">
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            ))}
          </div>
          <p role="status" className="mt-3 text-paper">
            {path ? describeConnection(people, path) : "No family tie is recorded between them."}
          </p>
        </section>
      </aside>
    </div>
  );
}
