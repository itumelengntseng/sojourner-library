// C27: the Keeper's backup copy of a work as Markdown, in the same shape the Writer's Room import
// reads ("# Title", "## Chapter"), so a backup can be shelved again unchanged. Reads only; never deletes.
import { parseManuscript } from "./manuscript";

export interface ExportChapter { position: number; title: string; body: string; archived: boolean }
export interface ExportWork { title: string; slug: string; author: string; chapters: ExportChapter[] }

/** Front matter is stripped by the importer, so the author and date travel without becoming text. */
export function manuscriptMarkdown(w: ExportWork, part: "shelved" | "set-aside", exportedAt: Date): string {
  const chapters = w.chapters.filter((c) => (part === "set-aside" ? c.archived : !c.archived)).sort((a, b) => a.position - b.position);
  const title = part === "set-aside" ? `${w.title} — chapters set aside` : w.title;
  const front = [
    "---",
    `title: ${JSON.stringify(w.title)}`,
    `author: ${JSON.stringify(w.author || "Itumeleng Ntseng")}`,
    `exported: ${exportedAt.toISOString()}`,
    `part: ${part}`,
    `chapters: ${chapters.length}`,
    "---",
  ].join("\n");
  const body = chapters.map((c) => `## ${c.title.replace(/\n/g, " ")}\n\n${c.body.trim()}\n`).join("\n");
  return `${front}\n# ${title}\n\n${body}`;
}

export function exportFilename(slug: string, part: "shelved" | "set-aside", exportedAt: Date): string {
  const day = exportedAt.toISOString().slice(0, 10);
  return `${slug.replace(/[^a-z0-9-]/g, "") || "work"}${part === "set-aside" ? "-set-aside" : ""}-${day}.md`;
}

/** True when re-importing the backup gives back the same chapter titles and bodies. */
export function roundTrips(w: ExportWork, md: string): boolean {
  const back = parseManuscript(md);
  const want = w.chapters.filter((c) => !c.archived).sort((a, b) => a.position - b.position);
  return back.title === w.title && back.chapters.length === want.length &&
    back.chapters.every((c, i) => c.title === want[i].title.replace(/\n/g, " ") && c.body === want[i].body.trim());
}
