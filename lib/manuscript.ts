// Writer's Room: turning a Markdown manuscript into chapters. Pure, so the same
// preview runs in the browser before anything is saved.
import { countWords, DEFAULT_WPM, formatDuration, minutesFor } from "./engine/readingTime";

export interface ParsedChapter {
  position: number;
  title: string;
  body: string;
  words: number;
}

export interface ParsedManuscript {
  title: string | null;
  chapters: ParsedChapter[];
  words: number;
  readingTime: string;
  warnings: string[];
}

export const MAX_MANUSCRIPT_CHARS = 3_000_000;
export const MAX_CHAPTERS = 400;

/**
 * Splits on chapter headings. A single "# Title" at the top names the work when
 * chapters use "## "; otherwise each "# " heading starts a chapter.
 */
export function parseManuscript(md: string): ParsedManuscript {
  const warnings: string[] = [];
  const text = md.replace(/\r\n?/g, "\n").replace(/^﻿/, "").replace(/^---\n[\s\S]*?\n---\n/, "");
  if (text.length > MAX_MANUSCRIPT_CHARS) warnings.push("This manuscript is very large; consider importing it in parts.");

  const h1 = [...text.matchAll(/^# (.+)$/gm)];
  const h2 = [...text.matchAll(/^## (.+)$/gm)];
  let title: string | null = null;
  let level: "# " | "## " = "# ";
  if (h1.length === 1 && h2.length > 0) { title = h1[0][1].trim(); level = "## "; }
  else if (h1.length === 0 && h2.length > 0) level = "## ";

  const re = level === "# " ? /^# (.+)$/gm : /^## (.+)$/gm;
  const heads = [...text.matchAll(re)];
  const chapters: ParsedChapter[] = [];
  if (heads.length === 0) {
    const body = text.replace(/^# .+$/m, "").trim();
    if (body) chapters.push({ position: 1, title: "Chapter 1", body, words: countWords(body) });
    if (body) warnings.push('No chapter headings found — the whole text became one chapter. Start chapters with "# " or "## ".');
  } else {
    const before = text.slice(0, heads[0].index).replace(/^# .+$/m, "").trim();
    if (before) warnings.push("Text before the first chapter heading was left out.");
    heads.forEach((h, i) => {
      const start = h.index! + h[0].length;
      const end = i + 1 < heads.length ? heads[i + 1].index! : text.length;
      const body = text.slice(start, end).trim();
      const t = h[1].trim().slice(0, 200);
      if (!body) warnings.push(`"${t}" has no text yet.`);
      chapters.push({ position: i + 1, title: t, body, words: countWords(body) });
    });
  }
  if (chapters.length > MAX_CHAPTERS) warnings.push(`More than ${MAX_CHAPTERS} chapters — only the first ${MAX_CHAPTERS} will be saved.`);
  const kept = chapters.slice(0, MAX_CHAPTERS);
  const words = kept.reduce((s, c) => s + c.words, 0);
  return { title, chapters: kept, words, readingTime: formatDuration(minutesFor(words, DEFAULT_WPM)), warnings };
}

export function slugify(title: string): string {
  return title
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 80).replace(/-+$/, "") || "untitled";
}
