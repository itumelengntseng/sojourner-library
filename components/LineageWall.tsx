"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { connection, describeConnection, generations, relativesOf, type Person } from "@/lib/lineage";

// Stone plaques set into a courtyard wall, one row per generation.
export function LineageWall({ people, works }: { people: Person[]; works: Record<string, string> }) {
  const rows = useMemo(() => generations(people), [people]);
  const [selected, setSelected] = useState<string>(people[0]?.id ?? "");
  const [a, setA] = useState(people[0]?.id ?? "");
  const [b, setB] = useState(people[people.length - 1]?.id ?? "");
  const me = people.find((p) => p.id === selected);
  const rel = relativesOf(people, selected);
  const path = a && b ? connection(people, a, b) : null;

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
        {rows.map((row, i) => (
          <section key={i} aria-label={`Generation ${i + 1}`} className="mb-4 last:mb-0">
            <p className="font-sans text-[0.6rem] uppercase tracking-[0.3em] text-sandstone">Generation {i + 1}</p>
            <ul className="mt-2 flex flex-wrap gap-2">{row.map(plaque)}</ul>
            {i < rows.length - 1 && <div className="threshold mt-4 opacity-40" aria-hidden="true" />}
          </section>
        ))}
      </div>

      <aside className="flex flex-col gap-6">
        {me && (
          <section aria-live="polite" className="rounded-sm bg-paper p-4 text-ink">
            <h2 className="text-lg">{me.name}</h2>
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
