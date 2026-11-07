import { describe, expect, it } from "vitest";
import { finishedNoteLine, notesMarkdown, type ExportWork } from "@/lib/ledger";
import { buildPreviewExport } from "@/components/PreviewNotesExport";

// C94: a finished book's heading in the notes file carries "Finished 5 Nov 2026 · read over 9 days".
const at = (iso: string) => Date.parse(iso);
const work = (title: string, finished?: ExportWork["finished"]): ExportWork => ({
  title, author: "Itumeleng Ntseng",
  chapters: [{ position: 1, title: "Placeholder chapter", notes: [{ anchorText: "", body: "A note.", createdAt: 1 }], highlights: [] }],
  ...(finished ? { finished } : {}),
});

describe("Finished line in the notes export (C94)", () => {
  it("formats the line in SA time, with the span when the first session is known", () => {
    expect(finishedNoteLine({ at: at("2026-11-09T10:00:00Z"), firstRead: at("2026-11-01T10:00:00Z") })).toMatch(/^Finished 0?9 Nov 2026 · read over 9 days$/);
    expect(finishedNoteLine({ at: at("2026-11-04T23:30:00Z") })).toMatch(/^Finished 0?5 Nov 2026$/);
  });
  it("puts it under the finished book's byline only", () => {
    const md = notesMarkdown([work("Placeholder A", { at: at("2026-11-09T10:00:00Z"), firstRead: at("2026-11-01T10:00:00Z") }), work("Placeholder B")], at("2026-11-10T10:00:00Z"));
    const a = md.indexOf("## Placeholder A");
    const b = md.indexOf("## Placeholder B");
    const line = md.search(/Finished 0?9 Nov 2026 · read over 9 days/);
    expect(line).toBeGreaterThan(md.indexOf("_by Itumeleng Ntseng_", a));
    expect(line).toBeLessThan(md.indexOf("### Placeholder chapter", a));
    expect(md.slice(b)).not.toMatch(/Finished/);
    expect(md.match(/^Finished /gm)).toHaveLength(1);
  });
  it("preview download adds it from the finish map, per-book file included", () => {
    const read = (k: string) => (k === "soj:ann:placeholder-work-one:1" ? JSON.stringify({ notes: [{ anchor: 0, body: "Mine.", createdAt: 1 }] }) : null);
    const finished = { "placeholder-work-one": { at: at("2026-11-09T10:00:00Z"), firstRead: at("2026-11-09T06:00:00Z") } };
    expect(buildPreviewExport(read, at("2026-11-10T10:00:00Z"), "placeholder-work-one", finished)).toMatch(/Finished 0?9 Nov 2026 · read in a day/);
    expect(buildPreviewExport(read, at("2026-11-10T10:00:00Z"), undefined, finished)).toMatch(/Finished 0?9 Nov 2026 · read in a day/);
    expect(buildPreviewExport(read, at("2026-11-10T10:00:00Z"), "placeholder-work-one")).not.toMatch(/Finished/);
  });
});
