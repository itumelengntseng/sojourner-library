import { describe, expect, it } from "vitest";
import { spokenSpine } from "@/lib/spine";
import { finishedDate } from "@/lib/ledger";

describe("spoken spine on the halls (C72, C79)", () => {
  const base = { author: "Itumeleng Ntseng", canon: "Canon", readingTime: "40 min" };
  it("keeps authorship and reading time", () => {
    expect(spokenSpine(base)).toBe("by Itumeleng Ntseng. Canon. 40 min to read.");
  });
  it("adds the due date and the time left in the book for a book on loan", () => {
    expect(spokenSpine({ ...base, due: "Fri 6 Nov, 14:00", bookLeft: "About 25 min left in this book" }))
      .toBe("by Itumeleng Ntseng. Canon. 40 min to read. On loan to you, due Fri 6 Nov, 14:00; about 25 min left in this book.");
    expect(spokenSpine({ ...base, due: "Fri 6 Nov, 14:00" })).toBe("by Itumeleng Ntseng. Canon. 40 min to read. On loan to you, due Fri 6 Nov, 14:00.");
    expect(spokenSpine({ ...base, bookLeft: "About 25 min left in this book" })).not.toContain("left in this book"); // not on loan → not spoken
  });
  it("adds the finish date", () => {
    const at = Date.parse("2026-11-04T23:30:00Z");
    expect(spokenSpine({ ...base, finished: at })).toContain(`You read this to the end on ${finishedDate(at)}.`);
  });
});

describe("due soon on the halls spine (C99)", () => {
  const base = { author: "Itumeleng Ntseng", canon: "Canon", readingTime: "40 min" };
  it("says the book is due back within the day, before the time left", () => {
    expect(spokenSpine({ ...base, due: "Sat 7 Nov, 14:00", dueSoon: true, bookLeft: "About 25 min left in this book" }))
      .toBe("by Itumeleng Ntseng. Canon. 40 min to read. On loan to you, due Sat 7 Nov, 14:00 — due back within the day; about 25 min left in this book.");
  });
  it("never says it for a book not on loan or not due soon", () => {
    expect(spokenSpine({ ...base, dueSoon: true })).not.toContain("within the day");
    expect(spokenSpine({ ...base, due: "Sat 14 Nov, 14:00", dueSoon: false })).not.toContain("within the day");
  });
  it("the halls page draws the band only for loans due within the day", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/halls/page.tsx", "utf8");
    expect(src).toMatch(/dueBackSoon\(loansNow, Date\.now\(\)\)/);
    expect(src).toMatch(/\{loan && soon\.has\(w\.slug\) && <span aria-hidden="true"[^>]*>due soon<\/span>\}/);
  });
});
