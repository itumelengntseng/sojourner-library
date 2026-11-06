import type { Metadata } from "next";
import Link from "next/link";
import { InviteForm, ManuscriptImport, RevokeInvite, WorkSettings } from "@/components/WritersRoomForms";
import { CANON_LABEL, formatWords } from "@/lib/workStats";
import { AUTHOR } from "@/lib/site";
import { loadRoom } from "@/lib/writersRoom";

export const metadata: Metadata = { title: "Writer's Room" };

// Behind the stacks: a timber table under one lamp, where the Keeper shelves new work.
export default async function WritersRoom() {
  const room = await loadRoom();
  if (room.mode === "closed") {
    return (
      <main id="main" className="mx-auto max-w-xl px-4 pt-24 text-center">
        <h1 className="text-2xl text-lamplight">The Writer&apos;s Room</h1>
        <p className="mt-4">{room.reason === "signed-out" ? "Show your card at the front desk first." : "This room is kept for the Keeper of the Library."}</p>
        <Link href="/" className="mt-6 inline-block font-sans text-sm text-lamplight underline">Back to the front hall</Link>
      </main>
    );
  }
  const live = room.mode === "library";
  return (
    <main id="main" className="mx-auto max-w-5xl px-4 pt-16">
      <nav className="font-sans text-xs text-sandstone"><Link href="/" className="hover:text-lamplight">Front hall</Link> / Writer&apos;s Room</nav>
      <h1 className="mt-6 text-3xl text-lamplight sm:text-4xl">The Writer&apos;s Room</h1>
      <p className="mt-1 font-sans text-sm text-sandstone">For {AUTHOR}: shelve manuscripts, decide who reads them, and issue reader cards.</p>
      {!live && <p className="mt-4 rounded-sm border border-ember/50 px-3 py-2 font-sans text-xs text-ember">Preview: the library isn&apos;t connected yet, so nothing here is saved. You can still try an import to see how a manuscript splits into chapters.</p>}

      <section aria-labelledby="import" className="mt-10 rounded-sm border border-timber-dark bg-stone-floor/60 p-5">
        <h2 id="import" className="text-xl text-paper">Shelve a manuscript</h2>
        <p className="mt-1 font-sans text-xs text-sandstone">Markdown, with each chapter starting &quot;## Chapter title&quot; (or &quot;# &quot; if there&apos;s no book title line). Re-importing the same title updates it; chapters are never deleted, only set aside.</p>
        <div className="threshold my-4 opacity-60" aria-hidden="true" />
        <ManuscriptImport canSave={live} />
      </section>

      <section aria-labelledby="shelves" className="mt-10">
        <h2 id="shelves" className="text-xl text-paper">On the shelves</h2>
        <ul className="mt-4 divide-y divide-timber-dark/70 border-y border-timber-dark/70">
          {room.works.map((w) => (
            <li key={w.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link href={`/works/${w.slug}`} className="hover:text-lamplight">{w.title}</Link>
                <p className="font-sans text-xs text-sandstone">
                  {CANON_LABEL[w.canonStatus]}{w.isPlaceholder ? " · placeholder" : ""}{live ? ` · ${formatWords(w.words)} · ${w.readers} reader${w.readers === 1 ? "" : "s"}, ${w.openLoans} on loan now, ${w.minutes} min read` : ""}
                </p>
              </div>
              {live ? <WorkSettings id={w.id} visibility={w.visibility} canon={w.canonStatus} /> : <span className="font-sans text-xs text-sandstone">Settings open once connected</span>}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="invites" className="mt-10 rounded-sm border border-timber-dark bg-ink/40 p-5">
        <h2 id="invites" className="text-xl text-paper">Reader cards</h2>
        {live ? (
          <>
            <div className="mt-4"><InviteForm /></div>
            <ul className="mt-6 divide-y divide-timber-dark/70 font-sans text-sm">
              {room.invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{i.note || "Guest"}</span>
                  <span className="text-xs text-sandstone">
                    {i.redeemed ? "card issued" : i.revoked ? "revoked" : new Date(i.expiresAt) < new Date() ? "expired" : <>open until {new Date(i.expiresAt).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg" })} · <RevokeInvite id={i.id} /></>}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : <p className="mt-2 font-sans text-sm text-sandstone">Invites can be issued once the library is connected.</p>}
      </section>
    </main>
  );
}
