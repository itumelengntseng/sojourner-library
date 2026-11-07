import { describe, expect, it } from "vitest";
import { borrow, returnLoan } from "@/lib/engine/checkout";
import { dayKey, formatHours, hoursByWork, loanHistory, notesMarkdown, streaks } from "@/lib/ledger";
import { buildPreviewExport } from "@/components/PreviewNotesExport";
import { getWork } from "@/lib/catalogue";
import { splitParagraphs } from "@/lib/reader";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 6, 18, 0); // 20:00 SAST
const s = (daysAgo: number, mins: number, workKey = "w1", words = 500) =>
  ({ workKey, wordsRead: words, activeMs: mins * 60_000, endedAt: NOW - daysAgo * DAY });

describe("days and hours", () => {
  it("rolls the day over at midnight in South Africa", () => {
    expect(dayKey(Date.UTC(2026, 10, 6, 21, 59))).toBe(dayKey(Date.UTC(2026, 10, 6, 22, 1)) - 1);
  });
  it("formats reading time", () => {
    expect(formatHours(30_000)).toBe("under a minute");
    expect(formatHours(12 * 60_000)).toBe("12 min");
    expect(formatHours(200 * 60_000)).toBe("3 h 20 min");
    expect(formatHours(120 * 60_000)).toBe("2 h");
  });
  it("totals hours per book, most recent first", () => {
    const h = hoursByWork([s(3, 30, "w1"), s(1, 15, "w2"), s(0.5, 45, "w1")]);
    expect(h.map((x) => [x.workKey, x.activeMs / 60_000, x.sessions])).toEqual([["w1", 75, 2], ["w2", 15, 1]]);
  });
});

describe("streaks", () => {
  it("counts the current run including today", () => {
    expect(streaks([s(0, 10), s(1, 10), s(2, 10), s(4, 10)], NOW)).toEqual({ current: 3, longest: 3, readToday: true, days: 4 });
  });
  it("keeps yesterday's run alive until today ends", () => {
    expect(streaks([s(1, 10), s(2, 10)], NOW)).toMatchObject({ current: 2, readToday: false });
  });
  it("breaks after a missed day and ignores sub-minute days", () => {
    expect(streaks([s(2, 10), s(3, 10), s(4, 10), s(0, 0.5)], NOW)).toMatchObject({ current: 0, longest: 3, days: 3 });
  });
  it("is zero with no reading", () => {
    expect(streaks([], NOW)).toEqual({ current: 0, longest: 0, readToday: false, days: 0 });
  });
});

describe("history", () => {
  it("lists loans newest first with how they ended", () => {
    const a = borrow({ id: "a", workId: "w1", readerId: "r", period: "hour", now: NOW - 3 * DAY }, []);
    const b = returnLoan(borrow({ id: "b", workId: "w2", readerId: "r", period: "two_weeks", now: NOW - DAY }, []), NOW - DAY / 2);
    const c = borrow({ id: "c", workId: "w3", readerId: "r", period: "evening", now: NOW - 60_000 }, []);
    const h = loanHistory([a, b, c], NOW);
    expect(h.map((r) => [r.id, r.open])).toEqual([["c", true], ["b", false], ["a", false]]);
    expect(h[2].endedAt).toBe(a.dueAt); // expired loans end at their due time
    expect(h[1].endedAt).toBe(NOW - DAY / 2);
  });
});

describe("notes export", () => {
  it("writes Markdown with authorship, quotes and notes in reading order", () => {
    const md = notesMarkdown([{
      title: "Placeholder Work One", author: "Itumeleng Ntseng",
      chapters: [
        { position: 2, title: "Chapter 2", notes: [{ anchorText: "A passage.", body: "Later thought", createdAt: 5 }], highlights: [] },
        { position: 1, title: "Chapter 1", notes: [], highlights: [{ text: "Bright line", colour: "ochre", createdAt: 1 }] },
      ],
    }], NOW, "Thandi");
    expect(md.startsWith("# Notes on the works of Itumeleng Ntseng\n")).toBe(true);
    expect(md).toContain("From The Sojourner Library · Thandi · Exported 6 November 2026");
    expect(md).toContain("_by Itumeleng Ntseng_");
    expect(md.indexOf("### Chapter 1")).toBeLessThan(md.indexOf("### Chapter 2"));
    expect(md).toContain("> Bright line\n\n_highlight · ochre_");
    expect(md).toContain("> A passage.\n\n**Note:** Later thought");
  });
  it("says so when there is nothing to export", () => {
    expect(notesMarkdown([{ title: "T", author: "Itumeleng Ntseng", chapters: [] }], NOW)).toContain("_No notes or highlights yet._");
  });
  it("builds the preview export from browser storage", () => {
    const ch = getWork("placeholder-work-two")!.chapters[0];
    const p = splitParagraphs(ch.body)[1];
    const store: Record<string, string> = {
      "soj:ann:placeholder-work-two:1": JSON.stringify({
        notes: [{ id: "n", anchor: p.start, body: "Mine", createdAt: 2 }],
        highlights: [{ id: "h", start: p.start, end: p.start + 16, colour: "sky" }],
      }),
      "soj:ann:placeholder-work-one:1": "{broken",
    };
    const md = buildPreviewExport((k) => store[k] ?? null, NOW);
    expect(md).toContain("## Placeholder Work Two");
    expect(md).toContain("> Placeholder text");
    expect(md).toContain("**Note:** Mine");
    expect(md).not.toContain("## Placeholder Work One");
  });
});

import { finishedAt, withFinished, FINISH_SHARE } from "@/lib/ledger";
import { parseStoredStats as parseStats } from "@/lib/sessions";

describe("finished stamp", () => {
  const s = (chapterKey: string | undefined, wordsRead: number, endedAt: number) => ({ workKey: "w", chapterKey, wordsRead, activeMs: 60_000, endedAt });
  it("stamps the session in which the last chapter is (nearly) all read", () => {
    const sessions = [s("1", 900, 1), s("3", 400, 3), s("3", 300, 2), s("3", 300, 4)];
    expect(finishedAt(sessions, { key: "3", words: 1000 })).toBe(4); // 300 + 400 + 300 = 1000 at t=4
    expect(finishedAt([s("3", 899, 9)], { key: "3", words: 1000 })).toBeUndefined();
    expect(finishedAt([s("3", 900, 9)], { key: "3", words: 1000 })).toBe(9);
    expect(FINISH_SHARE).toBe(0.9);
  });
  it("needs the last chapter, not just lots of words elsewhere", () => {
    expect(finishedAt([s("1", 5000, 1), s(undefined, 5000, 2)], { key: "3", words: 1000 })).toBeUndefined();
    expect(finishedAt([s("3", 10, 1)], undefined)).toBeUndefined();
    expect(finishedAt([s("3", 10, 1)], { key: "3", words: 0 })).toBeUndefined();
  });
  it("adds the stamp only to finished books", () => {
    const hours = [{ workKey: "w", activeMs: 1, wordsRead: 1, sessions: 1, lastRead: 5 }, { workKey: "x", activeMs: 1, wordsRead: 1, sessions: 1, lastRead: 5 }];
    const out = withFinished(hours, [s("3", 1000, 5)], { w: { key: "3", words: 1000 }, x: { key: "9", words: 10 } });
    expect(out.map((h) => h.finishedAt)).toEqual([5, undefined]);
  });
  it("keeps the chapter in preview session summaries, and drops bad ones", () => {
    const raw = JSON.stringify([{ id: "a", slug: "p", position: 2, wordsRead: 1, activeMs: 1, endedAt: 1 }, { id: "b", position: 0, wordsRead: 1, activeMs: 1, endedAt: 1 }]);
    expect(parseStats(raw).map((x) => [x.id, x.position])).toEqual([["a", 2]]);
  });
});

import { notesFilename } from "@/lib/ledger";
import { renderToStaticMarkup as render29 } from "react-dom/server";
import { PreviewNotesExport } from "@/components/PreviewNotesExport";

describe("notes for one book (C29)", () => {
  const ch = (slug: string) => getWork(slug)!.chapters[0];
  const store: Record<string, string> = {
    "soj:ann:placeholder-work-two:1": JSON.stringify({ notes: [{ id: "a", anchor: splitParagraphs(ch("placeholder-work-two").body)[0].start, body: "Two's note", createdAt: 1 }] }),
    "soj:ann:placeholder-work-one:1": JSON.stringify({ notes: [{ id: "b", anchor: splitParagraphs(ch("placeholder-work-one").body)[0].start, body: "One's note", createdAt: 1 }] }),
  };
  it("filters the export to the one book", () => {
    const md = buildPreviewExport((k) => store[k] ?? null, NOW, "placeholder-work-one");
    expect(md).toContain("One's note");
    expect(md).not.toContain("Two's note");
    expect(buildPreviewExport((k) => store[k] ?? null, NOW)).toContain("Two's note");
  });
  it("names the file after the book, safely", () => {
    expect(notesFilename()).toBe("sojourner-notes.md");
    expect(notesFilename("placeholder-work-one")).toBe("sojourner-notes-placeholder-work-one.md");
    expect(notesFilename('x"; rm')).toBe("sojourner-notes-xrm.md");
  });
  it("renders a small per-book button with the title for screen readers", () => {
    const html = render29(<PreviewNotesExport slug="placeholder-work-one" title="Placeholder Work One" />);
    expect(html).toContain("Notes for this book");
    expect(html).toContain("Placeholder Work One");
  });
});

describe("borrowing history paging (C46)", () => {
  it("shows the newest 10 unless asked for all", async () => {
    const { historyPage } = await import("@/lib/ledger");
    const rows = Array.from({ length: 13 }, (_, i) => i);
    expect(historyPage(rows, false)).toEqual({ rows: rows.slice(0, 10), hidden: 3 });
    expect(historyPage(rows, true)).toEqual({ rows, hidden: 0 });
    expect(historyPage(rows.slice(0, 10), false)).toEqual({ rows: rows.slice(0, 10), hidden: 0 });
    expect(historyPage([], false)).toEqual({ rows: [], hidden: 0 });
  });
});

describe("C56 this week", async () => {
  const { thisWeek } = await import("@/lib/ledger");
  const now = Date.parse("2026-11-07T10:00:00Z"); // Sat, 12:00 SAST
  const s = (endedAt: number, activeMs: number) => ({ wordsRead: 100, activeMs, endedAt });
  it("sums the last 7 SA days, today included, and counts days with a minute or more", () => {
    const w = thisWeek([
      s(now - 1000, 10 * 60_000),                          // today
      s(now - 2 * 86_400_000, 5 * 60_000),                 // Thursday
      s(now - 2 * 86_400_000 + 1000, 30_000),              // same day, adds time
      s(Date.parse("2026-11-01T00:30:00Z"), 20 * 60_000),  // Sun 1 Nov 02:30 SAST — 7th day back, inside
      s(Date.parse("2026-10-31T21:30:00Z"), 60 * 60_000),  // Sat 31 Oct 23:30 SAST — outside
      s(now - 3 * 86_400_000, 20_000),                     // under a minute: time counts, the day doesn't
    ], now);
    expect(w.ms).toBe((10 + 5 + 0.5 + 20) * 60_000 + 20_000);
    expect(w.days).toBe(3);
  });
  it("nothing read → zero", () => {
    expect(thisWeek([], now)).toEqual({ ms: 0, days: 0 });
  });
});

import { chapterHeading, NOTES_HEADING } from "@/lib/ledger";

describe("notes export headings (C68)", () => {
  it("opens with whose works these are and the export date", () => {
    const md = notesMarkdown([], NOW);
    expect(md.split("\n")[0]).toBe(`# ${NOTES_HEADING}`);
    expect(NOTES_HEADING).toBe("Notes on the works of Itumeleng Ntseng");
    expect(md.split("\n")[2]).toBe("From The Sojourner Library · Exported 6 November 2026. Private to you.");
  });
  it("puts each note under its chapter's title, falling back to the number only when untitled", () => {
    const md = notesMarkdown([{
      title: "W", author: "",
      chapters: [
        { position: 1, title: "  The   Crossing ", notes: [{ anchorText: "", body: "first", createdAt: 1 }], highlights: [] },
        { position: 2, title: "", notes: [{ anchorText: "", body: "second", createdAt: 2 }], highlights: [] },
      ],
    }], NOW);
    expect(md).toContain("_by Itumeleng Ntseng_");
    expect(md.indexOf("### The Crossing")).toBeGreaterThan(-1);
    expect(md.indexOf("### The Crossing")).toBeLessThan(md.indexOf("**Note:** first"));
    expect(md.indexOf("### Chapter 2")).toBeLessThan(md.indexOf("**Note:** second"));
    expect(md.indexOf("**Note:** first")).toBeLessThan(md.indexOf("### Chapter 2"));
    expect(chapterHeading({ position: 4, title: "Night Market" })).toBe("Night Market");
  });
  it("the per-book file has the same heading, authorship and chapter titles", () => {
    const ch = getWork("placeholder-work-one")!.chapters[1];
    const store: Record<string, string> = {
      "soj:ann:placeholder-work-one:2": JSON.stringify({ notes: [{ id: "n", anchor: splitParagraphs(ch.body)[0].start, body: "Per-book note", createdAt: 3 }] }),
    };
    const md = buildPreviewExport((k) => store[k] ?? null, NOW, "placeholder-work-one");
    expect(md.split("\n")[0]).toBe("# Notes on the works of Itumeleng Ntseng");
    expect(md).toContain("Exported 6 November 2026");
    expect(md).toContain("## Placeholder Work One\n\n_by Itumeleng Ntseng_");
    expect(md.indexOf(`### ${ch.title}`)).toBeLessThan(md.indexOf("**Note:** Per-book note"));
    expect(md).not.toContain("## Placeholder Work Two");
  });
});

describe("dated notes file names (C81)", () => {
  const at = Date.parse("2026-11-06T22:30:00Z"); // already 7 Nov in Johannesburg
  it("adds the SA export date so repeat downloads don't overwrite", () => {
    expect(notesFilename(undefined, at)).toBe("sojourner-notes-2026-11-07.md");
    expect(notesFilename("placeholder-work-one", at)).toBe("sojourner-notes-placeholder-work-one-2026-11-07.md");
    expect(notesFilename('x"; rm', at)).toBe("sojourner-notes-xrm-2026-11-07.md");
    expect(notesFilename("placeholder-work-one", NaN)).toBe("sojourner-notes-placeholder-work-one.md");
  });
  it("both download paths pass the export time", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("app/ledger/notes/route.ts", "utf8")).toContain("notesFilename(slug, Date.now())");
    expect(readFileSync("components/PreviewNotesExport.tsx", "utf8")).toContain("notesFilename(slug, Date.now())");
  });
});
