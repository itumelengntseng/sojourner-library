// Turns Supabase `works` + `chapters` rows into shelf entries. Pure, so it is tested
// without a database. Chapter text is never read here — the shelf only needs titles
// and stored word counts; the words themselves stay behind the loan desk (RLS).
import type { CanonStatus, Work } from "./catalogue";
import { AUTHOR } from "./site";

export interface WorkRow {
  id: string;
  slug: string;
  title: string;
  author: string | null;
  hall: string | null;
  series: string | null;
  series_order?: number | null;
  canon_status: string;
  is_placeholder: boolean;
  archived_at?: string | null;
}

export interface ChapterRow {
  work_id: string;
  position: number;
  title: string;
  word_count: number | null;
  archived_at?: string | null;
}

export const NO_BLURB = "The author hasn't written a description for this work yet.";

const STATUSES: CanonStatus[] = ["canon", "draft", "apocrypha"];

/** Authorship always shows Itumeleng Ntseng, even if a row were somehow missing it. */
export function withAuthor(author: string | null | undefined): string {
  const a = (author ?? "").trim();
  return a.includes(AUTHOR) ? a : AUTHOR;
}

export function worksFromRows(works: WorkRow[], chapters: ChapterRow[]): Work[] {
  const byWork = new Map<string, ChapterRow[]>();
  for (const c of chapters) {
    if (c.archived_at) continue;
    const list = byWork.get(c.work_id) ?? [];
    list.push(c);
    byWork.set(c.work_id, list);
  }
  return works
    .filter((w) => !w.archived_at)
    .map((w) => ({
      slug: w.slug,
      title: w.title,
      author: withAuthor(w.author),
      hall: w.hall?.trim() || "main",
      series: w.series,
      canonStatus: (STATUSES.includes(w.canon_status as CanonStatus) ? w.canon_status : "draft") as CanonStatus,
      isPlaceholder: w.is_placeholder,
      blurb: w.is_placeholder ? "Placeholder description. The real description will come from the author." : NO_BLURB,
      chapters: (byWork.get(w.id) ?? [])
        .sort((a, b) => a.position - b.position)
        .map((c) => ({ position: c.position, title: c.title, body: "", words: Math.max(0, c.word_count ?? 0) })),
      _order: [w.series ?? "", w.series_order ?? 0, w.title] as const,
    }))
    .sort((a, b) => a._order[0].localeCompare(b._order[0]) || a._order[1] - b._order[1] || a._order[2].localeCompare(b._order[2]))
    .map(({ _order, ...w }) => w);
}
