import "server-only";
// Where the shelves come from. Library mode (Supabase connected): the `works` and
// `chapters` tables, filtered by RLS to what this reader may see — so Writer's Room
// imports appear on the shelves. Preview mode: the static placeholder catalogue.
import { cache } from "react";
import { getWorks, HALLS, type Hall, type Work } from "./catalogue";
import { hallsFromRows, type HallRow } from "./catalogueRows";
import { worksFromRows, type ChapterRow, type WorkRow } from "./catalogueRows";
import { supabaseServer } from "./supabase/server";

export interface Catalogue {
  mode: "preview" | "library";
  /** Library mode only: false when nobody is signed in (RLS then shows nothing). */
  signedIn: boolean;
  works: Work[];
  /** Named halls: the library's own, or the placeholder list. */
  halls: Hall[];
}

export const loadCatalogue = cache(async (): Promise<Catalogue> => {
  const supabase = await supabaseServer();
  if (!supabase) return { mode: "preview", signedIn: false, works: getWorks(), halls: [...HALLS] };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { mode: "library", signedIn: false, works: [], halls: [...HALLS] };
  const { data: works } = await supabase.from("works")
    .select("id, slug, title, author, hall, series, series_order, canon_status, is_placeholder, description, archived_at")
    .is("archived_at", null);
  const rows = (works ?? []) as WorkRow[];
  const { data: hallRows } = await supabase.from("halls").select("id, name, note, position");
  const halls = hallsFromRows((hallRows ?? []) as HallRow[]);
  if (rows.length === 0) return { mode: "library", signedIn: true, works: [], halls };
  const { data: chapters } = await supabase.from("chapters")
    .select("work_id, position, title, word_count, archived_at")
    .in("work_id", rows.map((w) => w.id))
    .is("archived_at", null);
  return { mode: "library", signedIn: true, works: worksFromRows(rows, (chapters ?? []) as ChapterRow[]), halls };
});

export async function findWork(slug: string): Promise<Work | undefined> {
  return (await loadCatalogue()).works.find((w) => w.slug === slug);
}
