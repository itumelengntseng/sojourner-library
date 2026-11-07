import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// C91: a "Read to the end" tile at the top of the ledger once a book is finished, leading to the shelf.
let hours: { workKey: string; activeMs: number; wordsRead: number; sessions: number; lastRead: number; finishedAt?: number }[] = [];
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ledgerStore", () => ({
  loadLedger: async () => ({
    mode: "preview", readerName: "", titles: { w: "Placeholder Work One" }, slugs: { w: "placeholder-work-one" },
    history: [], hours, streaks: { current: 0, longest: 0, readToday: false, days: 0 }, totalMs: 0, totalWords: 0, months: [], week: { ms: 0, days: 0 },
  }),
}));
vi.mock("@/lib/continueStore", () => ({ myContinueBySlug: async () => ({}) }));
vi.mock("@/lib/bookLeftStore", () => ({ myBookLeft: async () => ({}), inline: (s: string) => s }));

import Ledger from "@/app/ledger/page";

const render = async () => renderToStaticMarkup(await Ledger({ searchParams: Promise.resolve({}) }));

describe("Read to the end tile (C91)", () => {
  it("shows the count and links down to the shelf once a book is finished", async () => {
    hours = [{ workKey: "w", activeMs: 60_000, wordsRead: 100, sessions: 1, lastRead: 2, finishedAt: 2 }];
    const html = await render();
    expect(html).toMatch(/<dt[^>]*>Read to the end<\/dt><dd[^>]*>1 book<\/dd>/);
    expect(html).toContain('href="#finished"');
    expect(html).toContain('id="finished"');
    expect(html).toContain("sm:grid-cols-4");
  });
  it("is absent until a book is finished", async () => {
    hours = [{ workKey: "w", activeMs: 60_000, wordsRead: 100, sessions: 1, lastRead: 2 }];
    const html = await render();
    expect(html).not.toContain(">Read to the end</dt>");
    expect(html).not.toContain('href="#finished"');
    expect(html).toContain("lg:grid-cols-6");
  });
});
