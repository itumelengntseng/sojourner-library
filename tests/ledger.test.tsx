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
    expect(md).toContain("# My notes from The Sojourner Library");
    expect(md).toContain("Thandi · Exported 6 November 2026");
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
