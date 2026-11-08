import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NotesTally } from "@/components/NotesTally";
import { SpineNotes } from "@/components/SpineNotes";
import { annotatedTitles, notesAcrossLine, previewBookCount, totalAnnotations } from "@/lib/notesCount";

// C209: from one store, the ledger's named books, the halls spines that say "You have notes in it."
// and the card's "across N books" agree on which books hold the reader's notes.
const works = [
  { slug: "one", title: "Placeholder Work One", positions: [1, 2] },
  { slug: "two", title: "Placeholder Work Two", positions: [1] },
  { slug: "three", title: "Placeholder Work Three", positions: [1, 2] },
];
const store: Record<string, string> = {
  "soj:ann:one:2": JSON.stringify({ notes: [{ id: "a" }], highlights: [] }),
  "soj:ann:two:1": JSON.stringify({ notes: [], highlights: [] }),
  "soj:ann:three:1": "{damaged",
  "soj:ann:three:2": JSON.stringify({ notes: [], highlights: [{ id: "h" }] }),
};
const read = (k: string) => store[k] ?? null;

describe("which books hold notes agree everywhere (C209)", () => {
  it("preview: ledger names, spines and the card count the same books", () => {
    const byWork = Object.fromEntries(works.map((w) => [w.slug, w.positions.map((p) => read(`soj:ann:${w.slug}:${p}`))]));
    const totals = totalAnnotations(byWork, Object.fromEntries(works.map((w) => [w.slug, w.title])));
    // SpineNotes' rule: the book's own count is above zero.
    const spoken = works.filter((w) => { const c = previewBookCount(w.slug, w.positions, read); return c.notes + c.highlights > 0; }).map((w) => w.title);
    expect(spoken).toEqual(["Placeholder Work One", "Placeholder Work Three"]);
    expect(totals.titles).toEqual(spoken);
    expect(totals.books).toBe(spoken.length);
    expect(notesAcrossLine(totals, true)).toBe("1 margin note · 1 highlight across Placeholder Work One and Placeholder Work Three");
    expect(renderToStaticMarkup(<NotesTally totals={totals} link />)).toContain(`across ${spoken.length} books`);
  });
  it("library: the noted slugs and the named titles come from the same own rows", () => {
    const rows = [{ id: "w3", slug: "three", title: "Placeholder Work Three", series: null, series_order: 3 }, { id: "w1", slug: "one", title: "Placeholder Work One", series: null, series_order: 1 }];
    const titles = annotatedTitles(rows);
    const slugs = rows.map((r) => r.slug);
    expect(titles).toEqual(["Placeholder Work One", "Placeholder Work Three"]);
    expect(works.filter((w) => slugs.includes(w.slug)).map((w) => w.title)).toEqual(titles);
    expect(renderToStaticMarkup(<SpineNotes noted={slugs.includes("one")} slug="one" />)).toBe(" You have notes in it.");
    expect(renderToStaticMarkup(<SpineNotes noted={slugs.includes("two")} slug="two" />)).toBe("");
    const store = readFileSync("lib/ledgerStore.ts", "utf8");
    const body = (name: string) => store.slice(store.indexOf(`export async function ${name}`), store.indexOf("\n}\n", store.indexOf(`export async function ${name}`)));
    for (const fn of ["myAnnotationTotals", "myNotedSlugs"]) {
      expect(body(fn)).toContain('supabase.from("notes").select("work_id").eq("reader_id", auth.user.id)');
      expect(body(fn)).toContain('supabase.from("highlights").select("work_id").eq("reader_id", auth.user.id)');
    }
  });
});
