import { describe, expect, it } from "vitest";
import { parseSort, sortHref, sortShelf } from "@/lib/shelfSort";

const w = (title: string, updatedAt?: number) => ({ title, ...(updatedAt === undefined ? {} : { updatedAt }) });

describe("shelf order (C33)", () => {
  it("parses only known orders", () => {
    expect(parseSort(undefined)).toBe("shelf");
    expect(parseSort("title")).toBe("title");
    expect(parseSort(["recent", "x"])).toBe("recent");
    expect(parseSort("drop table")).toBe("shelf");
  });
  it("leaves shelf order untouched", () => {
    const list = [w("B"), w("A")];
    expect(sortShelf(list, "shelf")).toBe(list);
  });
  it("sorts by title ignoring case, accents and a leading article", () => {
    expect(sortShelf([w("Zebra"), w("The Apple"), w("éclair"), w("banana")], "title").map((x) => x.title)).toEqual(["The Apple", "banana", "éclair", "Zebra"]);
  });
  it("puts the most recently changed first; undated works after, in shelf order", () => {
    expect(sortShelf([w("u1"), w("old", 1), w("u2"), w("new", 3), w("mid", 2)], "recent").map((x) => x.title)).toEqual(["new", "mid", "old", "u1", "u2"]);
  });
  it("keeps the search and canon choice in links", () => {
    expect(sortHref("shelf", "", undefined)).toBe("/halls");
    expect(sortHref("title", "two words", "all")).toBe("/halls?q=two+words&canon=all&sort=title");
  });
});

describe("shelf order — most read by you (C162)", () => {
  const r = (title: string) => ({ title, slug: title });
  it("parses ?sort=read and offers it", async () => {
    expect(parseSort("read")).toBe("read");
    const { SORTS } = await import("@/lib/shelfSort");
    expect(SORTS.map((o) => o.label)).toContain("Most read by you");
    expect(sortHref("read", "", undefined)).toBe("/halls?sort=read");
  });
  it("puts the reader's most-read works first; unread keep shelf order after", () => {
    const list = [r("u1"), r("little"), r("u2"), r("most"), r("mid")];
    expect(sortShelf(list, "read", { little: 1_000, most: 90_000, mid: 30_000 }).map((x) => x.title)).toEqual(["most", "mid", "little", "u1", "u2"]);
  });
  it("with no reading at all, stays in shelf order", () => {
    const list = [r("b"), r("a")];
    expect(sortShelf(list, "read", {}).map((x) => x.title)).toEqual(["b", "a"]);
  });
  it("ties keep shelf order", () => {
    expect(sortShelf([r("x"), r("y")], "read", { x: 5, y: 5 }).map((x) => x.title)).toEqual(["x", "y"]);
  });
});
