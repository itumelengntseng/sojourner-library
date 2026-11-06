"use server";

import { addHighlight, addNote, removeAnnotation, saveBookmark } from "@/lib/readingRoom";
import type { Highlight, MarginNote } from "@/lib/reader";

export async function bookmarkAction(slug: string, position: number, wordOffset: number): Promise<boolean> {
  return saveBookmark(slug, position, wordOffset);
}

export async function noteAction(slug: string, position: number, anchor: number, body: string): Promise<MarginNote | null> {
  return addNote(slug, position, anchor, body);
}

export async function highlightAction(slug: string, position: number, start: number, end: number, colour: string): Promise<Highlight | null> {
  return addHighlight(slug, position, start, end, colour);
}

export async function removeAction(kind: "notes" | "highlights", id: string): Promise<boolean> {
  if (kind !== "notes" && kind !== "highlights") return false;
  return removeAnnotation(kind, id);
}
