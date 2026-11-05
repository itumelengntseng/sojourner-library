import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 pt-24 text-center">
      <p className="font-sans text-xs uppercase tracking-[0.3em] text-sandstone">An empty space on the shelf</p>
      <h1 className="text-3xl text-lamplight">Not on the shelves</h1>
      <p className="text-paper/85">Whatever stood here has been moved, or was never catalogued.</p>
      <Link href="/halls" className="font-sans text-sm text-lamplight underline underline-offset-4">Back to the halls</Link>
    </main>
  );
}
