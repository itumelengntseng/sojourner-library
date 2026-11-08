import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ask, isReadSoFarQuestion } from "@/lib/engine/ask";
import { librarianFacts, READ_SO_FAR_QUESTION, suggestedQuestions, toReaderContext } from "@/lib/librarian";
import { AskLibrarian } from "@/components/AskLibrarian";

// C177: the librarian answers "How long have I read this book?" from the reader's own reading time.
const chapters = [{ position: 1, words: 2300 }, { position: 2, words: 2300 }];
const now = new Date(Date.UTC(2026, 10, 8, 12));
const ctx = (readMs?: number) => toReaderContext(librarianFacts({ chapters, bookmarkOffset: 1000, wpm: 230, usualMinutesPerDay: 30, readMs }), now);

describe("How long have I read this book? (C177)", () => {
  it("recognises close phrasings, not the time-left ones", () => {
    for (const q of ["How long have I read this book?", "How much time have I spent on it?", "How long have I been reading?", "How long I’ve read", "time spent reading"]) expect(isReadSoFarQuestion(q), q).toBe(true);
    for (const q of ["How long to finish?", "How long have I got left?", "Time left in this chapter?", "How long have I read this chapter?", "Can I finish by Friday?"]) expect(isReadSoFarQuestion(q), q).toBe(false);
  });
  it("answers from the reader's own time", () => {
    expect(ask("How long have I read this book?", ctx(75 * 60_000))).toEqual({ kind: "read_so_far", minutes: 75, text: "You've read for 1 h 15 min in this book so far." });
    expect(ask("How long have I read this book?", ctx(20_000)).text).toBe("You've read for under a minute in this book so far.");
    expect(ask("How long have I read this book?", ctx(0)).text).toBe("You haven't read in this book yet.");
    expect(ask("How long have I read this book?", ctx(undefined)).text).toBe("Reading time isn't kept in this copy.");
  });
  it("leaves the other questions as they were", () => {
    expect(ask("How long to finish?", ctx(75 * 60_000)).kind).toBe("time_left");
    expect(ask("Time left in this chapter?", ctx(75 * 60_000)).kind).toBe("chapter_left");
  });
  it("offers the chip once there's a minute or more to report", () => {
    expect(suggestedQuestions({ wordsRead: 0, totalWords: 4600, readMs: 60_000 })).toContain(READ_SO_FAR_QUESTION);
    expect(suggestedQuestions({ wordsRead: 0, totalWords: 4600, readMs: 59_000 })).not.toContain(READ_SO_FAR_QUESTION);
    expect(suggestedQuestions({ wordsRead: 0, totalWords: 4600 })).not.toContain(READ_SO_FAR_QUESTION);
    const html = renderToStaticMarkup(<AskLibrarian title="Placeholder Work" facts={librarianFacts({ chapters, bookmarkOffset: 0, wpm: 230, usualMinutesPerDay: 30, readMs: 5 * 60_000 })} />);
    expect(html).toContain(READ_SO_FAR_QUESTION);
  });
  it("the work page and reading room pass own time; the proof copy doesn't", () => {
    expect(readFileSync("app/works/[slug]/page.tsx", "utf8")).toContain("readMs: myHours[work.slug] ?? 0, // C177");
    expect(readFileSync("components/ReaderView.tsx", "utf8")).toContain("...(proof ? {} : { readMs: readMs ?? 0 })");
  });
});

describe("the fallback reply keeps step with the chips (C180)", () => {
  it("lists the read-so-far question only once there's time to report", () => {
    expect(ask("What's for supper?", ctx(0)).text).toBe('Try: "How long to finish?", "Can I finish by Friday?", "How much a day to finish in 2 weeks?" or "Time left in this chapter?"');
    expect(ask("What's for supper?", ctx(5 * 60_000)).text).toBe('Try: "How long to finish?", "Can I finish by Friday?", "How much a day to finish in 2 weeks?", "Time left in this chapter?" or "How long have I read this book?"');
  });
  it("every question the reply suggests is one the chips offer", () => {
    for (const readMs of [0, 5 * 60_000]) {
      const f = librarianFacts({ chapters, bookmarkOffset: 0, wpm: 230, usualMinutesPerDay: 30, readMs });
      const suggested = [...ask("?", toReaderContext(f, now)).text.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      expect(suggested.sort()).toEqual(suggestedQuestions(f).sort());
    }
  });
});
