// C218: "replace with your manuscript" — from a placeholder work on the Writer's Room shelf list
// straight to "Shelve a manuscript" with its title filled in. Nothing is replaced until Save, and
// the import plan (C21) then says exactly what saving will change.
import { slugify } from "@/lib/manuscript";

export interface ReplaceTarget { slug: string; title: string;
  /** false when the title would make a different web address — saving would then shelve a new work. */
  sameAddress: boolean }

/** The link on a placeholder work's line (a plain GET link — works without JavaScript). */
export function replaceHref(slug: string): string {
  return `/writers-room?replace=${encodeURIComponent(slug)}#import`;
}

/** The work named by `?replace=` — only a work on the shelves that is still marked Placeholder. */
export function replaceTarget(works: { slug: string; title: string; isPlaceholder: boolean }[], param: string | string[] | undefined): ReplaceTarget | null {
  const slug = typeof param === "string" ? param.trim() : "";
  if (!slug) return null;
  const w = works.find((x) => x.slug === slug && x.isPlaceholder);
  if (!w) return null;
  return { slug: w.slug, title: w.title, sameAddress: slugify(w.title) === w.slug };
}

/** The quiet line above the import form while a placeholder is being replaced. */
export function replaceNote(t: ReplaceTarget): string {
  return t.sameAddress
    ? `Replacing the placeholder “${t.title}”: load or paste your manuscript below. Nothing changes until you save, and the preview shows what will.`
    : `“${t.title}” has a web address its title doesn't make, so saving shelves a new work beside it; you can set the placeholder aside afterwards.`;
}
