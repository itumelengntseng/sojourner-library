import { describe, expect, it } from "vitest";
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
