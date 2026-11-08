// C224: "What still waits for your words" — one short list in the Writer's Room of everything still
// carrying placeholder text, each with a count and a link to where it's done. Counts only; nothing invented.

import { replaceHref } from "@/lib/replaceManuscript";

export interface WaitingRow { key: "works" | "kits" | "people" | "timeline" | "halls"; text: string; href: string; linkLabel: string;
  /** C227: one link per waiting work (one to three) in place of the single link. */
  links?: { label: string; href: string }[] }

const flagged = (xs: { isPlaceholder: boolean }[]) => xs.filter((x) => x.isPlaceholder).length;

export function waitingForWords(input: {
  works: { isPlaceholder: boolean; slug?: string; title?: string }[];
  kits: { isPlaceholder: boolean }[];
  people: { isPlaceholder: boolean }[];
  places: { isPlaceholder: boolean }[];
  events: { isPlaceholder: boolean }[];
  hallsNamed: boolean;
}): { rows: WaitingRow[]; allDone: boolean } {
  const rows: WaitingRow[] = [];
  const of = (n: number, total: number, one: string, many: string) => `${n} of ${total} ${total === 1 ? one : many}`;
  const w = flagged(input.works);
  if (w) {
    const waitingWorks = input.works.filter((x) => x.isPlaceholder);
    // C227: one to three are named, each with its own "replace" link.
    const named = waitingWorks.length <= 3 && waitingWorks.every((x) => x.slug && x.title?.trim());
    rows.push({ key: "works", text: `${of(w, input.works.length, "work", "works")} on the shelves`, href: "#shelves", linkLabel: "replace with your manuscripts",
      ...(named ? { links: waitingWorks.map((x) => ({ label: x.title!.trim(), href: replaceHref(x.slug!) })) } : {}) });
  }
  const k = flagged(input.kits);
  if (k) rows.push({ key: "kits", text: of(k, input.kits.length, "pitch kit", "pitch kits"), href: "/pitch-room", linkLabel: "the Pitch Room" });
  const p = flagged(input.people);
  if (p) rows.push({ key: "people", text: `${of(p, input.people.length, "person", "people")} on the family wall`, href: "/writers-room/atlas#lineage-doc", linkLabel: "edit the family wall" });
  const pl = flagged(input.places), ev = flagged(input.events);
  if (pl || ev) {
    const bits = [pl ? of(pl, input.places.length, "place", "places") : null, ev ? of(ev, input.events.length, "event", "events") : null].filter(Boolean);
    rows.push({ key: "timeline", text: `${bits.join(" and ")} on the timeline`, href: "/writers-room/atlas#timeline-doc", linkLabel: "edit the timeline" });
  }
  if (!input.hallsNamed) rows.push({ key: "halls", text: "the halls' names", href: "#halls", linkLabel: "name the halls" });
  return { rows, allDone: rows.length === 0 };
}
