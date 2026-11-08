import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getWorks } from "@/lib/catalogue";
import { getPitch } from "@/content/pitches";
import { onePager } from "@/lib/pitch";
import { spokenSpine } from "@/lib/spine";
import { PitchSheet } from "@/components/PitchSheet";
import { AUTHOR } from "@/lib/site";
import { LineageWall } from "@/components/LineageWall";
import { HarlemMap } from "@/components/HarlemMap";
import { LINEAGE } from "@/content/lineage";
import { TIMELINE } from "@/content/timeline";

vi.mock("@/app/works/[slug]/read/actions", () => ({ bookmarkAction: vi.fn(), noteAction: vi.fn(), highlightAction: vi.fn(), removeAction: vi.fn() }));
vi.mock("@/app/works/[slug]/actions", () => ({ returnFromRoomAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

// C217: authorship and the placeholder rules pinned in one place — every placeholder work's page, spine and
// pitch sheet names Itumeleng Ntseng and carries a Placeholder mark until the real manuscripts arrive.
describe("placeholder works stay marked and attributed (C217)", () => {
  const works = getWorks();
  it("the author is Itumeleng Ntseng and every shelved work is a marked placeholder", () => {
    expect(AUTHOR).toBe("Itumeleng Ntseng");
    expect(works.length).toBeGreaterThan(0);
    for (const w of works) {
      expect(w.author).toBe(AUTHOR);
      expect(w.isPlaceholder).toBe(true);
      expect(w.title).toMatch(/^Placeholder /);
      expect(w.blurb).toMatch(/^Placeholder /);
    }
  });
  it("each spine says who wrote it", () => {
    for (const w of works) expect(spokenSpine({ author: w.author, canon: "Canon", readingTime: "1 h" })).toMatch(/^by Itumeleng Ntseng\. /);
    // C237: a placeholder spine says so right after the author; a work in Itu's own words doesn't.
    for (const w of works) expect(spokenSpine({ author: w.author, placeholder: w.isPlaceholder, canon: "Canon", readingTime: "1 h" })).toMatch(/^by Itumeleng Ntseng\. Placeholder\. Canon\. /);
    expect(spokenSpine({ author: AUTHOR, placeholder: false, canon: "Canon", readingTime: "1 h" })).toBe("by Itumeleng Ntseng. Canon. 1 h to read.");
    expect(readFileSync("app/halls/page.tsx", "utf8")).toContain("spokenSpine({ author: w.author, placeholder: w.isPlaceholder,");
  });
  it("each pitch sheet (screen and one-pager) names the author and says it's a placeholder", () => {
    for (const w of works) {
      const kit = getPitch(w.slug);
      if (!kit) continue;
      expect(kit.isPlaceholder).toBe(true);
      const work = { title: w.title, author: w.author, words: 1000, readingTime: "5 min" };
      const html = renderToStaticMarkup(<PitchSheet kit={kit} work={work} />);
      expect(html).toContain("by Itumeleng Ntseng");
      expect(html).toContain("© Itumeleng Ntseng");
      expect(html).toContain("Placeholder pitch");
      const md = onePager(kit, work);
      expect(md).toContain("**by Itumeleng Ntseng**");
      expect(md).toContain("> Placeholder pitch");
    }
  });
  it("the work page shows the author and the placeholder line", () => {
    const page = readFileSync("app/works/[slug]/page.tsx", "utf8");
    expect(page).toContain("by {work.author}</p>");
    expect(page).toContain("{work.isPlaceholder && (");
    expect(page).toContain("Placeholder text — the manuscript has not arrived yet.");
  });
});

// C234 (with C231 and C233): the reading room, proof copy, family wall and timeline keep the same rules.
describe("placeholder rules beyond the work page (C234)", () => {
  it("every chapter of a placeholder work says so under 'by Itumeleng Ntseng' — reading room and proof copy", async () => {
    const { ReaderView } = await import("@/components/ReaderView");
    for (const w of getWorks()) {
      for (const c of w.chapters) {
        const data = { mode: "preview" as const, loanId: "l", dueAt: Date.now() + 3600_000, title: w.title, author: w.author, canonStatus: w.canonStatus, isPlaceholder: w.isPlaceholder,
          chapter: { position: c.position, title: c.title, body: c.body }, chapters: w.chapters.map((x) => ({ position: x.position, title: x.title, words: 100 })), bookmark: null, notes: [], highlights: [] };
        for (const mode of ["preview", "proof"] as const) {
          const html = renderToStaticMarkup(<ReaderView slug={w.slug} data={{ ...data, mode }} wpm={230} minutesPerDay={30} />);
          expect(html).toContain("by Itumeleng Ntseng");
          expect(html).toContain("Placeholder text — the manuscript has not arrived yet.");
        }
      }
    }
  });
  it("a work in the author's own words carries no placeholder line", async () => {
    const { ReaderView } = await import("@/components/ReaderView");
    const w = getWorks()[0], c = w.chapters[0];
    const html = renderToStaticMarkup(<ReaderView slug={w.slug} data={{ mode: "proof", loanId: "", dueAt: 0, title: w.title, author: w.author, canonStatus: w.canonStatus, isPlaceholder: false,
      chapter: { position: c.position, title: c.title, body: c.body }, chapters: [{ position: c.position, title: c.title, words: 100 }], bookmark: null, notes: [], highlights: [] }} wpm={230} minutesPerDay={30} />);
    expect(html).not.toContain("data-placeholder-text");
    expect(html).toContain("by Itumeleng Ntseng");
  });
  it("every placeholder person, event and place is marked on the reader pages", () => {
    const wall = renderToStaticMarkup(<LineageWall people={LINEAGE.people} works={{}} />);
    expect((wall.match(/>Placeholder</g) ?? []).length).toBeGreaterThanOrEqual(LINEAGE.people.filter((p) => p.isPlaceholder).length);
    const map = renderToStaticMarkup(<HarlemMap timeline={TIMELINE} works={{}} />);
    expect((map.match(/data-placeholder-mark/g) ?? []).length).toBe(TIMELINE.events.filter((e) => e.isPlaceholder).length + TIMELINE.places.filter((p) => p.isPlaceholder).length);
  });
  it("the loaders carry the mark in every mode (preview, library, proof)", () => {
    const room = readFileSync("lib/readingRoom.ts", "utf8");
    expect(room.match(/isPlaceholder: work\.isPlaceholder/g)?.length).toBe(2);
    expect(room).toContain("isPlaceholder: found.work.is_placeholder !== false");
    expect(room).toContain("isPlaceholder: work.is_placeholder !== false");
    expect(room.match(/select\("id, title, author, canon_status, is_placeholder"\)/g)?.length).toBe(2);
  });
});
