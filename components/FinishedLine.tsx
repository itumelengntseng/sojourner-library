import Link from "next/link";
import { FINISHED_SHELF } from "@/lib/ledger";

// C88: one line at the front desk — how many books the reader has read to the end, leading to that shelf.
export function FinishedLine({ count }: { count: number }) {
  if (!(count > 0)) return null;
  return (
    <p className="w-full max-w-md text-left font-sans text-sm text-sandstone">
      <span className="text-paper">{count}</span> {count === 1 ? "book" : "books"} read to the end
      {" · "}<Link href={FINISHED_SHELF} className="text-lamplight underline underline-offset-2">Read to the end</Link>
    </p>
  );
}
