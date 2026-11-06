import { describe, expect, it } from "vitest";
import { importPlan, parseManuscript, planSummary, type ShelvedWork } from "@/lib/manuscript";

const md = (chs: [string, string][]) => `# Placeholder Book\n\n${chs.map(([t, b]) => `## ${t}\n\n${b}`).join("\n\n")}`;
const shelved: ShelvedWork = {
  title: "Placeholder Book", setAside: false,
  chapters: [
    { position: 1, title: "One", words: 3, archived: false },
    { position: 2, title: "Two", words: 2, archived: false },
    { position: 3, title: "Three", words: 4, archived: false },
    { position: 4, title: "Four", words: 1, archived: true },
  ],
};

describe("re-import preview", () => {
  it("treats an unknown title as a new work", () => {
    const p = importPlan(parseManuscript(md([["One", "a b c"]])), undefined);
    expect(p.update).toBe(false);
    expect(p.rows.map((r) => r.status)).toEqual(["new"]);
    expect(planSummary(p)).toMatch(/A new work/);
  });
  it("marks unchanged, changed and set-aside chapters, matching by position like the database", () => {
    const p = importPlan(parseManuscript(md([["One", "a b c"], ["Two renamed", "a b"]])), shelved);
    expect(p.rows.map((r) => [r.position, r.status])).toEqual([[1, "same"], [2, "changed"], [3, "archive"]]);
    expect(p.rows[1].was).toEqual({ title: "Two", words: 2 });
    expect(p.counts).toMatchObject({ same: 1, changed: 1, archive: 1, new: 0 });
    expect(planSummary(p)).toBe("Updates the work already on the shelves: 1 changed, 1 set aside, 1 unchanged.");
  });
  it("brings an archived chapter back and adds new ones", () => {
    const p = importPlan(parseManuscript(md([["One", "a b c"], ["Two", "a b"], ["Three", "a b c d"], ["Four", "x"], ["Five", "y z"]])), shelved);
    expect(p.rows.map((r) => r.status)).toEqual(["same", "same", "same", "restored", "new"]);
    expect(p.counts.archive).toBe(0);
  });
  it("counts a word-count change as changed even with the same title", () => {
    const p = importPlan(parseManuscript(md([["One", "a b c d e"]])), shelved);
    expect(p.rows[0]).toMatchObject({ status: "changed", was: { title: "One", words: 3 } });
  });
  it("warns when the work is set aside", () => {
    const p = importPlan(parseManuscript(md([["One", "a b c"]])), { ...shelved, setAside: true });
    expect(planSummary(p)).toMatch(/stays off the shelves until you restore it/);
  });
  it("never plans a deletion", () => {
    const p = importPlan(parseManuscript(md([["Only", "x"]])), shelved);
    expect(p.rows.length).toBeGreaterThanOrEqual(shelved.chapters.filter((c) => !c.archived).length);
    expect(p.rows.every((r) => ["new", "changed", "same", "restored", "archive"].includes(r.status))).toBe(true);
  });
});
