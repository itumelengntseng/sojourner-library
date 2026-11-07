import { AUTHOR } from "@/lib/site";
import type { Slip } from "@/lib/loanDesk";

// The date-due slip glued inside the back cover: ruled paper, inked stamps.
export function DueDateSlip({ slip, title }: { slip: Slip; title: string }) {
  const tone =
    slip.status === "due_soon" ? "text-ember" :
    slip.status === "active" ? "text-timber" : "text-ink/60";
  const stamps: { label: string; value: string }[] = [
    { label: "Borrowed", value: slip.borrowed },
    ...(slip.renewals > 0 ? [{ label: "Renewed", value: `${slip.renewals}×` }] : []),
    { label: slip.returned ? "Was due" : "Due back", value: slip.due },
    ...(slip.returned ? [{ label: "Returned", value: slip.returned }] : []),
  ];
  return (
    <article
      aria-label={`Date-due slip for ${title}`}
      className="relative w-full max-w-xs rounded-sm border border-timber/40 bg-paper px-5 pb-4 pt-3 text-ink shadow-[0_14px_30px_-14px_rgb(0_0_0/0.8)]"
    >
      <p className="text-center font-sans text-[0.6rem] uppercase tracking-[0.35em] text-timber">Date due</p>
      <p className="mt-1 truncate text-center text-sm">{title}</p>
      <p className="text-center font-sans text-[0.6rem] uppercase tracking-wider text-timber">{AUTHOR}</p>
      <dl className="mt-3 border-t border-timber/30 bg-[repeating-linear-gradient(180deg,transparent_0_27px,rgb(107_68_40/0.18)_27px_28px)]">
        {stamps.map((s) => (
          <div key={s.label} className="flex h-7 items-center justify-between gap-3">
            <dt className="font-sans text-[0.65rem] uppercase tracking-wider text-timber">{s.label}</dt>
            <dd className="-rotate-2 font-mono text-[0.8rem] tracking-wide text-ochre">{s.value}</dd>
          </div>
        ))}
      </dl>
      <p role="status" className={`mt-3 font-sans text-sm font-semibold ${tone}`}>
        {slip.headline}
        {slip.timeLeft && <span className="font-normal"> · {slip.timeLeft} left</span>}
      </p>
      {/* C107: the last hour of a loan is called out on the slip itself. */}
      {slip.withinHour && <p className="font-sans text-xs font-semibold text-[#8a4a12]">Due back within the hour</p>}
      {slip.canRenew || slip.canReturn ? (
        <p className="font-sans text-[0.7rem] text-ink/70">
          {slip.renewalsLeft > 0 ? `${slip.renewalsLeft} renewal${slip.renewalsLeft === 1 ? "" : "s"} left` : "No renewals left"}
        </p>
      ) : (
        <p className="font-sans text-[0.7rem] text-ink/70">Your bookmark is kept for next time.</p>
      )}
    </article>
  );
}
