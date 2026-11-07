import type { Metadata } from "next";
import { MembershipCard } from "@/components/MembershipCard";
import { OnLoanNow } from "@/components/OnLoanNow";
import { myOpenLoans, myRecentlyReturned } from "@/lib/loanStore";
import { RecentlyReturned } from "@/components/RecentlyReturned";
import { ContinueReading } from "@/components/ContinueReading";
import { myContinueBySlug, myContinueReading } from "@/lib/continueStore";
import { WeekLine } from "@/components/WeekLine";
import { myFinishes, myWeek } from "@/lib/ledgerStore";
import { supabaseServer } from "@/lib/supabase/server";
import type { ReaderCard } from "@/lib/membership";
import { signOut } from "./actions";
import { PrefsForm, RedeemForm, SignInForm } from "./forms";

export const metadata: Metadata = { title: "Front desk" };
export const dynamic = "force-dynamic";

function Desk({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <main id="main" className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 pt-20 text-center">
      <p className="font-sans text-xs uppercase tracking-[0.3em] text-sandstone">{eyebrow}</p>
      <h1 className="text-3xl text-lamplight sm:text-4xl">{title}</h1>
      <div className="threshold w-40" aria-hidden="true" />
      {children}
    </main>
  );
}

/** "Recently returned", with a Finished mark on books read to the end (C70). */
async function ReturnedShelf() {
  const items = await myRecentlyReturned();
  if (items.length === 0) return null;
  return <RecentlyReturned items={items} finished={await myFinishes(items.map((r) => r.slug))} />;
}

export default async function CardPage() {
  const supabase = await supabaseServer();
  if (!supabase) {
    return (
      <Desk eyebrow="Front desk" title="The desk is not yet staffed">
        <p className="max-w-prose text-paper/85">
          Reader cards will be issued here once the library&apos;s records room is connected.
        </p>
        <WeekLine week={await myWeek()} />
        <ContinueReading card={await myContinueReading()} className="w-full" />
        <OnLoanNow loans={await myOpenLoans()} continueAt={await myContinueBySlug()} />
        <ReturnedShelf />
      </Desk>
    );
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <Desk eyebrow="Front desk" title="Present yourself at the desk">
        <p className="max-w-prose text-paper/85">
          The Sojourner Library is by invitation. Leave your email and we&apos;ll send a link that lets you in — no password.
        </p>
        <SignInForm />
      </Desk>
    );
  }

  const { data: card } = await supabase.from("readers").select("*").eq("id", user.id).maybeSingle<ReaderCard>();
  if (!card) {
    return (
      <Desk eyebrow="Front desk" title="Your invitation, please">
        <p className="max-w-prose text-paper/85">
          You&apos;re signed in. To receive a reader card, enter the invite code you were given.
        </p>
        <RedeemForm />
      </Desk>
    );
  }

  return (
    <Desk eyebrow="Front desk" title="Welcome back">
      <MembershipCard card={card} />
      <WeekLine week={await myWeek()} />
      <ContinueReading card={await myContinueReading()} className="w-full" />
      <OnLoanNow loans={await myOpenLoans()} continueAt={await myContinueBySlug()} />
      <ReturnedShelf />
      <PrefsForm name={card.display_name ?? ""} wpm={(card as ReaderCard & { wpm_override?: number | null }).wpm_override ?? null} />
      <form action={signOut}>
        <button className="font-sans text-sm text-sandstone underline underline-offset-4 hover:text-lamplight">Sign out</button>
      </form>
    </Desk>
  );
}
