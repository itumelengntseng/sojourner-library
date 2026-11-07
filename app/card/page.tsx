import { dueBackSoon } from "@/lib/loanDesk";
import type { Metadata } from "next";
import { MembershipCard } from "@/components/MembershipCard";
import { OnLoanNow } from "@/components/OnLoanNow";
import { myOpenLoans, myRecentlyReturned } from "@/lib/loanStore";
import { myBookLeft } from "@/lib/bookLeftStore";
import { RecentlyReturned } from "@/components/RecentlyReturned";
import { ContinueReading } from "@/components/ContinueReading";
import { myContinueBySlug, myContinueReading } from "@/lib/continueStore";
import { WeekLine } from "@/components/WeekLine";
import { FinishedLine } from "@/components/FinishedLine";
import { myFinishes, myFirstReads, myWeek, myFinishedCount } from "@/lib/ledgerStore";
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

/** "On loan now", each with the time left in the book at the reader's pace (C74). */
async function LoanShelf() {
  const [loans, continueAt] = await Promise.all([myOpenLoans(), myContinueBySlug()]);
  const bookLeft = await myBookLeft(loans);
  // C96: loans due back within the day — the same rule as the front hall's slip.
  const dueSoon = dueBackSoon(loans, Date.now()).map((l) => l.slug);
  return <OnLoanNow loans={loans} continueAt={continueAt} bookLeft={bookLeft} dueSoon={dueSoon} />;
}

// C37 + C95: the Continue reading card, with the time left in the book.
async function ContinueShelf() {
  const card = await myContinueReading();
  if (!card) return null;
  const bookLeft = await myBookLeft();
  return <ContinueReading card={card} className="w-full" bookLeft={bookLeft[card.slug]} />;
}

/** "Recently returned", with a Finished mark on books read to the end (C70). */
async function ReturnedShelf({ notes = "preview" }: { notes?: "library" | "preview" }) {
  const items = await myRecentlyReturned();
  if (items.length === 0) return null;
  const slugs = items.map((r) => r.slug);
  const [finished, firstRead] = await Promise.all([myFinishes(slugs), myFirstReads(slugs)]);
  return <RecentlyReturned items={items} finished={finished} notes={notes} firstRead={firstRead} />;
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
        <FinishedLine count={await myFinishedCount()} />
        <ContinueShelf />
        <LoanShelf />
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
      <FinishedLine count={await myFinishedCount()} />
      <ContinueShelf />
      <LoanShelf />
      <ReturnedShelf notes="library" />
      <PrefsForm name={card.display_name ?? ""} wpm={(card as ReaderCard & { wpm_override?: number | null }).wpm_override ?? null} />
      <form action={signOut}>
        <button className="font-sans text-sm text-sandstone underline underline-offset-4 hover:text-lamplight">Sign out</button>
      </form>
    </Desk>
  );
}
