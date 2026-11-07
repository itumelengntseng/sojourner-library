"use client";
import { useEffect, useState } from "react";
import { annotationLine, countAnnotations, type AnnotationCount } from "@/lib/notesCount";
import { PreviewNotesExport } from "./PreviewNotesExport";
import type { FinishInfo } from "@/lib/ledger";

/**
 * C43: "You have 2 margin notes and 1 highlight in this book" with the per-book notes download.
 * Library mode passes the counts (own rows only); preview mode counts what this browser holds.
 */
export function YourNotes({ slug, title, positions, counts, finished }: { slug: string; title: string; positions: number[]; counts: AnnotationCount | null; finished?: FinishInfo }) {
  const [local, setLocal] = useState<AnnotationCount | null>(null);
  useEffect(() => {
    if (counts) return;
    const read = (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } };
    setLocal(countAnnotations(positions.map((p) => read(`soj:ann:${slug}:${p}`))));
  }, [counts, positions, slug]);
  const line = annotationLine(counts ?? local ?? { notes: 0, highlights: 0 });
  if (!line) return null;
  return (
    <p className="mt-4 font-sans text-xs text-sandstone">
      You have {line} in this book ·{" "}
      {counts ? (
        <a href={`/ledger/notes?work=${encodeURIComponent(slug)}`} className="text-lamplight underline underline-offset-2">Notes for this book<span className="sr-only">: {title}</span></a>
      ) : <PreviewNotesExport slug={slug} title={title} finished={finished ? { [slug]: finished } : undefined} />}
    </p>
  );
}
