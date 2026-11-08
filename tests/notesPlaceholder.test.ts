import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { notesMarkdown, PLACEHOLDER_NOTE_LINE, type ExportWork } from "@/lib/ledger";
import { buildPreviewExport } from "@/components/PreviewNotesExport";

// C236: exported notes on a placeholder book say so under its heading.
const work = (isPlaceholder?: boolean): ExportWork => ({ title: "Placeholder Work One", author: "Itumeleng Ntseng", ...(isPlaceholder === undefined ? {} : { isPlaceholder }),
  chapters: [{ position: 1, title: "Chapter 1", notes: [{ anchorText: "", body: "a thought", createdAt: 1 }], highlights: [] }] });

describe("notes export marks placeholder books (C236)", () => {
  it("puts the line under the heading and author, only for placeholder books", () => {
    const md = notesMarkdown([work(true)], Date.parse("2026-11-08T10:00:00Z"));
    expect(md).toContain(`## Placeholder Work One\n\n_by Itumeleng Ntseng_\n\n${PLACEHOLDER_NOTE_LINE}\n\n### Chapter 1`);
    expect(notesMarkdown([work(false)], 0)).not.toContain(PLACEHOLDER_NOTE_LINE);
    expect(notesMarkdown([work()], 0)).not.toContain(PLACEHOLDER_NOTE_LINE);
  });
  it("the preview export (full and per-book) carries it for the placeholder catalogue", () => {
    const store: Record<string, string> = { "soj:ann:placeholder-work-one:1": JSON.stringify({ notes: [{ anchor: 0, body: "mine", createdAt: 5 }] }) };
    for (const slug of [undefined, "placeholder-work-one"]) {
      expect(buildPreviewExport((k) => store[k] ?? null, 0, slug)).toContain(PLACEHOLDER_NOTE_LINE);
    }
  });
  it("library mode reads the mark with the titles", () => {
    const s = readFileSync("lib/ledgerStore.ts", "utf8");
    expect(s).toContain('select("id, slug, title, author, is_placeholder").in("id", workIds)');
    expect(s).toContain("isPlaceholder: w.is_placeholder !== false,");
  });
});
