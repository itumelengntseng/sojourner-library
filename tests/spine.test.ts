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
