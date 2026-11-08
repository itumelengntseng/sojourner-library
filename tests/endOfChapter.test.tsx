import { describe, expect, it, vi } from "vitest";

// The desk action is server-only; the card just needs something to post to.
vi.mock("@/app/works/[slug]/actions", () => ({ returnFromRoomAction: async () => ({ ok: false, message: "" }) }));
import { renderToStaticMarkup } from "react-dom/server";
import { EndOfChapter, endOfChapter } from "@/components/EndOfChapter";

const CH = [
  { position: 2, title: "Placeholder chapter two", words: 2300 },
  { position: 1, title: "Placeholder chapter one", words: 1150 },
];

describe("end of chapter card", () => {
  it("points to the next chapter by position with minutes at the reader's pace", () => {
    expect(endOfChapter(CH, 1, 230)).toEqual({ kind: "next", position: 2, title: "Placeholder chapter two", minutes: 10 });
    expect(endOfChapter(CH, 2, 230)).toEqual({ kind: "end" });
  });
  it("renders Continue into the next chapter, keeping the room (read or proof)", () => {
    const html = renderToStaticMarkup(<EndOfChapter slug="w" title="Placeholder Work" chapters={CH} position={1} wpm={230} base="/works/w/proof" proof />);
    expect(html).toContain("Placeholder chapter two");
    expect(html).toContain('href="/works/w/proof?ch=2"');
    expect(html).toContain("Continue");
    expect(html).toContain("230 wpm");
  });
  it("on the last chapter says the end of the work and links to the ledger (reader) or Writer's Room (proof)", () => {
    const reader = renderToStaticMarkup(<EndOfChapter slug="w" title="Placeholder Work" chapters={CH} position={2} wpm={230} base="/works/w/read" proof={false} />);
    expect(reader).toContain("The end of Placeholder Work");
    expect(reader).toContain('href="/ledger"');
    expect(reader).not.toContain("Continue");
    const proof = renderToStaticMarkup(<EndOfChapter slug="w" title="Placeholder Work" chapters={CH} position={2} wpm={230} base="/works/w/proof" proof />);
    expect(proof).toContain('href="/writers-room"');
    expect(proof).not.toContain('href="/ledger"');
  });
});

describe("return from the reading room (C40)", () => {
  const CH2 = [{ position: 1, title: "Placeholder chapter one", words: 1150 }];
  it("offers Return to shelf on the last chapter of a loan, with the loan id and a bookmark note", () => {
    const html = renderToStaticMarkup(<EndOfChapter slug="w" title="Placeholder Work" chapters={CH2} position={1} wpm={230} base="/works/w/read" proof={false} loanId="loan-1" />);
    expect(html).toContain("Return to shelf");
    expect(html).toContain('name="loanId" value="loan-1"');
    expect(html).toContain('name="intent" value="return"');
    expect(html).toContain("Your bookmark is kept");
  });
  it("never in the proof copy, nor mid-book, nor without a loan", () => {
    expect(renderToStaticMarkup(<EndOfChapter slug="w" title="T" chapters={CH2} position={1} wpm={230} base="/works/w/proof" proof loanId="" />)).not.toContain("Return to shelf");
    expect(renderToStaticMarkup(<EndOfChapter slug="w" title="T" chapters={CH} position={1} wpm={230} base="/works/w/read" proof={false} loanId="loan-1" />)).not.toContain("Return to shelf");
    expect(renderToStaticMarkup(<EndOfChapter slug="w" title="T" chapters={CH2} position={1} wpm={230} base="/works/w/read" proof={false} />)).not.toContain("Return to shelf");
  });
});

describe("Finished stamp on the end-of-book card (C75)", () => {
  const at = Date.parse("2026-11-04T23:30:00Z");
  it("shows on the reader's last page once they've read the book to the end", () => {
    const html = renderToStaticMarkup(<EndOfChapter slug="w" title="Placeholder Work" chapters={CH} position={2} wpm={230} base="/works/w/read" proof={false} finishedAt={at} />);
    expect(html).toMatch(/Finished 0?5 Nov 2026/);
    expect(html).toContain(`dateTime="${new Date(at).toISOString()}"`);
  });
  it("never shows in the proof copy, before the last chapter, or before finishing", () => {
    expect(renderToStaticMarkup(<EndOfChapter slug="w" title="P" chapters={CH} position={2} wpm={230} base="/works/w/proof" proof finishedAt={at} />)).not.toContain("Finished");
    expect(renderToStaticMarkup(<EndOfChapter slug="w" title="P" chapters={CH} position={1} wpm={230} base="/works/w/read" proof={false} finishedAt={at} />)).not.toContain("Finished");
    expect(renderToStaticMarkup(<EndOfChapter slug="w" title="P" chapters={CH} position={2} wpm={230} base="/works/w/read" proof={false} />)).not.toContain("Finished");
  });
});

describe("how long it took on the end-of-book card (C87)", () => {
  const at = Date.parse("2026-11-09T10:00:00Z");
  const first = Date.parse("2026-11-01T10:00:00Z");
  it("adds 'Read over 9 days' under the Finished stamp when the first session is known", () => {
    const html = renderToStaticMarkup(<EndOfChapter slug="w" title="P" chapters={CH} position={2} wpm={230} base="/works/w/read" proof={false} finishedAt={at} firstRead={first} />);
    expect(html).toContain("Read over 9 days");
    expect(html.indexOf("Read over 9 days")).toBeGreaterThan(html.indexOf("Finished"));
    expect(renderToStaticMarkup(<EndOfChapter slug="w" title="P" chapters={CH} position={2} wpm={230} base="/works/w/read" proof={false} finishedAt={at} />)).not.toContain("Read ");
  });
  it("never in the proof copy or before finishing", () => {
    expect(renderToStaticMarkup(<EndOfChapter slug="w" title="P" chapters={CH} position={2} wpm={230} base="/works/w/proof" proof finishedAt={at} firstRead={first} />)).not.toContain("Read over");
    expect(renderToStaticMarkup(<EndOfChapter slug="w" title="P" chapters={CH} position={2} wpm={230} base="/works/w/read" proof={false} firstRead={first} />)).not.toContain("Read over");
  });
});

describe("no renewals left on the end-of-book card (C115)", () => {
  it("adds the note beside Return to shelf only when the loan is spent", () => {
    const spent = renderToStaticMarkup(<EndOfChapter slug="w" title="Placeholder Work" chapters={CH} position={2} wpm={230} base="/works/w/read" proof={false} loanId="l1" noRenewals />);
    expect(spent).toContain("Return to shelf");
    expect(spent).toContain("No renewals left on this loan.");
    const fresh = renderToStaticMarkup(<EndOfChapter slug="w" title="Placeholder Work" chapters={CH} position={2} wpm={230} base="/works/w/read" proof={false} loanId="l1" />);
    expect(fresh).not.toContain("No renewals left");
    const proof = renderToStaticMarkup(<EndOfChapter slug="w" title="Placeholder Work" chapters={CH} position={2} wpm={230} base="/works/w/proof" proof noRenewals />);
    expect(proof).not.toContain("No renewals left");
  });
  it("the reading room passes the loan's renewals left", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("components/ReaderView.tsx", "utf8")).toContain("noRenewals={data.renewalsLeft === 0}");
  });
});

describe("end card — You've spent <time> reading this book (C174)", () => {
  const card = (proof: boolean, readMs?: number) =>
    renderToStaticMarkup(<EndOfChapter slug="w" title="Placeholder Work" chapters={CH} position={2} wpm={230} base={proof ? "/works/w/proof" : "/works/w/read"} proof={proof} readMs={readMs} />).replace(/<!-- -->/g, "");
  it("says the reader's own time on the last page", () => {
    expect(card(false, 125 * 60_000)).toContain("You&#x27;ve spent 2 h 5 min reading this book");
  });
  it("says nothing with no time read, mid-book, or in the Keeper's proof copy", () => {
    expect(card(false, 0)).not.toContain("spent");
    expect(card(false)).not.toContain("spent");
    expect(card(true, 125 * 60_000)).not.toContain("spent");
    const mid = renderToStaticMarkup(<EndOfChapter slug="w" title="Placeholder Work" chapters={CH} position={1} wpm={230} base="/works/w/read" proof={false} readMs={60 * 60_000} />);
    expect(mid).not.toContain("spent");
  });
  it("the reading room passes the ledger's hours; the proof copy doesn't", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("app/works/[slug]/read/page.tsx", "utf8")).toContain("const readMs = hours[slug];");
    expect(readFileSync("app/works/[slug]/proof/page.tsx", "utf8")).not.toContain("readMs");
  });
});

describe("end card notes line (C204)", () => {
  it("on the last page, says what the reader made in this book", async () => {
    const html = renderToStaticMarkup(<EndOfChapter slug="w" title="Placeholder Work" chapters={CH} position={2} wpm={230} base="/works/w/read" proof={false} annotations={{ notes: 3, highlights: 1 }} />);
    expect(html).toContain("You made 3 margin notes and 1 highlight in this book.");
  });
  it("not before the last page, not with none, never in the proof copy", () => {
    const a = { notes: 3, highlights: 1 };
    expect(renderToStaticMarkup(<EndOfChapter slug="w" title="Placeholder Work" chapters={CH} position={1} wpm={230} base="/works/w/read" proof={false} annotations={a} />)).not.toContain("You made");
    expect(renderToStaticMarkup(<EndOfChapter slug="w" title="Placeholder Work" chapters={CH} position={2} wpm={230} base="/works/w/read" proof={false} annotations={{ notes: 0, highlights: 0 }} />)).not.toContain("You made");
    expect(renderToStaticMarkup(<EndOfChapter slug="w" title="Placeholder Work" chapters={CH} position={2} wpm={230} base="/works/w/proof" proof annotations={a} />)).not.toContain("You made");
  });
  it("the reading room passes the book's live counts, summed chapter by chapter", async () => {
    const { sumCounts } = await import("@/lib/notesCount");
    expect(sumCounts([{ notes: 1, highlights: 0 }, undefined, { notes: 2, highlights: 1 }])).toEqual({ notes: 3, highlights: 1 });
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("components/ReaderView.tsx", "utf8")).toContain("annotations={proof ? undefined : sumCounts(chapters.map((c) => chapterCount(c.position)))} />");
  });
});
