"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AVENUES, dateLabel, eventsBetween, MAJOR_STREETS, MAP, project, STREET_MIN, yearSpan,
  type Place, type Timeline,
} from "@/lib/timeline";

// A lamplit street plan of Harlem, with a strip of years along the bottom to walk through.
export function HarlemMap({ timeline, works }: { timeline: Timeline; works: Record<string, string> }) {
  const span = yearSpan(timeline.events) ?? [1900, 2000];
  const [from, setFrom] = useState(span[0]);
  const [to, setTo] = useState(span[1]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);

  const inRange = useMemo(() => eventsBetween(timeline.events, Math.min(from, to), Math.max(from, to)), [timeline.events, from, to]);
  const activePlaces = new Set(inRange.map((e) => e.placeId).filter(Boolean));
  const event = timeline.events.find((e) => e.id === selectedEvent);
  const placeId = selectedPlace ?? event?.placeId ?? null;
  const place = timeline.places.find((p) => p.id === placeId);
  const onMap = timeline.places.filter((p): p is Place & { street: number; avenue: NonNullable<Place["avenue"]> } => p.street !== undefined && p.avenue !== undefined);
  const elsewhere = timeline.places.filter((p) => p.elsewhere);
  const pick = (id: string) => { setSelectedPlace(id); setSelectedEvent(null); };
  const eventsAt = (id: string) => inRange.filter((e) => e.placeId === id);
  const park = { a: project(STREET_MIN, "fifth"), b: project(STREET_MIN, "frederick-douglass") };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <figure className="rounded-sm border border-timber-dark bg-ink/60 p-2">
        <svg viewBox={`0 0 ${MAP.width} ${MAP.height}`} role="img" aria-labelledby="map-title" className="h-auto w-full">
          <title id="map-title">Street plan of Harlem, 110th to 155th Street, with the places on the timeline</title>
          <rect x={park.b.x} y={park.a.y} width={park.a.x - park.b.x} height={MAP.pad - 8} fill="#3d4a2f" opacity="0.7" />
          <text x={(park.a.x + park.b.x) / 2} y={park.a.y + 18} textAnchor="middle" fontSize="10" fill="#c9a77c">Central Park</text>
          {AVENUES.map((a) => {
            const top = project(155, a.id);
            const bottom = project(STREET_MIN, a.id);
            return <line key={a.id} x1={top.x} y1={top.y} x2={bottom.x} y2={bottom.y} stroke="#6b4428" strokeWidth={a.id === "malcolm-x" || a.id === "adam-clayton-powell" ? 2 : 1} />;
          })}
          {Array.from({ length: 46 }, (_, i) => STREET_MIN + i).map((st) => {
            const l = project(st, "morningside");
            const r = project(st, "first");
            const major = MAJOR_STREETS.includes(st);
            return (
              <g key={st}>
                <line x1={l.x} y1={l.y} x2={r.x} y2={r.y} stroke={major ? "#8a6a48" : "#3f2615"} strokeWidth={major ? 1.4 : 0.5} />
                {major && <text x={l.x - 6} y={l.y + 3} textAnchor="end" fontSize="10" fill="#c9a77c">{st}th</text>}
              </g>
            );
          })}
          {onMap.map((p) => {
            const { x, y } = project(p.street, p.avenue);
            const on = p.id === placeId;
            const lit = activePlaces.has(p.id);
            return (
              <g key={p.id} onClick={() => pick(p.id)} className="cursor-pointer" aria-hidden="true">
                {lit && <circle cx={x} cy={y} r={on ? 16 : 11} fill="#f2c57c" opacity="0.25" />}
                <circle cx={x} cy={y} r={on ? 7 : 5} fill={lit ? "#f2c57c" : "#8a7a66"} stroke="#1d1a17" strokeWidth="1.5" />
              </g>
            );
          })}
        </svg>
        <figcaption className="px-2 pb-1 font-sans text-[0.7rem] text-sandstone">
          Schematic, north at the top. Lit places have events in the years you&apos;ve chosen.
        </figcaption>
      </figure>

      <div className="flex flex-col gap-5">
        <fieldset className="rounded-sm border border-timber-dark p-3 font-sans text-sm">
          <legend className="px-1 text-xs uppercase tracking-wider text-sandstone">Years</legend>
          <label className="flex items-center gap-2">From
            <input type="range" min={span[0]} max={span[1]} value={from} onChange={(e) => setFrom(Number(e.target.value))} className="flex-1 accent-[#f2c57c]" />
            <output className="w-10 text-right">{from}</output>
          </label>
          <label className="mt-2 flex items-center gap-2">To
            <input type="range" min={span[0]} max={span[1]} value={to} onChange={(e) => setTo(Number(e.target.value))} className="ml-4 flex-1 accent-[#f2c57c]" />
            <output className="w-10 text-right">{to}</output>
          </label>
        </fieldset>

        <section aria-labelledby="events-h">
          <h2 id="events-h" className="text-lg text-paper">On the timeline</h2>
          {inRange.length === 0 ? <p className="mt-2 font-sans text-sm text-sandstone">Nothing recorded in these years.</p> : (
            <ol className="mt-2 border-l border-timber pl-4">
              {inRange.map((e) => (
                <li key={e.id} className="relative mb-2">
                  <span aria-hidden="true" className="absolute -left-[1.3rem] top-2 h-2 w-2 rounded-full bg-lamplight" />
                  <button type="button" aria-pressed={e.id === selectedEvent} onClick={() => { setSelectedEvent(e.id); setSelectedPlace(null); }}
                    className={`text-left ${e.id === selectedEvent ? "text-lamplight" : "text-paper hover:text-lamplight"}`}>
                    <span className="block font-mono text-xs text-sandstone">{dateLabel(e)}</span>
                    {e.title}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="places-h">
          <h2 id="places-h" className="text-lg text-paper">Places</h2>
          <ul className="mt-2 flex flex-wrap gap-2 font-sans text-xs">
            {timeline.places.map((p) => (
              <li key={p.id}>
                <button type="button" aria-pressed={p.id === placeId} onClick={() => pick(p.id)}
                  className={`rounded-full border px-3 py-1 ${p.id === placeId ? "border-lamplight bg-lamplight text-ink" : "border-sandstone/50 text-paper"}`}>
                  {p.name}{p.elsewhere ? ` · ${p.elsewhere}` : ""}
                </button>
              </li>
            ))}
          </ul>
          {elsewhere.length > 0 && <p className="mt-2 font-sans text-[0.7rem] text-sandstone">Places marked with a region lie beyond this map.</p>}
        </section>

        {(place || event) && (
          <section aria-live="polite" className="rounded-sm bg-paper p-4 text-ink">
            {event && <p className="font-mono text-xs text-timber">{dateLabel(event)}</p>}
            <h2 className="text-lg">{event?.title ?? place?.name}</h2>
            {place && (
              <p className="font-sans text-sm text-timber">
                {place.elsewhere ?? `${place.street}th Street & ${AVENUES.find((a) => a.id === place.avenue)?.name}`}
              </p>
            )}
            {!event && place && (
              <ul className="mt-2 font-sans text-sm">
                {eventsAt(place.id).map((e) => <li key={e.id}>{dateLabel(e)} — {e.title}</li>)}
                {eventsAt(place.id).length === 0 && <li>No events here in these years.</li>}
              </ul>
            )}
            {event && event.appearsIn.length > 0 && (
              <p className="mt-2 font-sans text-sm">In {event.appearsIn.map((w, i) => (
                <span key={w}>{i > 0 && ", "}<Link href={`/works/${w}`} className="underline underline-offset-2">{works[w] ?? w}</Link></span>
              ))}</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
