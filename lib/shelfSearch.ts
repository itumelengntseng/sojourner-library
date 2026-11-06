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

/** Works where every word of the query appears in the title, series, hall, author or description. */
export function searchShelves<W extends Pick<Work, "title" | "series" | "hall" | "author" | "blurb">>(works: W[], halls: readonly Hall[], query: string): W[] {
  const words = fold(query).split(" ").filter(Boolean);
  if (words.length === 0) return works;
  const hallName = new Map(halls.map((h) => [h.id, h.name]));
  return works.filter((w) => {
    const hay = ` ${fold([w.title, w.series ?? "", hallName.get(w.hall) ?? w.hall, w.author, STAND_IN(w.blurb) ? "" : w.blurb].join(" "))} `;
    return words.every((word) => hay.includes(word));
  });
}

export function resultLine(count: number, query: string): string {
  if (count === 0) return `Nothing on the shelves matches “${query}”.`;
  return `${count} ${count === 1 ? "work matches" : "works match"} “${query}”.`;
}
