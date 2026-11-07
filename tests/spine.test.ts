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

describe("spine: no renewals left (C108)", () => {
  it("is said after the due time once every renewal is used", () => {
    const s = spokenSpine({ author: "Itumeleng Ntseng", canon: "Canon", readingTime: "40 min", due: "Sat 7 Nov, 14:00", dueSoon: true, noRenewals: true, bookLeft: "About 25 min left in this book" });
    expect(s).toBe("by Itumeleng Ntseng. Canon. 40 min to read. On loan to you, due Sat 7 Nov, 14:00 — due back within the day, no renewals left; about 25 min left in this book.");
    expect(spokenSpine({ author: "Itumeleng Ntseng", canon: "Canon", readingTime: "40 min", noRenewals: true })).not.toContain("renewals");
  });
  it("the halls pass C104's rule for each loan", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("app/halls/page.tsx", "utf8")).toContain("noRenewals: loan ? noRenewalsLeft(loan) : false");
  });
});

describe("spoken spine — just returned (C132)", () => {
  const base = { author: "Itumeleng Ntseng", canon: "Canon", readingTime: "40 min" };
  it("says so for a book handed back within the hour, unless it's out again", () => {
    expect(spokenSpine({ ...base, justReturned: "Sat, 07 Nov, 11:40" })).toBe("by Itumeleng Ntseng. Canon. 40 min to read. Just returned, Sat, 07 Nov, 11:40.");
    expect(spokenSpine({ ...base, due: "Sun, 08 Nov, 11:00", justReturned: "Sat, 07 Nov, 11:40" })).not.toContain("Just returned");
  });
  it("the halls give it a lamplight tick and pass it to the spoken spine", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/halls/page.tsx", "utf8");
    expect(src).toContain("returnedNow.filter((r) => justReturned(r, nowMs))");
    expect(src).toContain('{!loan && backNow[w.slug] && <span aria-hidden="true" title="Just returned"');
    expect(src).toContain("justReturned: backNow[w.slug],");
  });
});
