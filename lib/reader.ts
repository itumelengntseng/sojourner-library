// The reading room: pure helpers for paragraphs, bookmarks, highlights and settings.
// Offsets: highlights and notes use character offsets into the chapter's text;
// bookmarks use word offsets into the whole work (as the checkout engine does).
import { countWords } from "./engine/readingTime";

export interface Paragraph {
  index: number;
  start: number; // char offset of the first character in the chapter text
  end: number; // exclusive
  text: string;
  wordsBefore: number; // words in the chapter before this paragraph
}

/** Splits chapter text on blank lines, keeping exact character offsets. */
export function splitParagraphs(body: string): Paragraph[] {
  const out: Paragraph[] = [];
  const re = /[^\n]+(?:\n(?!\s*\n)[^\n]*)*/g;
  let words = 0;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const text = raw.trim();
    if (!text) continue;
    const start = m.index + lead;
    out.push({ index: out.length, start, end: start + text.length, text, wordsBefore: words });
    words += countWords(text);
  }
  return out;
}

// ── Bookmarks ────────────────────────────────────────────────────────────────

export interface ChapterLengths {
  position: number;
  words: number;
}

/** Words in the work before the start of chapter `position` (1-based). */
export function wordsBeforeChapter(chapters: ChapterLengths[], position: number): number {
  return chapters.filter((c) => c.position < position).reduce((s, c) => s + c.words, 0);
}

/** Work-level word offset for the start of a paragraph. */
export function bookmarkOffset(chapters: ChapterLengths[], position: number, para: Paragraph): number {
  return wordsBeforeChapter(chapters, position) + para.wordsBefore;
}

/** Where a work-level word offset lands: chapter position and paragraph index. */
export function locateBookmark(
  chapters: ChapterLengths[],
  wordOffset: number,
): { position: number; wordsIntoChapter: number } {
  const sorted = [...chapters].sort((a, b) => a.position - b.position);
  let before = 0;
  for (const c of sorted) {
    if (wordOffset < before + c.words) return { position: c.position, wordsIntoChapter: wordOffset - before };
    before += c.words;
  }
  const last = sorted[sorted.length - 1];
  return last ? { position: last.position, wordsIntoChapter: last.words } : { position: 1, wordsIntoChapter: 0 };
}

export function paragraphAtWord(paras: Paragraph[], wordsIntoChapter: number): number {
  let idx = 0;
  for (const p of paras) if (p.wordsBefore <= wordsIntoChapter) idx = p.index;
  return idx;
}

// ── Highlights ───────────────────────────────────────────────────────────────

export type HighlightColour = "lamplight" | "ochre" | "sky";
export const HIGHLIGHT_COLOURS: HighlightColour[] = ["lamplight", "ochre", "sky"];

export interface Highlight {
  id: string;
  start: number;
  end: number;
  colour: HighlightColour;
}

export interface Segment {
  text: string;
  start: number;
  highlight: Highlight | null;
}

/** Cuts a paragraph into plain and highlighted runs. Later highlights win overlaps. */
export function segmentParagraph(para: Paragraph, highlights: Highlight[]): Segment[] {
  const len = para.end - para.start;
  const owner: (Highlight | null)[] = new Array(len).fill(null);
  for (const h of highlights) {
    const a = Math.max(h.start, para.start) - para.start;
    const b = Math.min(h.end, para.end) - para.start;
    for (let i = a; i < b; i++) owner[i] = h;
  }
  const out: Segment[] = [];
  let i = 0;
  while (i < len) {
    const h = owner[i];
    let j = i + 1;
    while (j < len && owner[j] === h) j++;
    out.push({ text: para.text.slice(i, j), start: para.start + i, highlight: h });
    i = j;
  }
  return out;
}

/** Validates a selection: inside the chapter, non-empty, trimmed of surrounding spaces. */
export function normaliseSelection(body: string, start: number, end: number): { start: number; end: number } | null {
  let a = Math.max(0, Math.min(start, end));
  let b = Math.min(body.length, Math.max(start, end));
  while (a < b && /\s/.test(body[a])) a++;
  while (b > a && /\s/.test(body[b - 1])) b--;
  return b > a ? { start: a, end: b } : null;
}

// ── Notes ────────────────────────────────────────────────────────────────────

export interface MarginNote {
  id: string;
  anchor: number; // char offset of the paragraph start the note sits beside
  body: string;
  createdAt: number;
}

export const NOTE_MAX = 10_000;

export function cleanNote(body: string): string | null {
  const t = body.replace(/\r\n/g, "\n").trim();
  return t.length === 0 || t.length > NOTE_MAX ? null : t;
}

export function notesByParagraph(paras: Paragraph[], notes: MarginNote[]): Map<number, MarginNote[]> {
  const map = new Map<number, MarginNote[]>();
  for (const n of notes) {
    const p = paras.find((x) => n.anchor >= x.start && n.anchor < x.end) ?? paras.find((x) => x.start >= n.anchor);
    if (!p) continue;
    map.set(p.index, [...(map.get(p.index) ?? []), n].sort((a, b) => a.createdAt - b.createdAt));
  }
  return map;
}

// ── Reading settings ────────────────────────────────────────────────────────

export type ReaderTheme = "dark" | "sepia" | "light";
export type ReaderLayout = "scroll" | "paged";

export interface ReaderSettings {
  theme: ReaderTheme;
  layout: ReaderLayout;
  fontSize: number; // px
}

export const DEFAULT_SETTINGS: ReaderSettings = { theme: "dark", layout: "scroll", fontSize: 19 };
export const FONT_MIN = 15;
export const FONT_MAX = 28;

export function parseSettings(raw: string | null | undefined): ReaderSettings {
  try {
    const v = JSON.parse(raw ?? "{}") as Partial<ReaderSettings>;
    return {
      theme: v.theme === "sepia" || v.theme === "light" ? v.theme : "dark",
      layout: v.layout === "paged" ? "paged" : "scroll",
      fontSize: typeof v.fontSize === "number" && Number.isFinite(v.fontSize)
        ? Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(v.fontSize)))
        : DEFAULT_SETTINGS.fontSize,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Lamplit stone, an old paperback, or a bright reading table. */
/** Page background per theme (kept in step with THEME_CLASSES) and a focus ring that stands out on it (≥ 3:1). */
export const THEME_BACKGROUND: Record<ReaderTheme, string> = { dark: "#1d1a17", sepia: "#efe0c2", light: "#fbf8f2" };
export const FOCUS_RING: Record<ReaderTheme, string> = { dark: "#f2c57c", sepia: "#6b4428", light: "#6b4428" };

export const THEME_CLASSES: Record<ReaderTheme, string> = {
  dark: "bg-ink text-paper",
  sepia: "bg-[#efe0c2] text-[#3b2a1a]",
  light: "bg-[#fbf8f2] text-[#1d1a17]",
};

export const HIGHLIGHT_CLASSES: Record<HighlightColour, string> = {
  lamplight: "bg-[#f2c57c]/45",
  ochre: "bg-[#d9822b]/40",
  sky: "bg-[#7fb2d9]/40",
};
