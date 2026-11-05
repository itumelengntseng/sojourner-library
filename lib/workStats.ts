// Numbers shown on the shelf and the work page, computed from the text itself.
import { countWords, DEFAULT_WPM, formatDuration, minutesFor } from "./engine/readingTime";
import type { CanonStatus, Work } from "./catalogue";

export interface ChapterStat {
  position: number;
  title: string;
  words: number;
  minutes: number;
}

export interface WorkStats {
  words: number;
  minutes: number;
  readingTime: string;
  chapters: ChapterStat[];
}

export function workStats(work: Work, wpm = DEFAULT_WPM): WorkStats {
  const chapters = work.chapters.map((c) => {
    const words = countWords(c.body);
    return { position: c.position, title: c.title, words, minutes: minutesFor(words, wpm) };
  });
  const words = chapters.reduce((s, c) => s + c.words, 0);
  const minutes = minutesFor(words, wpm);
  return { words, minutes, readingTime: formatDuration(minutes), chapters };
}

export type CanonView = "canon" | "all";

export function parseCanonView(v: string | string[] | undefined): CanonView {
  return v === "all" ? "all" : "canon";
}

export function filterByCanon(works: Work[], view: CanonView): Work[] {
  return view === "all" ? works : works.filter((w) => w.canonStatus === "canon");
}

export const CANON_LABEL: Record<CanonStatus, string> = {
  canon: "Canon",
  draft: "Draft — not canon",
  apocrypha: "Apocrypha — outside canon",
};

export function formatWords(n: number): string {
  return `${n.toLocaleString("en-ZA").replace(/ /g, " ")} words`;
}
