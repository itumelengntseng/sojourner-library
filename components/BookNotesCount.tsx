"use client";
import { useEffect, useState } from "react";
import { previewBookCount, shortNotesLine, type AnnotationCount } from "@/lib/notesCount";

/** C186: " · 2 notes · 1 highlight" after a book's time in Hours per book — server counts (library) or this browser's (preview). */
export function BookNotesCount({ counts, slug, positions = [] }: { counts?: AnnotationCount | null; slug?: string; positions?: number[] }) {
  const [local, setLocal] = useState<AnnotationCount | undefined>(undefined);
  const key = positions.join(",");
  useEffect(() => {
    if (counts !== null || !slug) return;
    setLocal(previewBookCount(slug, key ? key.split(",").map(Number) : [], (k) => { try { return window.localStorage.getItem(k); } catch { return null; } }));
  }, [counts, slug, key]);
  const line = shortNotesLine(counts ?? local);
  return line ? <span className="text-sandstone">{line}</span> : null;
}
