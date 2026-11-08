// C224: "What still waits for your words" — one short list in the Writer's Room of everything still
// carrying placeholder text, each with a count and a link to where it's done. Counts only; nothing invented.

import { replaceHref } from "@/lib/replaceManuscript";

export interface WaitingRow { key: "works" | "kits" | "people" | "timeline" | "halls"; text: string; href: string; linkLabel: string;
  /** C232: the short form for the Keeper's line on the front hall ("3 works", "the hall names"). */
  short: string;
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
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const w = flagged(input.works);
  if (w) {
    const waitingWorks = input.works.filter((x) => x.isPlaceholder);
    // C227: one to three are named, each with its own "replace" link.
    const named = waitingWorks.length <= 3 && waitingWorks.every((x) => x.slug && x.title?.trim());
    rows.push({ key: "works", text: `${of(w, input.works.length, "work", "works")} on the shelves`, short: count(w, "work", "works"), href: "#shelves", linkLabel: "replace with your manuscripts",
      ...(named ? { links: waitingWorks.map((x) => ({ label: x.title!.trim(), href: replaceHref(x.slug!) })) } : {}) });
  }
  const k = flagged(input.kits);
  if (k) rows.push({ key: "kits", text: of(k, input.kits.length, "pitch kit", "pitch kits"), short: count(k, "pitch kit", "pitch kits"), href: "/pitch-room", linkLabel: "the Pitch Room" });
  const p = flagged(input.people);
  if (p) rows.push({ key: "people", text: `${of(p, input.people.length, "person", "people")} on the family wall`, short: count(p, "person", "people"), href: "/writers-room/atlas#lineage-doc", linkLabel: "edit the family wall" });
  const pl = flagged(input.places), ev = flagged(input.events);
  if (pl || ev) {
    const bits = [pl ? of(pl, input.places.length, "place", "places") : null, ev ? of(ev, input.events.length, "event", "events") : null].filter(Boolean);
    const shortBits = [pl ? count(pl, "place", "places") : null, ev ? count(ev, "event", "events") : null].filter(Boolean);
    rows.push({ key: "timeline", text: `${bits.join(" and ")} on the timeline`, short: shortBits.join(", "), href: "/writers-room/atlas#timeline-doc", linkLabel: "edit the timeline" });
  }
  if (!input.hallsNamed) rows.push({ key: "halls", text: "the halls' names", short: "the hall names", href: "#halls", linkLabel: "name the halls" });
  return { rows, allDone: rows.length === 0 };
}

/** C229: the backup's README section — the same counts as the panel, as plain text (counts only). */
export function waitingReadme(w: { rows: WaitingRow[]; allDone: boolean }): string[] {
  if (w.allDone) return ["Still waiting for your words: nothing — everything is in your own words."];
  return ["Still waiting for your words (placeholder text, not yet replaced):", ...w.rows.map((r) => `  - ${r.text}`)];
}

/** C229: placeholder flags from a stored family-wall / timeline document as saved (malformed lists count as empty). */
export function atlasFlags(body: unknown, key: "people" | "places" | "events"): { isPlaceholder: boolean }[] {
  const list = body && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
  return Array.isArray(list) ? list.map((x) => ({ isPlaceholder: !(x && typeof x === "object" && (x as { isPlaceholder?: unknown }).isPlaceholder === false) })) : [];
}

/** C232: the Keeper's one line on the front hall, or null when nothing waits. */
export function keeperLine(w: { rows: WaitingRow[]; allDone: boolean }): string | null {
  if (w.allDone) return null;
  const parts = w.rows.map((r) => r.short);
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `Still waiting for your words: ${list}.`;
}
