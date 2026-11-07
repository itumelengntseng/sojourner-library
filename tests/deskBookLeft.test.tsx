import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// C78: the work page's loan desk says how long is left in the book, under "Resume at your bookmark".
vi.mock("@/app/works/[slug]/actions", () => ({ deskAction: async () => ({ ok: false, message: "" }) }));

const { LoanDesk } = await import("@/components/LoanDesk");
import type { Loan } from "@/lib/engine/checkout";

const NOW = Date.parse("2026-11-06T10:00:00Z");
const loan = (wordOffset: number): Loan => ({ id: "l", workId: "w", readerId: "me", period: "two_weeks", borrowedAt: NOW - 1000, dueAt: NOW + 86_400_000, returnedAt: null, renewals: 0, bookmark: { chapterIndex: 0, wordOffset } });
const desk = (loans: Loan[]) => ({ mode: "preview" as const, readerId: "me", workId: "w", loans });

describe("time left in the book at the loan desk (C78)", () => {
  it("shows under the Resume link once there's a bookmark", () => {
    const html = renderToStaticMarkup(<LoanDesk desk={desk([loan(3450)])} slug="w" title="T" now={NOW} totalWords={9200} wpm={230} />);
    expect(html).toContain("Resume at your bookmark");
    expect(html).toContain("About 25 min left in this book");
    expect(html.indexOf("About 25 min")).toBeGreaterThan(html.indexOf("Resume at your bookmark"));
  });
  it("stays quiet before reading starts, without a loan, or without the book's length", () => {
    expect(renderToStaticMarkup(<LoanDesk desk={desk([loan(0)])} slug="w" title="T" now={NOW} totalWords={9200} wpm={230} />)).not.toContain("left in this book");
    expect(renderToStaticMarkup(<LoanDesk desk={desk([])} slug="w" title="T" now={NOW} totalWords={9200} wpm={230} />)).not.toContain("left in this book");
    expect(renderToStaticMarkup(<LoanDesk desk={desk([loan(3450)])} slug="w" title="T" now={NOW} />)).not.toContain("left in this book");
  });
  it("says so at the end of the book", () => {
    expect(renderToStaticMarkup(<LoanDesk desk={desk([loan(9200)])} slug="w" title="T" now={NOW} totalWords={9200} wpm={230} />)).toContain("At the end of this book");
  });
});

describe("a spent loan explained at the desk (C110)", () => {
  it("says what to do once every renewal is used, and only then", () => {
    const spent = { ...loan(0), renewals: 3 };
    const html = renderToStaticMarkup(<LoanDesk desk={desk([spent])} slug="w" title="T" now={NOW} />);
    expect(html).toMatch(/No renewals left — return it by .+ and borrow it again; your bookmark is kept\./);
    expect(renderToStaticMarkup(<LoanDesk desk={desk([{ ...loan(0), renewals: 2 }])} slug="w" title="T" now={NOW} />)).not.toContain("return it by");
    expect(renderToStaticMarkup(<LoanDesk desk={desk([{ ...spent, returnedAt: NOW - 1000 }])} slug="w" title="T" now={NOW} />)).not.toContain("return it by");
  });
});
