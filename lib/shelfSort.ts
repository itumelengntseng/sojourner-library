// C33: how the books stand on each shelf. Default keeps the catalogue's series order.
import type { Work } from "./catalogue";

export type ShelfSort = "shelf" | "recent" | "title";
export const SORTS: { id: ShelfSort; label: string }[] = [
  { id: "shelf", label: "Shelf order" },
  { id: "recent", label: "Recently changed" },
  { id: "title", label: "Title" },
];

export function parseSort(v: string | string[] | undefined): ShelfSort {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "recent" || s === "title" ? s : "shelf";
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/^(the|a|an)\s+/i, "").toLowerCase();

/** Stable: ties keep shelf order; works with no date (placeholders) stand after dated ones. */
export function sortShelf<T extends Pick<Work, "title" | "updatedAt">>(works: T[], sort: ShelfSort): T[] {
  if (sort === "shelf") return works;
  const indexed = works.map((w, i) => ({ w, i }));
  indexed.sort((a, b) => {
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
