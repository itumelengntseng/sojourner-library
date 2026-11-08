import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { glance } from "@/lib/glance";

// C215: the Writer's Room glance says how many works still carry placeholder text.
const w = (isPlaceholder?: boolean) => ({ visibility: "owner" as const, words: 100, openLoans: 0, ...(isPlaceholder === undefined ? {} : { isPlaceholder }) });

describe("Still placeholder tile (C215)", () => {
  it("counts placeholder works and leads to the shelf list", () => {
    const t = glance([w(true), w(false), w(true)], 0, 1).find((x) => x.label === "Still placeholder")!;
    expect(t).toEqual({ label: "Still placeholder", value: "2", note: "works wait for your manuscripts", href: "#shelves" });
    expect(glance([w(true)], 0, 1).find((x) => x.label === "Still placeholder")!.note).toBe("work waits for your manuscript");
  });
  it("says when every work is in Itu's own words (no link), and stays away without the flag or works", () => {
    expect(glance([w(false)], 0, 1).find((x) => x.label === "Still placeholder")).toEqual({ label: "Still placeholder", value: "0", note: "every work is in your own words" });
    expect(glance([w(), w()], 0, 1).map((x) => x.label)).not.toContain("Still placeholder");
    expect(glance([], 0, 1).map((x) => x.label)).not.toContain("Still placeholder");
  });
  it("the room renders the note as a link when it has one", () => {
    expect(readFileSync("app/writers-room/page.tsx", "utf8")).toContain("{t.href ? <a href={t.href} className=\"underline underline-offset-2 hover:text-lamplight\">{t.note}</a> : t.note}");
  });
});
