"use client";
import { useEffect, useState } from "react";
import { previewBookCount } from "@/lib/notesCount";
import { SPINE_NOTES, SPINE_NOTES_LEGEND } from "@/lib/spine";

/**
 * C208: " You have notes in it." inside a halls spine's spoken label — only for a book holding the reader's own
 * notes or highlights (library: the server's answer; preview: this browser's). Nothing visible, so the shelf stays calm.
 */
export function SpineNotes({ noted, slug, positions = [] }: { noted: boolean | null; slug: string; positions?: number[] }) {
  const [local, setLocal] = useState(false);
  const key = positions.join(",");
  useEffect(() => {
    if (noted !== null) return;
    const c = previewBookCount(slug, key ? key.split(",").map(Number) : [], (k) => { try { return window.localStorage.getItem(k); } catch { return null; } });
    setLocal(c.notes + c.highlights > 0);
  }, [noted, slug, key]);
  return (noted ?? local) ? <>{SPINE_NOTES}</> : null;
}

/**
 * C213: the halls legend's spoken-only line once any book on the page holds the reader's notes
 * (library: the server's answer; preview: this browser's). Nothing visible.
 */
export function SpineNotesLegend({ noted, books }: { noted: boolean | null; books: { slug: string; positions: number[] }[] }) {
  const [local, setLocal] = useState(false);
  const key = books.map((b) => `${b.slug}:${b.positions.join(".")}`).join(",");
  useEffect(() => {
    if (noted !== null) return;
    const read = (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } };
    setLocal(books.some((b) => { const c = previewBookCount(b.slug, b.positions, read); return c.notes + c.highlights > 0; }));
  }, [noted, key]);
  return (noted ?? local) ? <p data-spine-notes-legend="" className="sr-only">{SPINE_NOTES_LEGEND}</p> : null;
}
