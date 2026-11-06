"use client";

import { useId, useState } from "react";
import { ask } from "@/lib/engine/ask";
import { SUGGESTED_QUESTIONS, toReaderContext, type LibrarianFacts } from "@/lib/librarian";

interface Exchange { q: string; a: string }

// A small desk with a brass bell: ask in plain words, get a written reply slip.
export function AskLibrarian({ facts, title }: { facts: LibrarianFacts; title: string }) {
  const [question, setQuestion] = useState("");
  const [log, setLog] = useState<Exchange[]>([]);
  const id = useId();

  const put = (q: string) => {
    const clean = q.trim().slice(0, 200);
    if (!clean) return;
    const a = ask(clean, toReaderContext(facts, new Date())).text;
    setLog((l) => [{ q: clean, a }, ...l].slice(0, 3));
    setQuestion("");
  };

  return (
    <section aria-labelledby={`${id}-h`} className="rounded-sm border border-timber-dark bg-ink/40 p-5">
      <h2 id={`${id}-h`} className="flex items-center gap-2 text-xl text-paper">
        <span aria-hidden="true" className="inline-block h-3 w-4 rounded-t-full bg-lamplight shadow-[0_2px_0_#6b4428]" />
        Ask the librarian
      </h2>
      <p className="mt-1 font-sans text-xs text-sandstone/80">
        About <span className="italic">{title}</span>, at your pace of {facts.wpm} wpm
        {facts.wordsRead > 0 ? ", from your bookmark" : ""}.
      </p>
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => { e.preventDefault(); put(question); }}
      >
        <label htmlFor={`${id}-q`} className="sr-only">Your question</label>
        <input
          id={`${id}-q`} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200}
          placeholder="Can I finish by Sunday?"
          className="flex-1 rounded border border-sandstone/40 bg-ink/60 px-3 py-2 font-sans text-paper placeholder:text-sandstone/50"
        />
        <button type="submit" className="rounded bg-lamplight px-4 py-2 font-sans text-sm font-semibold text-ink hover:bg-ember">Ring the bell</button>
      </form>
      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Questions the librarian knows">
        {SUGGESTED_QUESTIONS.map((q) => (
          <li key={q}>
            <button type="button" onClick={() => put(q)}
              className="rounded-full border border-sandstone/40 px-3 py-1 font-sans text-xs text-sandstone hover:border-lamplight hover:text-lamplight">
              {q}
            </button>
          </li>
        ))}
      </ul>
      <div aria-live="polite" className="mt-4 flex flex-col gap-3">
        {log.map((x, i) => (
          <figure key={`${log.length - i}`} className={`rounded-sm bg-paper px-4 py-3 text-ink ${i > 0 ? "opacity-60" : ""}`}>
            <figcaption className="font-sans text-[0.7rem] uppercase tracking-wider text-timber">You asked: {x.q}</figcaption>
            <p className="mt-1">{x.a}</p>
          </figure>
        ))}
      </div>
    </section>
  );
}
