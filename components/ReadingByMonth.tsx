import { formatHours, type MonthRow } from "@/lib/ledger";

// Twelve timber posts along the ledger page: how long you read each month.
export function ReadingByMonth({ months }: { months: MonthRow[] }) {
  const max = Math.max(...months.map((m) => m.activeMs), 1);
  return (
    <section aria-labelledby="by-month" className="mt-12">
      <h2 id="by-month" className="text-xl text-paper">Reading by month</h2>
      <p className="font-sans text-xs text-sandstone">The last twelve months, in South African time.</p>
      <ol className="mt-4 flex h-40 items-end gap-1 border-b border-timber pb-0 sm:gap-2">
        {months.map((m) => {
          const pct = m.activeMs > 0 ? Math.max(4, Math.round((m.activeMs / max) * 100)) : 0;
          return (
            <li key={m.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${m.long}: ${m.activeMs > 0 ? formatHours(m.activeMs) : "no reading"}`}>
              <span className="sr-only">{m.long}: {m.activeMs > 0 ? formatHours(m.activeMs) : "no reading"}</span>
              <span aria-hidden="true" style={{ height: `${pct}%` }} className="w-full max-w-8 rounded-t-sm bg-gradient-to-t from-timber to-ochre" />
            </li>
          );
        })}
      </ol>
      <ol aria-hidden="true" className="mt-1 flex gap-1 font-sans text-[0.6rem] uppercase text-sandstone sm:gap-2">
        {months.map((m, i) => <li key={m.key} className="min-w-0 flex-1 text-center"><span className={(months.length - 1 - i) % 2 ? "invisible sm:visible" : ""}>{m.short}</span></li>)}
      </ol>
    </section>
  );
}
