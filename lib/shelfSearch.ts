// Search the shelves: plain words, matched against what the reader can already see.
import type { Hall, Work } from "./catalogue";
import { NO_BLURB } from "./catalogueRows";

// Stand-in lines the library writes itself — not the author's words, so not searchable.
const STAND_IN = (blurb: string) => blurb === NO_BLURB || blurb.startsWith("Placeholder description.");

const MAX_QUERY = 80;

/** Lower-case, strip accents and punctuation, so "Séance" finds "seance". */
export function fold(s: string): string {
  return s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** The query as the reader typed it, trimmed and capped; "" when there's nothing to search. */
export function cleanQuery(raw: string | string[] | undefined): string {
  const q = Array.isArray(raw) ? raw[0] : raw;
  return (q ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY);
}

type Searchable = Pick<Work, "title" | "series" | "hall" | "author" | "blurb"> & { chapters?: readonly { position: number; title: string }[] };

const words = (query: string) => fold(query).split(" ").filter(Boolean);
const ownHay = (w: Searchable, hallName: Map<string, string>) =>
  fold([w.title, w.series ?? "", hallName.get(w.hall) ?? w.hall, w.author, STAND_IN(w.blurb) ? "" : w.blurb].join(" "));

/**
 * Works where every word of the query appears in the title, series, hall, author or description —
 * or in its chapter titles (C51; titles only, never chapter text).
 */
export function searchShelves<W extends Searchable>(works: W[], halls: readonly Hall[], query: string): W[] {
  const ws = words(query);
  if (ws.length === 0) return works;
  const hallName = new Map(halls.map((h) => [h.id, h.name]));
  return works.filter((w) => {
    const hay = ` ${ownHay(w, hallName)} ${fold((w.chapters ?? []).map((c) => c.title).join(" "))} `;
    return ws.every((word) => hay.includes(word));
  });
}

export interface ChapterHit { position: number; title: string }

/**
 * The chapters that brought a work into the results: those whose title holds every query word the
 * work's own details don't already. None when the work matched on its own (no "Chapter 1…" noise).
 */
export function chapterHits(w: Searchable, halls: readonly Hall[], query: string, max = 3): ChapterHit[] {
  const own = ` ${ownHay(w, new Map(halls.map((h) => [h.id, h.name])))} `;
  const need = words(query).filter((word) => !own.includes(word));
  if (need.length === 0) return [];
  return (w.chapters ?? [])
    .filter((c) => { const t = ` ${fold(c.title)} `; return need.every((word) => t.includes(word)); })
    .slice(0, max)
    .map((c) => ({ position: c.position, title: c.title }));
}

export function resultLine(count: number, query: string): string {
  if (count === 0) return `Nothing on the shelves matches “${query}”.`;
  return `${count} ${count === 1 ? "work matches" : "works match"} “${query}”.`;
}
