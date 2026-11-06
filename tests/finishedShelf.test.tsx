import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FinishedShelf } from "@/components/FinishedShelf";
import { finishedBooks, type WorkHours } from "@/lib/ledger";

const h = (workKey: string, finishedAt?: number): WorkHours => ({ workKey, activeMs: 1, wordsRead: 1, sessions: 1, lastRead: 1, ...(finishedAt !== undefined ? { finishedAt } : {}) });
const NOV6 = Date.parse("2026-11-06T10:00:00Z");

describe("read to the end (C41)", () => {
  it("lists only finished books, newest finish first", () => {
    expect(finishedBooks([h("a", 100), h("b"), h("c", 300)])).toEqual([{ workKey: "c", finishedAt: 300 }, { workKey: "a", finishedAt: 100 }]);
    expect(finishedBooks([h("b")])).toEqual([]);
  });
  it("shows nothing until a book is finished", () => {
    expect(renderToStaticMarkup(<FinishedShelf items={[]} title={(k) => k} href={() => null} />)).toBe("");
  });
  it("names each book with a link, the author and a stamped date", () => {
    const html = renderToStaticMarkup(<FinishedShelf items={finishedBooks([h("w1", NOV6), h("gone", NOV6 - 86_400_000)])} title={(k) => (k === "w1" ? "Placeholder Work One" : "A work no longer on the shelves")} href={(k) => (k === "w1" ? "/works/w1" : null)} />);
    expect(html).toContain("Read to the end");
    expect(html).toContain("2 books by Itumeleng Ntseng");
    expect(html).toContain('href="/works/w1"');
    expect(html).toMatch(/Finished 0?6 Nov 2026/);
    expect(html).toContain("A work no longer on the shelves");
    expect(html.indexOf("Placeholder Work One")).toBeLessThan(html.indexOf("A work no longer"));
  });
});
