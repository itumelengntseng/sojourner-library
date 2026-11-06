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
