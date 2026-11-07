import Link from "next/link";
import { justReturned, type Returned } from "@/lib/loanDesk";
import { finishedStamp, finishSpan } from "@/lib/ledger";
import { PreviewNotesExport } from "./PreviewNotesExport";

/**
 * The reader's last few returns at the front desk, stamped, with a way to borrow again. Nothing returned → nothing shown.
 * `finished` (slug → time, C70) marks the books the reader read to the end.
 * C84: a finished book also offers "Notes for this book" — the ledger's per-book export (own notes only):
 * the library route in library mode, built in this browser in preview mode.
 * C93: the Finished mark adds how long it took, from `firstRead` (slug → the reader's first session in it).
 * C124: a book handed back within the last hour reads "Just returned"; the stamp stays in its spoken label.
 */
export function RecentlyReturned({ items, finished = {}, notes = "preview", firstRead = {}, now }: { items: Returned[]; finished?: Record<string, number>; notes?: "library" | "preview"; firstRead?: Record<string, number>; now?: number }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="recently-returned" className="w-full max-w-md text-left">
      {/* C126: with two or more lines the heading carries the count (as C116/C119). */}
      <h2 id="recently-returned" className="font-sans text-xs uppercase tracking-[0.25em] text-sandstone">Recently returned{items.length > 1 ? ` · ${items.length}` : ""}</h2>
      <ul className="mt-2 divide-y divide-timber-dark/60 rounded-sm border border-timber-dark bg-ink/40">
        {items.map((r) => (
          <li key={r.workKey} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="text-paper">
                {r.title}
                {finished[r.slug] !== undefined && (
                  <span className="ml-2 inline-block -rotate-2 rounded-sm border border-ochre px-1.5 py-0.5 align-middle font-mono text-[0.65rem] uppercase tracking-wider text-lamplight">
                    {finishedStamp(finished[r.slug])}
                  </span>
                )}
                {finished[r.slug] !== undefined && finishSpan(firstRead[r.slug], finished[r.slug]) && (
                  <span className="ml-2 font-sans text-xs text-sandstone">· read {finishSpan(firstRead[r.slug], finished[r.slug])}</span>
                )}
              </p>
              <p className="font-mono text-[0.7rem] uppercase tracking-wider text-sandstone">
                Out {r.borrowed} · {now !== undefined && justReturned(r, now)
                  ? <><span aria-hidden="true" className="text-lamplight">Just returned</span><span className="sr-only">Just returned, {r.returned}</span></>
                  : <>{r.onTime ? "returned" : "back on the shelf when due"} {r.returned}</>}
              </p>
              {finished[r.slug] !== undefined && (
                <p className="mt-0.5">
                  {notes === "library" ? (
                    <a href={`/ledger/notes?work=${encodeURIComponent(r.slug)}`} className="font-sans text-xs text-lamplight underline underline-offset-2">Notes for this book<span className="sr-only">: {r.title}</span></a>
                  ) : <PreviewNotesExport slug={r.slug} title={r.title} finished={{ [r.slug]: { at: finished[r.slug], firstRead: firstRead[r.slug] } }} />}
                </p>
              )}
            </div>
            <Link href={`/works/${r.slug}`} className="rounded border border-timber px-3 py-1.5 font-sans text-xs font-semibold text-paper hover:border-ochre hover:text-lamplight">
              Borrow again<span className="sr-only">: {r.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
