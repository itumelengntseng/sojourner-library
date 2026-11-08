"use client";
import { useEffect, useState } from "react";
import { previewBookCount } from "@/lib/notesCount";
import { SPINE_NOTES } from "@/lib/spine";

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
