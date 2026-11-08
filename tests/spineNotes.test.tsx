import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SpineNotes } from "@/components/SpineNotes";
import { SPINE_NOTES } from "@/lib/spine";

// C208: a halls spine says, to screen readers only, that the book holds the reader's notes.
describe("halls spine notes (C208)", () => {
  it("says it for a noted book, nothing otherwise (library answer)", () => {
    expect(SPINE_NOTES).toBe(" You have notes in it.");
    expect(renderToStaticMarkup(<SpineNotes noted slug="w" />)).toBe(" You have notes in it.");
    expect(renderToStaticMarkup(<SpineNotes noted={false} slug="w" />)).toBe("");
    // Preview: counted in the browser after load, so the server render is silent.
    expect(renderToStaticMarkup(<SpineNotes noted={null} slug="w" positions={[1, 2]} />)).toBe("");
  });
  it("the halls put it inside the spine's spoken label, after the rest", () => {
    const halls = readFileSync("app/halls/page.tsx", "utf8");
    const sr = halls.slice(halls.indexOf('<span className="sr-only">\n                            {spokenSpine('));
    expect(sr.indexOf("<SpineNotes")).toBeGreaterThan(0);
    expect(sr.indexOf("<SpineNotes")).toBeLessThan(sr.indexOf("</span>"));
    expect(halls).toContain("<SpineNotes noted={notedSlugs === null ? null : notedSlugs.includes(w.slug)}");
  });
  it("library mode reads only the reader's own notes and highlights", () => {
    const store = readFileSync("lib/ledgerStore.ts", "utf8");
    const fn = store.slice(store.indexOf("export async function myNotedSlugs"), store.indexOf("\n}\n", store.indexOf("export async function myNotedSlugs")));
    expect(fn.match(/\.eq\("reader_id", auth\.user\.id\)/g)).toHaveLength(2);
  });
});
