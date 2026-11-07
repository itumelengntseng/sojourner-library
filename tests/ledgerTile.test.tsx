import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// C91: a "Read to the end" tile at the top of the ledger once a book is finished, leading to the shelf.
let history: { id: string; workKey: string; borrowedAt: number; endedAt: number | null; open: boolean; renewals: number }[] = [];
let hours: { workKey: string; activeMs: number; wordsRead: number; sessions: number; lastRead: number; finishedAt?: number }[] = [];
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ledgerStore", () => ({
  loadLedger: async () => ({
    mode: "preview", readerName: "", titles: { w: "Placeholder Work One" }, slugs: { w: "placeholder-work-one" },
    history, hours, streaks: { current: 0, longest: 0, readToday: false, days: 0 }, totalMs: 0, totalWords: 0, months: [], week: { ms: 0, days: 0 },
  }),
}));
vi.mock("@/lib/continueStore", () => ({ myContinueBySlug: async () => ({}) }));
let openSlugs: string[] = [];
vi.mock("@/lib/loanStore", () => ({ myOpenLoans: async () => openSlugs.map((slug) => ({ slug })) }));
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

describe("Borrow again on Read to the end (C92)", () => {
  it("offers Borrow again for a finished book that isn't on loan now", async () => {
    hours = [{ workKey: "w", activeMs: 60_000, wordsRead: 100, sessions: 1, lastRead: 2, finishedAt: 2 }];
    openSlugs = [];
    const html = await render();
    expect(html).toMatch(/<a [^>]*href="\/works\/placeholder-work-one"[^>]*>Borrow again<span class="sr-only">: Placeholder Work One<\/span><\/a>/);
  });
  it("leaves it out while the book is on loan, and for books no longer on the shelves", async () => {
    hours = [{ workKey: "w", activeMs: 60_000, wordsRead: 100, sessions: 1, lastRead: 2, finishedAt: 2 }, { workKey: "gone", activeMs: 1, wordsRead: 1, sessions: 1, lastRead: 1, finishedAt: 1 }];
    openSlugs = ["placeholder-work-one"];
    expect(await render()).not.toContain("Borrow again");
    openSlugs = [];
    expect((await render()).match(/>Borrow again</g)).toHaveLength(1);
  });
});

describe("Finished stamp in Borrowing history (C97)", () => {
  it("stamps only the loan during which the book was read to the end", async () => {
    const fin = Date.parse("2026-11-05T10:00:00Z");
    hours = [{ workKey: "w", activeMs: 60_000, wordsRead: 100, sessions: 1, lastRead: fin, finishedAt: fin }];
    history = [
      { id: "l2", workKey: "w", borrowedAt: Date.parse("2026-11-06T10:00:00Z"), endedAt: null, open: true, renewals: 0 }, // a reread
      { id: "l1", workKey: "w", borrowedAt: Date.parse("2026-11-01T10:00:00Z"), endedAt: Date.parse("2026-11-05T12:00:00Z"), open: false, renewals: 0 },
    ];
    openSlugs = [];
    const html = await render();
    const hist = html.slice(html.indexOf("Borrowing history"));
    expect(hist.match(/Finished 0?5 Nov 2026/g)).toHaveLength(1);
    expect(hist.indexOf("Finished")).toBeGreaterThan(hist.indexOf("on loan"));
    history = [];
  });
});

import { finishedDuring } from "@/lib/ledger";
describe("finishedDuring (C97)", () => {
  const row = { id: "x", workKey: "w", borrowedAt: 100, endedAt: 200 as number | null, open: false, renewals: 0 };
  it("is true only inside the loan, open loans running to now", () => {
    expect(finishedDuring(row, 150, 1_000)).toBe(true);
    expect(finishedDuring(row, 250, 1_000)).toBe(false);
    expect(finishedDuring(row, 50, 1_000)).toBe(false);
    expect(finishedDuring(row, undefined, 1_000)).toBe(false);
    expect(finishedDuring({ ...row, endedAt: null, open: true }, 900, 1_000)).toBe(true);
  });
});

describe("Borrowing history titles link to the work (C98)", () => {
  it("links a title still on the shelves and leaves a set-aside one as text", async () => {
    hours = [];
    history = [
      { id: "l1", workKey: "w", borrowedAt: 1, endedAt: 2, open: false, renewals: 0 },
      { id: "l2", workKey: "gone", borrowedAt: 1, endedAt: 2, open: false, renewals: 0 },
    ];
    const html = await render();
    const hist = html.slice(html.indexOf("Borrowing history"));
    expect(hist).toMatch(/<a [^>]*href="\/works\/placeholder-work-one"[^>]*>Placeholder Work One<\/a>/);
    expect(hist).toContain("A work no longer on the shelves");
    expect(hist).not.toMatch(/<a [^>]*>A work no longer on the shelves/);
    history = [];
  });
});

describe("On loan tile (C113)", () => {
  it("counts the books out now with the soonest due stamp, linking to the front desk", async () => {
    hours = [];
    openSlugs = [];
    const none = await render();
    expect(none).not.toContain(">On loan</dt>");
    const mod = await import("@/lib/loanStore");
    const spy = vi.spyOn(mod, "myOpenLoans").mockResolvedValue([
      { slug: "a", due: "Sat, 07 Nov, 14:00" }, { slug: "b", due: "Mon, 09 Nov, 10:00" },
    ] as never);
    const html = await render();
    expect(html).toMatch(/<dt[^>]*>On loan<\/dt><dd[^>]*>2 books<\/dd>/);
    expect(html).toContain('href="/card"');
    expect(html).toContain("next due Sat, 07 Nov, 14:00");
    expect(html).toContain('<span class="sr-only"> — renew or return at the front desk</span>');
    spy.mockRestore();
  });
});

describe("On loan tile due within the day (C117)", () => {
  it("says so in ember when the soonest loan is due back within the day", async () => {
    hours = [];
    const mod = await import("@/lib/loanStore");
    const soon = Date.now() + 3 * 3600_000;
    const spy = vi.spyOn(mod, "myOpenLoans").mockResolvedValue([{ slug: "a", due: "Sat, 07 Nov, 14:00", dueAt: soon }] as never);
    const html = await render();
    expect(html).toContain("due back within the day · Sat, 07 Nov, 14:00");
    expect(html).toMatch(/class="text-ember underline/);
    spy.mockResolvedValue([{ slug: "a", due: "Mon, 16 Nov, 14:00", dueAt: Date.now() + 9 * 86_400_000 }] as never);
    const later = await render();
    expect(later).toContain("next due Mon, 16 Nov, 14:00");
    expect(later).not.toContain("within the day");
    spy.mockRestore();
  });
});

describe("Due soon mark in Hours per book (C120)", () => {
  it("marks a book on loan due back within the day, with the due time spoken", async () => {
    hours = [{ workKey: "w", activeMs: 60_000, wordsRead: 100, sessions: 1, lastRead: 2 }];
    const mod = await import("@/lib/loanStore");
    const spy = vi.spyOn(mod, "myOpenLoans").mockResolvedValue([{ slug: "placeholder-work-one", due: "Sat, 07 Nov, 14:00", dueAt: Date.now() + 2 * 3600_000 }] as never);
    const html = await render();
    expect(html).toContain('Due soon<span class="sr-only">: back by Sat, 07 Nov, 14:00</span>');
    spy.mockResolvedValue([{ slug: "placeholder-work-one", due: "Mon, 16 Nov, 14:00", dueAt: Date.now() + 9 * 86_400_000 }] as never);
    expect(await render()).not.toContain("Due soon<span");
    spy.mockRestore();
  });
});
