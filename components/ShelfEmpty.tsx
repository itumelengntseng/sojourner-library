import Link from "next/link";
import type { Catalogue } from "@/lib/catalogueServer";

/** Shown when the shelves come back empty: either nobody has shown a card yet, or nothing is shared. */
export function ShelfEmpty({ catalogue }: { catalogue: Pick<Catalogue, "mode" | "signedIn"> }) {
  if (catalogue.mode === "library" && !catalogue.signedIn) {
    return (
      <p className="mx-auto mt-8 max-w-prose rounded-sm border border-sandstone/40 px-4 py-3 text-center font-sans text-sm text-paper/90">
        The shelves are lit for card holders. <Link href="/card" className="text-lamplight underline underline-offset-2">Show your card at the front desk</Link> to see what&apos;s on them.
      </p>
    );
  }
  return (
    <p className="mx-auto mt-8 max-w-prose text-center font-sans text-sm text-sandstone">
      Nothing has been shelved for you yet.
    </p>
  );
}
