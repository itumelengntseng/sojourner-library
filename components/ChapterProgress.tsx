/** C32: how far through this chapter the reader has read (paragraphs read past), as a thin timber rule. */
export function chapterPercent(wordsBehind: number, chapterWords: number): number {
  if (chapterWords <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((wordsBehind / chapterWords) * 100)));
}

export function ChapterProgress({ wordsBehind, chapterWords }: { wordsBehind: number; chapterWords: number }) {
  const pct = chapterPercent(wordsBehind, chapterWords);
  return (
    <div role="progressbar" aria-label="Through this chapter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${pct}% of this chapter read`}
      className="mt-2 h-1 w-full overflow-hidden rounded-full bg-current/15">
      <div className="h-full rounded-full bg-ochre transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
    </div>
  );
}
