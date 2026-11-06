/** C28: small marks beside a chapter on the work page — read through (own sessions) and where the bookmark is. */
export function ChapterMarks({ read, here }: { read: boolean; here: boolean }) {
  if (!read && !here) return null;
  return (
    <>
      {read && (
        <span className="ml-2 inline-block rounded-sm border border-ochre/60 px-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-lamplight">
          <span aria-hidden="true">✓ </span>read
        </span>
      )}
      {here && (
        <span className="ml-2 inline-block rounded-sm bg-timber px-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-paper">
          your bookmark
        </span>
      )}
    </>
  );
}
