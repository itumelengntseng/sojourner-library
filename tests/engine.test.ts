import { describe, expect, it } from "vitest";
import {
  activeMs, canFinishBy, countWords, DEFAULT_WPM, formatDuration, minutesFor, personalWpm, planFinish,
} from "../lib/engine/readingTime";
import { borrow, canRead, LOAN_PERIOD_MS, loanStatus, MAX_RENEWALS, renew, returnLoan, updateBookmark } from "../lib/engine/checkout";
import { ask, parseDeadline } from "../lib/engine/ask";

const MIN = 60_000;
const DAY = 86_400_000;

describe("countWords", () => {
  it("ignores frontmatter, markup and links but keeps link text", () => {
    const md = `---\ntitle: Book One\nseries: Sojourner\n---\n# Chapter One\n\nLethabo walked **Lenox Avenue** at [dawn](http://x.y).\n\n<!-- note -->`;
    expect(countWords(md)).toBe(8); // Chapter One Lethabo walked Lenox Avenue at dawn
  });
  it("treats contractions as one word", () => {
    expect(countWords("Don't you ever ask me that.")).toBe(6);
  });
  it("returns 0 for empty text", () => {
    expect(countWords("")).toBe(0);
  });
});

describe("personal reading speed", () => {
  const session = (words: number, minutes: number, endedAt: number) => ({
    wordsRead: words,
    endedAt,
    activity: Array.from({ length: minutes + 1 }, (_, i) => endedAt - (minutes - i) * MIN),
  });

  it("falls back to the default with no history", () => {
    expect(personalWpm([])).toBe(DEFAULT_WPM);
  });
  it("ignores idle gaps over two minutes", () => {
    expect(activeMs([0, MIN, 2 * MIN, 30 * MIN, 31 * MIN])).toBe(3 * MIN);
  });
  it("learns from real sessions", () => {
    expect(personalWpm([session(3000, 10, 10 * DAY)])).toBe(300);
  });
  it("weights recent sessions more heavily", () => {
    const old = session(2000, 10, 0); // 200 wpm, 60 days earlier
    const recent = session(3000, 10, 60 * DAY); // 300 wpm
    expect(personalWpm([old, recent])).toBeGreaterThan(290);
  });
  it("discards tiny or impossible sessions", () => {
    expect(personalWpm([session(50, 1, 0), session(100000, 1, 0)])).toBe(DEFAULT_WPM);
  });
});

describe("time calculations", () => {
  it("rounds minutes up", () => {
    expect(minutesFor(231, 230)).toBe(2);
    expect(minutesFor(0, 230)).toBe(0);
  });
  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(135)).toBe("2 h 15 min");
  });
  it("plans minutes per day", () => {
    expect(planFinish(23000, 230, 10).minutesPerDay).toBe(10);
  });
  it("judges deadlines", () => {
    const now = new Date("2026-11-05T09:00:00Z"); // Thursday
    const fri = new Date("2026-11-06T00:00:00Z");
    expect(canFinishBy(23000, 230, fri, 60, now).possible).toBe(true); // 100 min over 2 days
    expect(canFinishBy(23000, 230, fri, 30, now).possible).toBe(false);
  });
});

describe("checkout", () => {
  const base = { id: "L1", workId: "book-one", readerId: "itu", period: "evening" as const, now: 0 };

  it("borrows with a due date", () => {
    const loan = borrow(base, []);
    expect(loan.dueAt).toBe(LOAN_PERIOD_MS.evening);
    expect(canRead(loan, MIN)).toBe(true);
  });
  it("warns when due soon and expires on time", () => {
    const loan = borrow(base, []);
    expect(loanStatus(loan, loan.dueAt - 10 * MIN)).toBe("due_soon");
    expect(loanStatus(loan, loan.dueAt)).toBe("expired");
    expect(canRead(loan, loan.dueAt)).toBe(false);
  });
  it("prevents borrowing the same work twice", () => {
    const loan = borrow(base, []);
    expect(() => borrow({ ...base, id: "L2", now: MIN }, [loan])).toThrow(/already on loan/);
  });
  it("keeps the bookmark across loans", () => {
    let loan = borrow(base, []);
    loan = updateBookmark(loan, { chapterIndex: 3, wordOffset: 12000 }, MIN);
    const expired = loan.dueAt + 1;
    const next = borrow({ ...base, id: "L2", now: expired }, [loan]);
    expect(next.bookmark).toEqual({ chapterIndex: 3, wordOffset: 12000 });
  });
  it("renews from the due date and enforces the limit", () => {
    let loan = borrow(base, []);
    loan = renew(loan, MIN);
    expect(loan.dueAt).toBe(2 * LOAN_PERIOD_MS.evening);
    for (let i = 1; i < MAX_RENEWALS; i++) loan = renew(loan, MIN);
    expect(() => renew(loan, MIN)).toThrow(/limit/);
  });
  it("can't renew a returned loan", () => {
    const loan = returnLoan(borrow(base, []), MIN);
    expect(() => renew(loan, 2 * MIN)).toThrow(/returned/);
  });
});

describe("ask the librarian", () => {
  const ctx = {
    wpm: 230, totalWords: 92000, wordsRead: 46000, chapterWordsRemaining: 2300,
    usualMinutesPerDay: 45, now: new Date("2026-11-05T09:00:00Z"),
  };

  it("answers how long to finish", () => {
    const a = ask("How long will it take to finish?", ctx);
    expect(a.kind).toBe("time_left");
    if (a.kind === "time_left") expect(a.minutes).toBe(200);
  });
  it("answers chapter time", () => {
    const a = ask("time left in this chapter?", ctx);
    expect(a.kind).toBe("chapter_left");
  });
  it("answers minutes per day over a span", () => {
    const a = ask("How much a day to finish in 2 weeks?", ctx);
    expect(a.kind).toBe("per_day");
    if (a.kind === "per_day") expect(a.minutesPerDay).toBe(15);
  });
  it("answers deadline questions", () => {
    const a = ask("Can I finish by Friday?", ctx);
    expect(a.kind).toBe("deadline");
    if (a.kind === "deadline") expect(a.possible).toBe(false); // needs 100 min/day
  });
  it("parses weekdays forward", () => {
    expect(parseDeadline("by friday", ctx.now)?.toISOString().slice(0, 10)).toBe("2026-11-06");
    expect(parseDeadline("by thursday", ctx.now)?.toISOString().slice(0, 10)).toBe("2026-11-12");
  });
  it("guides on unknown questions", () => {
    expect(ask("what's the weather", ctx).kind).toBe("unknown");
  });
});
