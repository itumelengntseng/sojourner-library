import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChapterProgress, chapterPercent } from "@/components/ChapterProgress";

describe("chapter progress (C32)", () => {
  it("rounds and clamps to 0–100", () => {
    expect(chapterPercent(0, 1000)).toBe(0);
    expect(chapterPercent(333, 1000)).toBe(33);
    expect(chapterPercent(5000, 1000)).toBe(100);
    expect(chapterPercent(-5, 1000)).toBe(0);
    expect(chapterPercent(10, 0)).toBe(0);
  });
  it("is a labelled progress bar with a spoken value", () => {
    const html = renderToStaticMarkup(<ChapterProgress wordsBehind={500} chapterWords={1000} />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="50"');
    expect(html).toContain("50% of this chapter read");
    expect(html).toContain("width:50%");
  });
});
