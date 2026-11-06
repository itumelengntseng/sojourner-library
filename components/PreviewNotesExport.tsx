"use client";

import { getWorks } from "@/lib/catalogue";
import { notesMarkdown, type ExportWork } from "@/lib/ledger";
import { splitParagraphs, type Highlight, type MarginNote } from "@/lib/reader";

/** Preview mode: notes live in this browser, so the export is built here too. */
export function buildPreviewExport(read: (key: string) => string | null, now: number): string {
  const works: ExportWork[] = getWorks().map((w) => ({
    title: w.title,
    author: w.author,
    chapters: w.chapters.map((c) => {
      let saved: { notes?: MarginNote[]; highlights?: Highlight[] } = {};
      try { saved = JSON.parse(read(`soj:ann:${w.slug}:${c.position}`) ?? "{}"); } catch { /* skip damaged */ }
      const paras = splitParagraphs(c.body);
      return {
        position: c.position,
        title: c.title,
        notes: (Array.isArray(saved.notes) ? saved.notes : []).map((n) => ({
          anchorText: paras.find((p) => n.anchor >= p.start && n.anchor < p.end)?.text ?? "",
          body: String(n.body), createdAt: Number(n.createdAt) || 0,
        })),
        highlights: (Array.isArray(saved.highlights) ? saved.highlights : []).map((h) => ({
          text: c.body.slice(h.start, h.end), colour: String(h.colour), createdAt: 0,
        })),
      };
    }),
  }));
  return notesMarkdown(works, now);
}

export function PreviewNotesExport() {
  const download = () => {
    const md = buildPreviewExport((k) => { try { return localStorage.getItem(k); } catch { return null; } }, Date.now());
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "sojourner-notes.md" });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <button type="button" onClick={download}
      className="rounded bg-lamplight px-4 py-2 font-sans text-sm font-semibold text-ink hover:bg-ember">
      Export my notes (Markdown)
    </button>
  );
}
