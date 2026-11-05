import { AUTHOR, SITE_NAME } from "@/lib/site";
import { formatCardNumber, issuedOn, roleLabel, type ReaderCard } from "@/lib/membership";

// A reader's card, like a stamped library card on timber and paper.
export function MembershipCard({ card }: { card: ReaderCard }) {
  return (
    <article
      aria-label="Your reader card"
      className="relative w-full max-w-sm overflow-hidden rounded-md border border-timber-dark bg-paper text-ink shadow-[0_18px_40px_-12px_rgb(0_0_0/0.7)]"
    >
      <div className="bg-timber px-5 py-3 text-paper">
        <p className="font-sans text-[0.65rem] uppercase tracking-[0.3em] text-lamplight">Reader card</p>
        <p className="text-lg">{SITE_NAME}</p>
      </div>
      <div className="threshold opacity-70" aria-hidden="true" />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-5 py-4 text-sm">
        <dt className="font-sans text-xs uppercase tracking-wider text-timber">Name</dt>
        <dd>{card.display_name || "Unnamed reader"}</dd>
        <dt className="font-sans text-xs uppercase tracking-wider text-timber">Standing</dt>
        <dd>{roleLabel(card.role)}</dd>
        <dt className="font-sans text-xs uppercase tracking-wider text-timber">Card no.</dt>
        <dd className="font-mono tracking-widest">{formatCardNumber(card.card_number)}</dd>
        <dt className="font-sans text-xs uppercase tracking-wider text-timber">Issued</dt>
        <dd>{issuedOn(card.created_at)}</dd>
      </dl>
      <p className="border-t border-timber/30 px-5 py-2 font-sans text-[0.7rem] text-timber">
        Admits the bearer to the works of {AUTHOR}.
      </p>
    </article>
  );
}
