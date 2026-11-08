"use client";
import { useEffect, useState } from "react";
import { annotationLine, countAnnotations, totalAnnotations, type AnnotationCount } from "@/lib/notesCount";
import { getWorks } from "@/lib/catalogue";
import { PreviewNotesExport } from "./PreviewNotesExport";
import type { FinishInfo } from "@/lib/ledger";

/**
 * C43: "You have 2 margin notes and 1 highlight in this book" with the per-book notes download.
 * Library mode passes the counts (own rows only); preview mode counts what this browser holds.
 * C182: with notes in two or more books (`books` in library mode; counted here in preview), "· all your notes" → /ledger#export.
 */
export function YourNotes({ slug, title, positions, counts, finished, books = null }: { slug: string; title: string; positions: number[]; counts: AnnotationCount | null; finished?: FinishInfo; books?: number | null }) {
  const [local, setLocal] = useState<AnnotationCount | null>(null);
  const [localBooks, setLocalBooks] = useState(0);
  useEffect(() => {
    if (counts) return;
    const read = (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } };
    setLocal(countAnnotations(positions.map((p) => read(`soj:ann:${slug}:${p}`))));
    const byWork: Record<string, (string | null)[]> = {};
    for (const w of getWorks()) byWork[w.slug] = w.chapters.map((c) => read(`soj:ann:${w.slug}:${c.position}`));
    setLocalBooks(totalAnnotations(byWork).books);
  }, [counts, positions, slug]);
  const allNotes = (counts ? books ?? 0 : localBooks) >= 2;
  const line = annotationLine(counts ?? local ?? { notes: 0, highlights: 0 });
  if (!line) return null;
  return (
    <p className="mt-4 font-sans text-xs text-sandstone">
      You have {line} in this book ·{" "}
      {counts ? (
        <a href={`/ledger/notes?work=${encodeURIComponent(slug)}`} className="text-lamplight underline underline-offset-2">Notes for this book<span className="sr-only">: {title}</span></a>
      ) : <PreviewNotesExport slug={slug} title={title} finished={finished ? { [slug]: finished } : undefined} />}
      {allNotes && <> · <a href="/ledger#export" className="text-lamplight underline underline-offset-2">all your notes<span className="sr-only"> — in your ledger</span></a></>}
    </p>
  );
}
