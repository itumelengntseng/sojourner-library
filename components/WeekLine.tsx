import Link from "next/link";
import { formatHours, type Week } from "@/lib/ledger";

// C60: one line at the front desk — this week's reading, and the way to the ledger.
export function WeekLine({ week }: { week: Week | null }) {
  if (!week) return null;
  return (
    <p className="w-full max-w-md text-left font-sans text-sm text-sandstone">
      {week.ms > 0
        ? <>This week: <span className="text-paper">{formatHours(week.ms)}</span>{week.days > 0 ? ` on ${week.days} ${week.days === 1 ? "day" : "days"}` : ""}</>
        : "Nothing read this week yet"}
      {" · "}<Link href="/ledger" className="text-lamplight underline underline-offset-2">Your ledger</Link>
    </p>
  );
}
