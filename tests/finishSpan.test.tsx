import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FinishedShelf } from "@/components/FinishedShelf";
import { finishedBooks, finishSpan, hoursByWork, withFinished, type WorkSession } from "@/lib/ledger";

// C85: "Read to the end" says how long each finished book took, from the first session to the finish (SA days).
const at = (iso: string) => Date.parse(iso);

describe("how long a finished book took (C85)", () => {
  it("counts SA calendar days from the first session to the finish", () => {
    expect(finishSpan(at("2026-11-01T08:00:00Z"), at("2026-11-09T18:00:00Z"))).toBe("over 9 days");
    expect(finishSpan(at("2026-11-05T06:00:00Z"), at("2026-11-05T20:00:00Z"))).toBe("in a day");
    expect(finishSpan(at("2026-11-05T06:00:00Z"), at("2026-11-06T06:00:00Z"))).toBe("over 2 days");
  });
  it("rolls days over at midnight SA time, not UTC", () => {
    // 22:30 UTC on 4 Nov is already 5 Nov in Johannesburg — same SA day as 10:00 UTC on 5 Nov.
    expect(finishSpan(at("2026-11-04T22:30:00Z"), at("2026-11-05T10:00:00Z"))).toBe("in a day");
    // 21:30 UTC on 5 Nov is 23:30 SA (still 5 Nov); 22:30 UTC is 00:30 SA on 6 Nov.
    expect(finishSpan(at("2026-11-05T21:30:00Z"), at("2026-11-05T22:30:00Z"))).toBe("over 2 days");
  });
  it("says nothing without a first session, and never a negative span", () => {
    expect(finishSpan(undefined, at("2026-11-05T10:00:00Z"))).toBeNull();
    expect(finishSpan(Number.NaN, at("2026-11-05T10:00:00Z"))).toBeNull();
    expect(finishSpan(at("2026-11-08T10:00:00Z"), at("2026-11-05T10:00:00Z"))).toBe("in a day");
  });
  it("takes the first session from the reader's own sessions in that book, and keeps it through a reread", () => {
    const s = (workKey: string, chapterKey: string, wordsRead: number, endedAt: number): WorkSession => ({ workKey, chapterKey, wordsRead, activeMs: 60_000, endedAt });
    const sessions = [
      s("w", "1", 500, at("2026-10-28T09:00:00Z")),
      s("other", "1", 500, at("2026-10-01T09:00:00Z")), // another book never counts
      s("w", "2", 1000, at("2026-11-05T09:00:00Z")), // finishes (last chapter, 1000 words)
      s("w", "2", 1000, at("2026-11-07T09:00:00Z")), // a reread later on
    ];
    const hours = withFinished(hoursByWork(sessions), sessions, { w: { key: "2", words: 1000 } });
    const [book] = finishedBooks(hours);
    expect(book).toEqual({ workKey: "w", finishedAt: at("2026-11-05T09:00:00Z"), firstRead: at("2026-10-28T09:00:00Z") });
    expect(finishSpan(book.firstRead, book.finishedAt)).toBe("over 9 days");
  });
  it("shows the span on the shelf beside the title", () => {
    const html = renderToStaticMarkup(
      <FinishedShelf items={[{ workKey: "w", finishedAt: at("2026-11-09T10:00:00Z"), firstRead: at("2026-11-01T10:00:00Z") }, { workKey: "x", finishedAt: at("2026-11-02T10:00:00Z") }]}
        title={(k) => (k === "w" ? "Placeholder Work One" : "Placeholder Work Two")} href={() => null} />,
    );
    expect(html).toContain("· read over 9 days");
    expect(html.match(/· read /g)).toHaveLength(1); // no first session known → no span
    expect(html.indexOf("over 9 days")).toBeLessThan(html.indexOf("Placeholder Work Two"));
    expect(html).toContain("by Itumeleng Ntseng");
  });
});
