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
