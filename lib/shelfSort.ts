// C33: how the books stand on each shelf. Default keeps the catalogue's series order.
import type { Work } from "./catalogue";

export type ShelfSort = "shelf" | "recent" | "title" | "read";
export const SORTS: { id: ShelfSort; label: string }[] = [
  { id: "shelf", label: "Shelf order" },
  { id: "recent", label: "Recently changed" },
  { id: "title", label: "Title" },
  // C162: the reader's own hours per work, most first.
  { id: "read", label: "Most read by you" },
];

export function parseSort(v: string | string[] | undefined): ShelfSort {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "recent" || s === "title" || s === "read" ? s : "shelf";
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/^(the|a|an)\s+/i, "").toLowerCase();

/**
 * Stable: ties keep shelf order; works with no date (placeholders) stand after dated ones.
 * C162 "read": `hours` (slug → the reader's own active ms) most first; unread works keep shelf order after them.
 */
export function sortShelf<T extends Pick<Work, "title" | "updatedAt"> & { slug?: string }>(works: T[], sort: ShelfSort, hours: Record<string, number> = {}): T[] {
  if (sort === "shelf") return works;
  const indexed = works.map((w, i) => ({ w, i }));
  indexed.sort((a, b) => {
    if (sort === "read") {
      const x = (a.w.slug && hours[a.w.slug]) || 0, y = (b.w.slug && hours[b.w.slug]) || 0;
      return x === y ? a.i - b.i : y - x;
    }
    if (sort === "title") return fold(a.w.title).localeCompare(fold(b.w.title), "en") || a.i - b.i;
    const x = a.w.updatedAt ?? -Infinity, y = b.w.updatedAt ?? -Infinity;
    return x === y ? a.i - b.i : y > x ? 1 : -1;
  });
  return indexed.map((x) => x.w);
}

/** Link to /halls keeping the search and canon choice. */
export function sortHref(sort: ShelfSort, q: string, canon?: string): string {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (canon) p.set("canon", canon);
  if (sort !== "shelf") p.set("sort", sort);
  const s = p.toString();
  return s ? `/halls?${s}` : "/halls";
}

/** C164: the quiet line under the Order links when the halls are ordered by the reader's own reading. */
export function readOrderNote(hours: Record<string, number>): string {
  return Object.values(hours).some((ms) => ms > 0)
    ? "Ordered by your own reading time; books you haven't read in keep shelf order."
    : "You haven't read in any book yet — shelf order kept.";
}
