import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { kitsPlaceholder } from "@/lib/pitch";

// C223: the Pitch Room says how many kits still carry placeholder words, with an edit link for each (one to three).
const k = (slug: string, isPlaceholder: boolean) => ({ slug, title: slug.toUpperCase(), isPlaceholder });

describe("Pitch Room placeholder kits (C223)", () => {
  it("counts and links one to three placeholder kits", () => {
    expect(kitsPlaceholder([k("a", true), k("b", false)])).toEqual({ line: "1 of 2 kits still placeholder — edit it and tick “in my own words”.", edit: [{ title: "A", href: "/pitch-room/a/edit" }] });
    const three = kitsPlaceholder([k("a", true), k("b", true), k("c", true)])!;
    expect(three.line).toBe("3 of 3 kits still placeholders — edit each and tick “in my own words”.");
    expect(three.edit.map((e) => e.href)).toEqual(["/pitch-room/a/edit", "/pitch-room/b/edit", "/pitch-room/c/edit"]);
  });
  it("four or more keep the count without links; none says every kit is his own; no kits → nothing", () => {
    expect(kitsPlaceholder(["a", "b", "c", "d"].map((s) => k(s, true)))!.edit).toEqual([]);
    expect(kitsPlaceholder([k("a", false)])).toEqual({ line: "Every kit is in your own words.", edit: [] });
    expect(kitsPlaceholder([k("a", true)])!.line).toBe("1 of 1 kit still placeholder — edit it and tick “in my own words”.");
    expect(kitsPlaceholder([])).toBeNull();
  });
  it("the room counts every kit (not just a search's matches)", () => {
    const page = readFileSync("app/pitch-room/page.tsx", "utf8");
    expect(page).toContain("kitsPlaceholder(all.map((p) => ({ slug: p.kit.slug, title: p.work.title, isPlaceholder: p.kit.isPlaceholder })))");
    expect(page).toContain("data-kits-placeholder");
  });
});
