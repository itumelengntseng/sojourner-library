import Link from "next/link";
import { chapterLabel, type ContinueCard } from "@/lib/continueReading";

// C49: beside the loan desk's Open/Resume — where this reader left off in this one work.
// Same rules as the front hall's Continue reading card (own sessions; read-through chapters point on).
export function ContinueHere({ card }: { card: ContinueCard | null }) {
  if (!card) return null;
  return (
    <p className="font-sans text-sm text-paper/90">
      Continue at{" "}
      <Link href={card.href} className="text-lamplight underline underline-offset-4 hover:text-ember">{chapterLabel(card)}</Link>
      <span className="font-mono text-[0.7rem] uppercase tracking-wider text-sandstone"> · {card.left}</span>
    </p>
  );
}
