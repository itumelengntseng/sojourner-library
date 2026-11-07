import { describe, expect, it, vi } from "vitest";

// C72: the halls mark books the reader has read to the end. The store is checked in preview mode.
let cookieValue: string | undefined;
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (cookieValue === undefined ? undefined : { value: cookieValue }) }) }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => null }));

import { myFinishes } from "@/lib/ledgerStore";
import { getWorks } from "@/lib/catalogue";
import { countWords } from "@/lib/engine/readingTime";
import { finishedDate, finishedStamp } from "@/lib/ledger";

describe("finished marks on the halls (C72)", () => {
  it("finds every finished work on the shelves in one pass, with no cap", async () => {
    const works = getWorks();
    cookieValue = JSON.stringify(works.map((w, i) => {
      const last = w.chapters.at(-1)!;
      return { id: `s${i}`, slug: w.slug, position: last.position, wordsRead: i === 0 ? 1 : countWords(last.body), activeMs: 60_000, endedAt: 1000 + i };
    }));
    const done = await myFinishes([...works.map((w) => w.slug), "not-a-work"]);
    expect(Object.keys(done).sort()).toEqual(works.slice(1).map((w) => w.slug).sort()); // the first was barely started
    expect(await myFinishes([])).toEqual({});
  });
  it("words the mark and its spoken form in SA time", () => {
    const at = Date.parse("2026-11-04T23:30:00Z");
    expect(finishedDate(at)).toMatch(/^0?5 Nov 2026$/);
    expect(finishedStamp(at)).toBe(`Finished ${finishedDate(at)}`);
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { FinishedShelf } from "@/components/FinishedShelf";

describe("one Finished stamp everywhere (C76)", () => {
  it("the ledger's Read to the end shelf uses the shared stamp", () => {
    const at = Date.parse("2026-11-04T23:30:00Z");
    const html = renderToStaticMarkup(<FinishedShelf items={[{ workKey: "w", finishedAt: at }]} title={() => "Placeholder"} href={() => null} />);
    expect(html).toContain(finishedStamp(at));
  });
  it("no page formats a Finished date by hand any more", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["app/ledger/page.tsx", "app/works/[slug]/page.tsx", "components/FinishedShelf.tsx", "components/RecentlyReturned.tsx", "components/EndOfChapter.tsx", "app/halls/page.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/Finished \{[^}]*toLocaleDateString/);
      expect(src, f).not.toMatch(/finished this · \{new Date/);
    }
  });
});

import { FINISHED_SHELF } from "@/lib/ledger";

describe("work page finished stamp links to the ledger (C82)", () => {
  it("points at the Read to the end shelf, whose heading carries the anchor", async () => {
    const { readFileSync } = await import("node:fs");
    expect(FINISHED_SHELF).toBe("/ledger#finished");
    const shelf = renderToStaticMarkup(<FinishedShelf items={[{ workKey: "w", finishedAt: 1 }]} title={() => "P"} href={() => null} />);
    expect(shelf).toContain('id="finished"');
    expect(readFileSync("app/works/[slug]/page.tsx", "utf8")).toMatch(/<Link href=\{FINISHED_SHELF\}[^>]*>\s*You finished this/);
  });
});
