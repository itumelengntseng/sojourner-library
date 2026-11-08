import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { replaceHref, replaceNote, replaceTarget } from "@/lib/replaceManuscript";
import { importPlan, parseManuscript, planSummary, slugify, type ShelvedWork } from "@/lib/manuscript";

// C218: a placeholder work on the Writer's Room shelf list leads to "Shelve a manuscript" with its title filled in.
const works = [
  { slug: "placeholder-work-one", title: "Placeholder Work One", isPlaceholder: true },
  { slug: "own-words", title: "Own Words", isPlaceholder: false },
  { slug: "odd-address", title: "Placeholder Work Two", isPlaceholder: true },
];

describe("replace with your manuscript (C218)", () => {
  it("links to the import form by the work's address", () => {
    expect(replaceHref("placeholder-work-one")).toBe("/writers-room?replace=placeholder-work-one#import");
    expect(replaceHref("a b")).toBe("/writers-room?replace=a%20b#import");
  });
  it("only a placeholder work on the shelves is a target", () => {
    expect(replaceTarget(works, "placeholder-work-one")).toEqual({ slug: "placeholder-work-one", title: "Placeholder Work One", sameAddress: true });
    expect(replaceTarget(works, "own-words")).toBeNull();
    expect(replaceTarget(works, "nope")).toBeNull();
    expect(replaceTarget(works, undefined)).toBeNull();
    expect(replaceTarget(works, ["placeholder-work-one"])).toBeNull();
    expect(replaceTarget(works, "  ")).toBeNull();
  });
  it("says nothing changes until Save — and warns when the title would shelve a new work", () => {
    const same = replaceTarget(works, "placeholder-work-one")!;
    expect(replaceNote(same)).toContain("Nothing changes until you save");
    const odd = replaceTarget(works, "odd-address")!;
    expect(odd.sameAddress).toBe(false);
    expect(replaceNote(odd)).toContain("shelves a new work beside it");
  });
  it("the filled-in title finds the work already shelved, so the plan says it updates it", () => {
    const parsed = parseManuscript("## Chapter one\n\nText of my own.\n");
    const t = replaceTarget(works, "placeholder-work-one")!;
    const shelf: Record<string, ShelvedWork> = { "placeholder-work-one": { title: t.title, setAside: false, chapters: [{ position: 1, title: "Chapter 1", words: 900, archived: false }] } };
    const plan = importPlan(parsed, shelf[slugify(t.title)]);
    expect(plan.update).toBe(true);
    expect(planSummary(plan)).toMatch(/^Updates the work already on the shelves/);
  });
  it("the room shows the link on placeholder works only and prefills the form (remounted per target)", () => {
    const page = readFileSync("app/writers-room/page.tsx", "utf8");
    expect(page).toContain("{w.isPlaceholder && <Link href={replaceHref(w.slug)}");
    expect(page).toContain('<ManuscriptImport key={replacing?.slug ?? "blank"} canSave={live} shelf={room.shelf} initialTitle={replacing?.title} />');
    expect(readFileSync("components/WritersRoomForms.tsx", "utf8")).toContain("useState(initialTitle)");
  });
});
