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

// ── Re-import preview: what saving this manuscript will do to a work already shelved ──

export interface ShelvedChapter { position: number; title: string; words: number; archived: boolean }
export interface ShelvedWork { title: string; setAside: boolean; chapters: ShelvedChapter[] }

export type PlanStatus = "new" | "changed" | "same" | "restored" | "archive";
export interface PlanRow { position: number; title: string; words: number; status: PlanStatus; was?: { title: string; words: number } }
export interface ImportPlan {
  update: boolean;
  setAside: boolean;
  rows: PlanRow[];
  counts: Record<PlanStatus, number>;
}

/** Mirrors import_manuscript(): chapters match by position; extra old chapters are set aside, never deleted. */
export function importPlan(parsed: Pick<ParsedManuscript, "chapters">, shelved: ShelvedWork | undefined): ImportPlan {
  const counts: Record<PlanStatus, number> = { new: 0, changed: 0, same: 0, restored: 0, archive: 0 };
  const old = new Map((shelved?.chapters ?? []).map((c) => [c.position, c]));
  const rows: PlanRow[] = parsed.chapters.map((c) => {
    const o = old.get(c.position);
    const status: PlanStatus = !o ? "new" : o.archived ? "restored" : o.title === c.title && o.words === c.words ? "same" : "changed";
    return { position: c.position, title: c.title, words: c.words, status, ...(o && status !== "same" && status !== "new" ? { was: { title: o.title, words: o.words } } : {}) };
  });
  const n = parsed.chapters.length;
  for (const o of shelved?.chapters ?? []) {
    if (o.position > n && !o.archived) rows.push({ position: o.position, title: o.title, words: o.words, status: "archive" });
  }
  for (const r of rows) counts[r.status]++;
  return { update: !!shelved, setAside: !!shelved?.setAside, rows, counts };
}

export const PLAN_LABEL: Record<PlanStatus, string> = {
  new: "new", changed: "changed", same: "unchanged", restored: "back on the shelf", archive: "will be set aside",
};

/** One plain sentence summing up the plan. */
export function planSummary(p: ImportPlan): string {
  if (!p.update) return "A new work — it will be shelved as Only me until you share it.";
  const bits = ([["changed", "changed"], ["new", "new"], ["restored", "back on the shelf"], ["archive", "set aside"], ["same", "unchanged"]] as const)
    .filter(([k]) => p.counts[k] > 0).map(([k, w]) => `${p.counts[k]} ${w}`);
  return `Updates the work already on the shelves: ${bits.join(", ")}.${p.setAside ? " It is set aside — it stays off the shelves until you restore it." : ""}`;
}
