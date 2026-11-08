import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { glance } from "@/lib/glance";

describe("Writer's Room loans tile — read in one order (C151)", () => {
  it("note carries borrowed, then returned; the ember due part follows in the same dd", () => {
    const [, , , t] = glance([{ visibility: "members", words: 100, openLoans: 3 }], 0, 2, 2, 1, 1);
    expect(t.note).toBe("3 open loans · 1 borrowed in the last hour · 1 returned in the last hour");
    expect(t.urgentNote).toBe("2 due back within the day");
    const src = readFileSync("app/writers-room/page.tsx", "utf8");
    expect(src).toContain('{t.note && <dd className="font-sans text-[0.65rem] text-sandstone/80">{t.note}{t.urgentNote && <span className="text-ember"> · {t.urgentNote}</span>}</dd>}');
  });
});

describe("Writer's Room Loans this month tile — read in one order (C175)", () => {
  const tile = (taken: number, early: number) =>
    glance([{ visibility: "members", words: 100, openLoans: 0 }], 0, 2, 0, 0, 0, { taken, early }).find((t) => t.label === "Loans this month")!;
  it("reads label, count, then a note that continues the count in words", () => {
    const t = tile(4, 2);
    expect([t.label, t.value, t.note].join(", ")).toBe("Loans this month, 4, taken out in the last 30 days · 2 handed back before they were due");
    expect(t.urgentNote).toBeUndefined();
    expect(tile(1, 1).note).toBe("taken out in the last 30 days · 1 handed back before it was due");
    expect(tile(0, 0).note).toBe("none taken out in the last 30 days");
  });
  it("the tile markup keeps that order: dt label, dd count, dd note", () => {
    const src = readFileSync("app/writers-room/page.tsx", "utf8");
    const label = src.indexOf("<dt className=\"font-sans text-[0.65rem] uppercase tracking-wider text-sandstone\">{t.label}</dt>");
    const value = src.indexOf("<dd className=\"mt-1 text-2xl text-paper\">{t.value}</dd>");
    const note = src.indexOf("{t.note && <dd");
    expect(label).toBeGreaterThan(0);
    expect(label).toBeLessThan(value);
    expect(value).toBeLessThan(note);
  });
});
