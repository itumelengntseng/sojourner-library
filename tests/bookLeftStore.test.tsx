import { describe, expect, it, vi } from "vitest";

// C77/C78: the shared "left in this book" lines, read from the reader's own preview desk.
const jar: Record<string, string> = {};
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (k: string) => (k in jar ? { value: jar[k] } : undefined) }) }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => null }));

import { inline, myBookLeft } from "@/lib/bookLeftStore";
import { PREVIEW_COOKIE, PREVIEW_READER, serializePreviewLoans } from "@/lib/loanDesk";
import { getWork } from "@/lib/catalogue";
import { countWords } from "@/lib/engine/readingTime";

describe("time left in each book on loan, shared (C77/C78)", () => {
  it("gives one line per open loan from its bookmark, and nothing without loans", async () => {
    expect(await myBookLeft()).toEqual({});
    const w = getWork("placeholder-work-two")!;
    const total = w.chapters.reduce((n, c) => n + countWords(c.body), 0);
    const now = Date.now();
    jar[PREVIEW_COOKIE] = serializePreviewLoans([
      { id: "l1", workId: w.slug, readerId: PREVIEW_READER, period: "two_weeks", borrowedAt: now - 1000, dueAt: now + 86_400_000, returnedAt: null, renewals: 0, bookmark: { chapterIndex: 0, wordOffset: total } },
      { id: "l2", workId: "placeholder-work-one", readerId: PREVIEW_READER, period: "two_weeks", borrowedAt: now - 1000, dueAt: now + 86_400_000, returnedAt: null, renewals: 0, bookmark: { chapterIndex: 0, wordOffset: 0 } },
    ]);
    const lines = await myBookLeft();
    expect(lines["placeholder-work-two"]).toBe("At the end of this book");
    expect(lines["placeholder-work-one"]).toMatch(/^About .+ left in this book$/);
  });
  it("reads mid-sentence", () => {
    expect(inline("About 25 min left in this book")).toBe("about 25 min left in this book");
    expect(inline("At the end of this book")).toBe("at the end of this book");
  });
});
