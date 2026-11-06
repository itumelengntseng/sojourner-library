// Turns Supabase `works` + `chapters` rows into shelf entries. Pure, so it is tested
// without a database. Chapter text is never read here — the shelf only needs titles
// and stored word counts; the words themselves stay behind the loan desk (RLS).
import { HALLS, type CanonStatus, type Hall, type Work } from "./catalogue";
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
  description?: string | null;
  updated_at?: string | null;
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
      blurb: w.description?.trim() || (w.is_placeholder ? "Placeholder description. The real description will come from the author." : NO_BLURB),
      chapters: (byWork.get(w.id) ?? [])
        .sort((a, b) => a.position - b.position)
        .map((c) => ({ position: c.position, title: c.title, body: "", words: Math.max(0, c.word_count ?? 0) })),
      ...(w.updated_at && Number.isFinite(Date.parse(w.updated_at)) ? { updatedAt: Date.parse(w.updated_at) } : {}),
      _order: [w.series ?? "", w.series_order ?? 0, w.title] as const,
    }))
    .sort((a, b) => a._order[0].localeCompare(b._order[0]) || a._order[1] - b._order[1] || a._order[2].localeCompare(b._order[2]))
    .map(({ _order, ...w }) => w);
}

export interface HallRow { id: string; name: string; note: string | null; position: number | null }

/** The library's halls in order; the placeholder list until the author names any. */
export function hallsFromRows(rows: HallRow[]): Hall[] {
  if (rows.length === 0) return [...HALLS];
  return [...rows]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name))
    .map((r) => ({ id: r.id, name: r.name.trim(), note: (r.note ?? "").trim() }));
}

export type HallCheck = { ok: true; name: string; note: string; position: number } | { ok: false; message: string };

export function checkHall(name: unknown, note: unknown, position: unknown = 0): HallCheck {
  const n = String(name ?? "").replace(/\s+/g, " ").trim();
  const t = String(note ?? "").replace(/\s+/g, " ").trim();
  const p = Number.parseInt(String(position ?? "0"), 10);
  if (!n) return { ok: false, message: "Give the hall a name." };
  if (n.length > 80) return { ok: false, message: "Keep the hall's name under 80 characters." };
  if (t.length > 300) return { ok: false, message: "Keep the note under 300 characters." };
  return { ok: true, name: n, note: t, position: Number.isFinite(p) ? Math.max(0, Math.min(999, p)) : 0 };
}

/** The few works most recently shelved or changed, newest first (only those with a date). */
export function freshOnShelves(works: Work[], now: number, opts: { limit?: number; days?: number } = {}): Work[] {
  const { limit = 3, days = 60 } = opts;
  const since = now - days * 86_400_000;
  return works
    .filter((w) => w.updatedAt !== undefined && w.updatedAt >= since && w.updatedAt <= now + 60_000)
    .sort((a, b) => b.updatedAt! - a.updatedAt!)
    .slice(0, limit);
}
