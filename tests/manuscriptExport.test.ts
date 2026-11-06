import { describe, expect, it } from "vitest";
import { getWorks } from "@/lib/catalogue";
import { exportFilename, manuscriptMarkdown, roundTrips, type ExportWork } from "@/lib/manuscriptExport";
import { parseManuscript } from "@/lib/manuscript";

const AT = new Date("2026-11-06T10:00:00Z");
const work: ExportWork = {
  title: "Placeholder Work", slug: "placeholder-work", author: "Itumeleng Ntseng",
  chapters: [
    { position: 2, title: "Placeholder two", body: "Second placeholder paragraph.\n\nAnother.", archived: false },
    { position: 1, title: "Placeholder one", body: "First placeholder paragraph.", archived: false },
    { position: 3, title: "Placeholder set aside", body: "Kept, not shown.", archived: true },
  ],
};

describe("manuscript backup (C27)", () => {
  it("writes the import's own shape, in chapter order, with the author in front matter", () => {
    const md = manuscriptMarkdown(work, "shelved", AT);
    expect(md.startsWith("---\ntitle: \"Placeholder Work\"\nauthor: \"Itumeleng Ntseng\"\nexported: 2026-11-06T10:00:00.000Z")).toBe(true);
    expect(md.indexOf("## Placeholder one")).toBeLessThan(md.indexOf("## Placeholder two"));
    expect(md).not.toContain("Placeholder set aside");
  });
  it("re-imports to the same chapters, with no warnings", () => {
    const md = manuscriptMarkdown(work, "shelved", AT);
    expect(roundTrips(work, md)).toBe(true);
    expect(parseManuscript(md).warnings).toEqual([]);
  });
  it("round-trips every placeholder work in the catalogue", () => {
    for (const w of getWorks()) {
      const ew: ExportWork = { title: w.title, slug: w.slug, author: w.author, chapters: w.chapters.map((c) => ({ position: c.position, title: c.title, body: c.body, archived: false })) };
      expect(roundTrips(ew, manuscriptMarkdown(ew, "shelved", AT))).toBe(true);
    }
  });
  it("keeps set-aside chapters in their own file, never mixed into the shelved copy", () => {
    const md = manuscriptMarkdown(work, "set-aside", AT);
    expect(md).toContain("# Placeholder Work — chapters set aside");
    expect(md).toContain("## Placeholder set aside");
    expect(md).not.toContain("Placeholder one");
    expect(md).toContain("part: set-aside");
  });
  it("authorship is never blank", () => {
    expect(manuscriptMarkdown({ ...work, author: "" }, "shelved", AT)).toContain('author: "Itumeleng Ntseng"');
  });
  it("makes a safe, dated file name", () => {
    expect(exportFilename("placeholder-work", "shelved", AT)).toBe("placeholder-work-2026-11-06.md");
    expect(exportFilename('a"b/../c', "set-aside", AT)).toBe("abc-set-aside-2026-11-06.md");
  });
});
