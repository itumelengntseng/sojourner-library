"use client";

import { useId, useState } from "react";
import { makeId, partnersOf, removeEvent, removePerson, removePlace, renamePerson, renamePlace, setPartners } from "@/lib/atlas";
import type { Lineage, Person } from "@/lib/lineage";
import { AVENUES, STREET_MAX, STREET_MIN, type AvenueId, type Place, type Timeline, type TimelineEvent } from "@/lib/timeline";

const field = "w-full rounded border border-sandstone/40 bg-ink/60 px-2 py-1.5 font-sans text-sm text-paper";
const lab = "flex flex-col gap-1 font-sans text-xs uppercase tracking-wider text-sandstone";
const chip = (on: boolean) => `rounded-full border px-3 py-1 font-sans text-xs ${on ? "border-lamplight bg-lamplight/15 text-lamplight" : "border-sandstone/40 text-paper hover:border-lamplight"}`;
const small = "font-sans text-xs text-lamplight underline underline-offset-2";

function Works({ legend, all, value, onChange }: { legend: string; all: Record<string, string>; value: string[]; onChange: (v: string[]) => void }) {
  const slugs = Object.keys(all);
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="font-sans text-xs uppercase tracking-wider text-sandstone">{legend}</legend>
      {slugs.length === 0 ? <p className="font-sans text-xs text-sandstone">No works on the shelves yet.</p> : (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {slugs.map((s) => (
            <label key={s} className="flex items-center gap-1.5 font-sans text-sm text-paper">
              <input type="checkbox" className="accent-lamplight" checked={value.includes(s)}
                onChange={(e) => onChange(e.target.checked ? [...value, s] : value.filter((x) => x !== s))} />
              {all[s]}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function IdField({ id, taken, onRename }: { id: string; taken: string[]; onRename: (to: string) => void }) {
  const [draft, setDraft] = useState(id);
  const hintId = useId();
  const clash = draft !== id && taken.includes(draft);
  const valid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(draft);
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-end gap-2">
        <label className={`${lab} flex-1`}>Id
          <input value={draft} onChange={(e) => setDraft(e.target.value.toLowerCase())} aria-describedby={hintId} className={`${field} font-mono normal-case tracking-normal`} />
        </label>
        <button type="button" disabled={draft === id || clash || !valid} onClick={() => onRename(draft)} className={`${small} pb-2 disabled:opacity-40 disabled:no-underline`}>Rename</button>
      </span>
      <span id={hintId} className="font-sans text-[0.7rem] text-sandstone">{clash ? "Another entry already uses that id." : !valid ? "Lower-case words joined by hyphens." : "Renaming updates every reference to it."}</span>
    </div>
  );
}

function Real({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 font-sans text-sm text-paper">
      <input type="checkbox" className="accent-lamplight" checked={!value} onChange={(e) => onChange(!e.target.checked)} />
      Real — in my own words (not a placeholder)
    </label>
  );
}

export function LineageForm({ value, onChange, works }: { value: Lineage; onChange: (l: Lineage) => void; works: Record<string, string> }) {
  const [sel, setSel] = useState<string | null>(value.people[0]?.id ?? null);
  const person = value.people.find((p) => p.id === sel);
  const others = value.people.filter((p) => p.id !== sel);
  const update = (patch: Partial<Person>) => onChange({ ...value, people: value.people.map((p) => (p.id === sel ? { ...p, ...patch } : p)) });
  const add = () => {
    const id = makeId("new person", value.people.map((p) => p.id), "person");
    onChange({ ...value, people: [...value.people, { id, name: "New person", isPlaceholder: true, parents: [], partners: [], appearsIn: [] }] });
    setSel(id);
  };
  const partners = person ? partnersOf(value, person.id) : [];
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="People on the wall" className="flex flex-wrap gap-2">
        {value.people.map((p) => <button key={p.id} type="button" aria-pressed={p.id === sel} onClick={() => setSel(p.id)} className={chip(p.id === sel)}>{p.name}</button>)}
        <button type="button" onClick={add} className={chip(false)}>+ Add a person</button>
      </div>
      {person && (
        <div key={person.id} className="grid gap-4 rounded-sm border border-timber-dark/70 bg-ink/30 p-4 sm:grid-cols-2">
          <label className={lab}>Name
            <input value={person.name} onChange={(e) => update({ name: e.target.value })} className={field} />
          </label>
          <IdField id={person.id} taken={others.map((p) => p.id)} onRename={(to) => { onChange(renamePerson(value, person.id, to)); setSel(to); }} />
          {[0, 1].map((i) => (
            <label key={i} className={lab}>{i === 0 ? "Parent" : "Other parent"}
              <select value={person.parents[i] ?? ""} className={field}
                onChange={(e) => {
                  const next = [...person.parents];
                  if (e.target.value) next[i] = e.target.value; else next.splice(i, 1);
                  update({ parents: [...new Set(next.filter(Boolean))].slice(0, 2) });
                }}>
                <option value="">— none —</option>
                {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
          ))}
          <fieldset className="flex flex-col gap-1 sm:col-span-2">
            <legend className="font-sans text-xs uppercase tracking-wider text-sandstone">Partners</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {others.map((o) => (
                <label key={o.id} className="flex items-center gap-1.5 font-sans text-sm text-paper">
                  <input type="checkbox" className="accent-lamplight" checked={partners.includes(o.id)}
                    onChange={(e) => onChange(setPartners(value, person.id, e.target.checked ? [...partners, o.id] : partners.filter((x) => x !== o.id)))} />
                  {o.name}
                </label>
              ))}
              {others.length === 0 && <span className="font-sans text-xs text-sandstone">Add someone else first.</span>}
            </div>
          </fieldset>
          <div className="sm:col-span-2"><Works legend="Appears in" all={works} value={person.appearsIn} onChange={(appearsIn) => update({ appearsIn })} /></div>
          <label className={`${lab} sm:col-span-2`}>Note
            <textarea rows={2} value={person.note ?? ""} onChange={(e) => update({ note: e.target.value || undefined })} className={field} />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
            <Real value={person.isPlaceholder} onChange={(isPlaceholder) => update({ isPlaceholder })} />
            <button type="button" className="font-sans text-xs text-ember underline underline-offset-2"
              onClick={() => { if (window.confirm(`Take ${person.name} off the wall? Nothing is saved until you press Save.`)) { onChange(removePerson(value, person.id)); setSel(others[0]?.id ?? null); } }}>
              Take off the wall
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TimelineForm({ value, onChange, works }: { value: Timeline; onChange: (t: Timeline) => void; works: Record<string, string> }) {
  const [tab, setTab] = useState<"events" | "places">("events");
  const [sel, setSel] = useState<string | null>(value.events[0]?.id ?? null);
  const [selPlace, setSelPlace] = useState<string | null>(value.places[0]?.id ?? null);
  const ev = value.events.find((e) => e.id === sel);
  const place = value.places.find((p) => p.id === selPlace);
  const upEv = (patch: Partial<TimelineEvent>) => onChange({ ...value, events: value.events.map((e) => (e.id === sel ? { ...e, ...patch } : e)) });
  const upPlace = (next: Place) => onChange({ ...value, places: value.places.map((p) => (p.id === selPlace ? next : p)) });
  const addEvent = () => {
    const id = makeId("new event", value.events.map((e) => e.id), "event");
    onChange({ ...value, events: [...value.events, { id, title: "New event", isPlaceholder: true, date: "1900", appearsIn: [] }] });
    setSel(id);
  };
  const addPlace = () => {
    const id = makeId("new place", value.places.map((p) => p.id), "place");
    onChange({ ...value, places: [...value.places, { id, name: "New place", isPlaceholder: true, street: 125, avenue: "malcolm-x" }] });
    setSelPlace(id);
  };
  const onMap = place ? place.street !== undefined || place.avenue !== undefined : true;
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Edit" className="flex gap-2">
        <button type="button" aria-pressed={tab === "events"} onClick={() => setTab("events")} className={chip(tab === "events")}>Events ({value.events.length})</button>
        <button type="button" aria-pressed={tab === "places"} onClick={() => setTab("places")} className={chip(tab === "places")}>Places ({value.places.length})</button>
      </div>
      {tab === "events" ? (
        <>
          <div role="group" aria-label="Events" className="flex flex-wrap gap-2">
            {value.events.map((e) => <button key={e.id} type="button" aria-pressed={e.id === sel} onClick={() => setSel(e.id)} className={chip(e.id === sel)}>{e.title}</button>)}
            <button type="button" onClick={addEvent} className={chip(false)}>+ Add an event</button>
          </div>
          {ev && (
            <div key={ev.id} className="grid gap-4 rounded-sm border border-timber-dark/70 bg-ink/30 p-4 sm:grid-cols-2">
              <label className={lab}>Title<input value={ev.title} onChange={(e) => upEv({ title: e.target.value })} className={field} /></label>
              <IdField id={ev.id} taken={value.events.filter((x) => x.id !== ev.id).map((x) => x.id)}
                onRename={(to) => { onChange({ ...value, events: value.events.map((x) => (x.id === ev.id ? { ...x, id: to } : x)) }); setSel(to); }} />
              <label className={lab}>Date
                <input value={ev.date} onChange={(e) => upEv({ date: e.target.value.trim() })} placeholder="1924, 1924-03 or 1924-03-15" className={field} />
              </label>
              <label className="flex items-center gap-2 self-end font-sans text-sm text-paper">
                <input type="checkbox" className="accent-lamplight" checked={!!ev.approximate} onChange={(e) => upEv({ approximate: e.target.checked || undefined })} />
                Approximate (shown as “c.”)
              </label>
              <label className={`${lab} sm:col-span-2`}>Place
                <select value={ev.placeId ?? ""} onChange={(e) => upEv({ placeId: e.target.value || undefined })} className={field}>
                  <option value="">— no place —</option>
                  {value.places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <div className="sm:col-span-2"><Works legend="Belongs to" all={works} value={ev.appearsIn} onChange={(appearsIn) => upEv({ appearsIn })} /></div>
              <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
                <Real value={ev.isPlaceholder} onChange={(isPlaceholder) => upEv({ isPlaceholder })} />
                <button type="button" className="font-sans text-xs text-ember underline underline-offset-2"
                  onClick={() => { if (window.confirm(`Take "${ev.title}" off the timeline? Nothing is saved until you press Save.`)) { onChange(removeEvent(value, ev.id)); setSel(value.events.find((x) => x.id !== ev.id)?.id ?? null); } }}>
                  Take off the timeline
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div role="group" aria-label="Places" className="flex flex-wrap gap-2">
            {value.places.map((p) => <button key={p.id} type="button" aria-pressed={p.id === selPlace} onClick={() => setSelPlace(p.id)} className={chip(p.id === selPlace)}>{p.name}</button>)}
            <button type="button" onClick={addPlace} className={chip(false)}>+ Add a place</button>
          </div>
          {place && (
            <div key={place.id} className="grid gap-4 rounded-sm border border-timber-dark/70 bg-ink/30 p-4 sm:grid-cols-2">
              <label className={lab}>Name<input value={place.name} onChange={(e) => upPlace({ ...place, name: e.target.value })} className={field} /></label>
              <IdField id={place.id} taken={value.places.filter((x) => x.id !== place.id).map((x) => x.id)}
                onRename={(to) => { onChange(renamePlace(value, place.id, to)); setSelPlace(to); }} />
              <fieldset className="flex flex-wrap gap-4 sm:col-span-2">
                <legend className="font-sans text-xs uppercase tracking-wider text-sandstone">Where</legend>
                <label className="flex items-center gap-1.5 font-sans text-sm text-paper">
                  <input type="radio" name={`where-${place.id}`} className="accent-lamplight" checked={onMap}
                    onChange={() => upPlace({ id: place.id, name: place.name, isPlaceholder: place.isPlaceholder, street: 125, avenue: "malcolm-x" })} /> On the Harlem map
                </label>
                <label className="flex items-center gap-1.5 font-sans text-sm text-paper">
                  <input type="radio" name={`where-${place.id}`} className="accent-lamplight" checked={!onMap}
                    onChange={() => upPlace({ id: place.id, name: place.name, isPlaceholder: place.isPlaceholder, elsewhere: "Elsewhere" })} /> Somewhere else
                </label>
              </fieldset>
              {onMap ? (
                <>
                  <label className={lab}>Cross street ({STREET_MIN}–{STREET_MAX})
                    <input type="number" min={STREET_MIN} max={STREET_MAX} value={place.street ?? ""} onChange={(e) => upPlace({ ...place, street: e.target.value === "" ? undefined : Number(e.target.value) })} className={field} />
                  </label>
                  <label className={lab}>Avenue
                    <select value={place.avenue ?? ""} onChange={(e) => upPlace({ ...place, avenue: (e.target.value || undefined) as AvenueId | undefined })} className={field}>
                      <option value="">— choose —</option>
                      {AVENUES.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </label>
                </>
              ) : (
                <label className={`${lab} sm:col-span-2`}>Where is it?
                  <input value={place.elsewhere ?? ""} onChange={(e) => upPlace({ ...place, elsewhere: e.target.value })} className={field} />
                </label>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
                <Real value={place.isPlaceholder} onChange={(isPlaceholder) => upPlace({ ...place, isPlaceholder })} />
                <button type="button" className="font-sans text-xs text-ember underline underline-offset-2"
                  onClick={() => { if (window.confirm(`Remove ${place.name}? Events there keep their dates but lose the place. Nothing is saved until you press Save.`)) { onChange(removePlace(value, place.id)); setSelPlace(value.places.find((x) => x.id !== place.id)?.id ?? null); } }}>
                  Remove place
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
