import Link from "next/link";
import { justReturned, type Returned } from "@/lib/loanDesk";

/**
 * C131: by the front-hall door, when no book is open to continue — the book the reader handed back
 * within the hour, with the way to borrow it again. One quiet lamplit line; nothing otherwise.
 */
export function JustReturnedNote({ items, now }: { items: Returned[]; now: number }) {
  const r = items.find((x) => justReturned(x, now));
  if (!r) return null;
  return (
    <p className="mx-auto mt-8 max-w-md text-center font-sans text-xs text-sandstone">
      <span aria-hidden="true" className="text-lamplight">Just returned</span><span className="sr-only">Just returned, {r.returned}:</span>{" "}
      <span className="text-paper">{r.title}</span> ·{" "}
      <Link href={`/works/${r.slug}#desk`} className="underline underline-offset-2 hover:text-lamplight">borrow it again<span className="sr-only">: {r.title}</span></Link>
    </p>
  );
}
