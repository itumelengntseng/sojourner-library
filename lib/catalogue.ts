// The catalogue the halls read from. Until real manuscripts arrive every entry
// is a clearly marked placeholder — no canon titles, characters or plot.
import { AUTHOR } from "./site";

export type CanonStatus = "canon" | "draft" | "apocrypha";

export interface PlaceholderChapter {
  position: number;
  title: string;
  body: string;
}

export interface Work {
  slug: string;
  title: string;
  author: string;
  hall: string;
  series: string | null;
  canonStatus: CanonStatus;
  isPlaceholder: boolean;
  blurb: string;
  chapters: PlaceholderChapter[];
}

const LOREM =
  "Placeholder text. This passage holds the place of a chapter until the manuscript arrives from the author. " +
  "It exists only so the reading room, the clock and the bookmarks have something to measure. ";

function placeholderChapters(n: number, paragraphs: number): PlaceholderChapter[] {
  return Array.from({ length: n }, (_, i) => ({
    position: i + 1,
    title: `Chapter ${i + 1}`,
    body: Array.from({ length: paragraphs }, () => LOREM.repeat(6).trim()).join("\n\n"),
  }));
}

export const HALLS = [
  { id: "main", name: "The Main Hall", note: "Placeholder hall — Itu will name the halls." },
] as const;

export const PLACEHOLDER_WORKS: Work[] = [
  { slug: "placeholder-work-one", title: "Placeholder Work One", canonStatus: "canon" as CanonStatus, chapters: placeholderChapters(6, 12) },
  { slug: "placeholder-work-two", title: "Placeholder Work Two", canonStatus: "canon" as CanonStatus, chapters: placeholderChapters(4, 10) },
  { slug: "placeholder-work-three", title: "Placeholder Work Three", canonStatus: "draft" as CanonStatus, chapters: placeholderChapters(3, 8) },
].map((w) => ({
  ...w,
  author: AUTHOR,
  hall: "main",
  series: null,
  isPlaceholder: true,
  blurb: "Placeholder description. The real description will come from the author.",
}));

export function getWorks(): Work[] {
  return PLACEHOLDER_WORKS;
}

export function getWork(slug: string): Work | undefined {
  return PLACEHOLDER_WORKS.find((w) => w.slug === slug);
}

/** Stable small number from a slug, used to vary cover palettes. */
export function seedOf(slug: string): number {
  let h = 2166136261;
  for (const ch of slug) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % 360;
}
