// "Your notes in this book" on the work page (C43): counts only — the text stays in the ledger export.
export interface AnnotationCount { notes: number; highlights: number }

/** Counts preview-mode annotations from the per-chapter localStorage values (damaged entries skipped). */
export function countAnnotations(raws: (string | null)[]): AnnotationCount {
  let notes = 0;
  let highlights = 0;
  for (const raw of raws) {
    if (!raw) continue;
    try {
      const v = JSON.parse(raw) as { notes?: unknown; highlights?: unknown };
      if (Array.isArray(v.notes)) notes += v.notes.length;
      if (Array.isArray(v.highlights)) highlights += v.highlights.length;
    } catch { /* skip damaged */ }
  }
  return { notes, highlights };
}

/** "2 notes and 1 highlight" — or null when there are none. */
export function annotationLine(c: AnnotationCount): string | null {
  const parts = [
    c.notes ? `${c.notes} margin note${c.notes === 1 ? "" : "s"}` : "",
    c.highlights ? `${c.highlights} highlight${c.highlights === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" and ") : null;
}

export interface AnnotationTotals extends AnnotationCount { books: number }

/** C179: the ledger's "3 margin notes · 2 highlights across 2 books" — or null when there are none. */
export function notesAcrossLine(t: AnnotationTotals): string | null {
  const parts = [
    t.notes ? `${t.notes} margin note${t.notes === 1 ? "" : "s"}` : "",
    t.highlights ? `${t.highlights} highlight${t.highlights === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  if (!parts.length) return null;
  return `${parts.join(" · ")} across ${t.books} book${t.books === 1 ? "" : "s"}`;
}

/** C179: totals over several works from per-chapter preview values (slug → raw values per chapter). */
export function totalAnnotations(byWork: Record<string, (string | null)[]>): AnnotationTotals {
  const out: AnnotationTotals = { notes: 0, highlights: 0, books: 0 };
  for (const raws of Object.values(byWork)) {
    const c = countAnnotations(raws);
    out.notes += c.notes;
    out.highlights += c.highlights;
    if (c.notes + c.highlights > 0) out.books += 1;
  }
  return out;
}

/** C183: this book's own notes and highlights as this browser holds them (preview mode). */
export function previewBookCount(slug: string, positions: number[], read: (k: string) => string | null): AnnotationCount {
  return countAnnotations(positions.map((p) => read(`soj:ann:${slug}:${p}`)));
}

/** C186: the short form beside a book's time in Hours per book — "· 2 notes · 1 highlight"; null when none. */
export function shortNotesLine(c: AnnotationCount | undefined): string | null {
  if (!c) return null;
  const parts = [c.notes ? `${c.notes} note${c.notes === 1 ? "" : "s"}` : "", c.highlights ? `${c.highlights} highlight${c.highlights === 1 ? "" : "s"}` : ""].filter(Boolean);
  return parts.length ? parts.map((p) => ` · ${p}`).join("") : null;
}

/** C187: the reading room's status after a margin note is saved — "Note saved · 3 in this book". */
export function noteSavedStatus(notesInBook: number | undefined): string {
  return notesInBook && notesInBook > 0 ? `Note saved · ${notesInBook} in this book` : "Note saved";
}
