import Link from "next/link";
import { AUTHOR } from "@/lib/site";
import { finishedStamp, finishSpan, type FinishInfo } from "@/lib/ledger";
import { PreviewNotesExport } from "./PreviewNotesExport";

// C41: a short shelf of the books you've read to the end, newest first.
// C85: each carries how long it took, from the reader's first session in it ("over 9 days").
// C89: and "Notes for this book" (own notes only) when its slug is known — library route or preview download.
// C92: and "Borrow again" (to the work page) for a book still on the shelves that isn't on loan to the reader now.
export function FinishedShelf({ items, title, href, slug = () => null, notes = "library", borrowAgain = () => null, finishInfo }: {
  items: { workKey: string; finishedAt: number; firstRead?: number }[];
  title: (k: string) => string;
  href: (k: string) => string | null;
  slug?: (k: string) => string | null;
  notes?: "library" | "preview";
  borrowAgain?: (k: string) => string | null;
  finishInfo?: Record<string, FinishInfo>;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="finished" className="mt-12">
      <h2 id="finished" className="text-xl text-paper">Read to the end</h2>
      <p className="font-sans text-xs text-sandstone">{items.length} book{items.length === 1 ? "" : "s"} by {AUTHOR}, newest first.</p>
      <ul className="mt-3 divide-y divide-timber-dark/70 border-y border-timber-dark/70">
        {items.map((f) => {
          const to = href(f.workKey);
          const when = new Date(f.finishedAt);
          const span = finishSpan(f.firstRead, f.finishedAt);
          const s = slug(f.workKey);
          const again = borrowAgain(f.workKey);
          return (
            <li key={f.workKey} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <span>
                {to ? <Link href={to} className="hover:text-lamplight">{title(f.workKey)}</Link> : <span>{title(f.workKey)}</span>}
                {span && <span className="ml-2 font-sans text-xs text-sandstone">· read {span}</span>}
                {(s || again) && (
                  <span className="flex flex-wrap gap-x-3">
                    {s && (notes === "preview" ? <PreviewNotesExport slug={s} title={title(f.workKey)} finished={finishInfo} /> : (
                      <a href={`/ledger/notes?work=${encodeURIComponent(s)}`} className="font-sans text-xs text-lamplight underline underline-offset-2">Notes for this book<span className="sr-only">: {title(f.workKey)}</span></a>
                    ))}
                    {again && <Link href={again} className="font-sans text-xs text-lamplight underline underline-offset-2">Borrow again<span className="sr-only">: {title(f.workKey)}</span></Link>}
                  </span>
                )}
              </span>
              <time dateTime={when.toISOString()} className="inline-block -rotate-2 rounded-sm border border-lamplight/70 px-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-lamplight">
                {finishedStamp(f.finishedAt)}
              </time>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
