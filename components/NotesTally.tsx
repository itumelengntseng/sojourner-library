"use client";
import { useEffect, useState } from "react";
import { getWorks } from "@/lib/catalogue";
import { notesAcrossLine, totalAnnotations, type AnnotationTotals } from "@/lib/notesCount";

/**
 * C179: "3 margin notes · 2 highlights across 2 books" above the ledger's export (own annotations only).
 * Library mode passes the totals; preview mode counts what this browser holds. Nothing when there are none.
 */
export function NotesTally({ totals }: { totals: AnnotationTotals | null }) {
  const [local, setLocal] = useState<AnnotationTotals | null>(null);
  useEffect(() => {
    if (totals) return;
    const read = (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } };
    const byWork: Record<string, (string | null)[]> = {};
    for (const w of getWorks()) byWork[w.slug] = w.chapters.map((c) => read(`soj:ann:${w.slug}:${c.position}`));
    setLocal(totalAnnotations(byWork));
  }, [totals]);
  const line = notesAcrossLine(totals ?? local ?? { notes: 0, highlights: 0, books: 0 });
  if (!line) return null;
  return <p className="mt-2 font-sans text-xs text-sandstone">You have {line}.</p>;
}
