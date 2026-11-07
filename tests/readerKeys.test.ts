import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { actionForKey, SHORTCUTS, shortcutsFor } from "@/lib/readerKeys";

describe("reading-room keys", () => {
  it("maps the documented keys", () => {
    expect(actionForKey({ key: "ArrowRight" }, false)).toBe("nextPage");
    expect(actionForKey({ key: "ArrowLeft" }, false)).toBe("prevPage");
    expect(actionForKey({ key: "c" }, false)).toBe("contents");
    expect(actionForKey({ key: "P" }, false)).toBe("layout");
    expect(actionForKey({ key: "+" }, false)).toBe("larger");
    expect(actionForKey({ key: "=" }, false)).toBe("larger");
    expect(actionForKey({ key: "-" }, false)).toBe("smaller");
    expect(actionForKey({ key: "b" }, false)).toBe("bookmark");
    expect(actionForKey({ key: "n" }, false)).toBe("note");
    expect(actionForKey({ key: "?" }, false)).toBe("help");
    expect(actionForKey({ key: "x" }, false)).toBeNull();
  });
  it("leaves browser shortcuts alone", () => {
    expect(actionForKey({ key: "c", ctrlKey: true }, false)).toBeNull();
    expect(actionForKey({ key: "p", metaKey: true }, false)).toBeNull();
    expect(actionForKey({ key: "-", altKey: true }, false)).toBeNull();
  });
  it("has no bookmark or note keys in the proof copy, and the card says so", () => {
    expect(actionForKey({ key: "b" }, true)).toBeNull();
    expect(actionForKey({ key: "n" }, true)).toBeNull();
    expect(actionForKey({ key: "c" }, true)).toBe("contents");
    expect(shortcutsFor(true).map((s) => s.label)).not.toContain("Bookmark here");
    expect(shortcutsFor(false)).toHaveLength(SHORTCUTS.length);
  });
  it("ignores keys typed into notes, inputs and the help card itself", () => {
    const src = readFileSync(new URL("../components/ReaderView.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/closest\("textarea, input, select, \[contenteditable\], dialog"\)/);
    expect(src).toContain('aria-haspopup="dialog"');
  });
});

describe("C66 the keys card mentions the Contents extras", async () => {
  const { shortcutsFor } = await import("@/lib/readerKeys");
  it("outside the proof copy the C line names time left and Go to your bookmark", () => {
    const c = shortcutsFor(false).find((s) => s.action === "contents")!;
    expect(c.label).toContain("time left in the book");
    expect(c.label).toContain("Go to your bookmark");
  });
  it("the proof copy's card doesn't mention bookmarks at all", () => {
    expect(shortcutsFor(true).some((s) => /bookmark/i.test(s.label))).toBe(false);
  });
});
