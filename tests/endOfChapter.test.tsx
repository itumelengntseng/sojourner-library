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
