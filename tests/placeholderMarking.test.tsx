import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getWorks } from "@/lib/catalogue";
import { getPitch } from "@/content/pitches";
import { onePager } from "@/lib/pitch";
import { spokenSpine } from "@/lib/spine";
import { PitchSheet } from "@/components/PitchSheet";
import { AUTHOR } from "@/lib/site";

// C217: authorship and the placeholder rules pinned in one place — every placeholder work's page, spine and
// pitch sheet names Itumeleng Ntseng and carries a Placeholder mark until the real manuscripts arrive.
describe("placeholder works stay marked and attributed (C217)", () => {
  const works = getWorks();
  it("the author is Itumeleng Ntseng and every shelved work is a marked placeholder", () => {
    expect(AUTHOR).toBe("Itumeleng Ntseng");
    expect(works.length).toBeGreaterThan(0);
    for (const w of works) {
      expect(w.author).toBe(AUTHOR);
      expect(w.isPlaceholder).toBe(true);
      expect(w.title).toMatch(/^Placeholder /);
      expect(w.blurb).toMatch(/^Placeholder /);
    }
  });
  it("each spine says who wrote it", () => {
    for (const w of works) expect(spokenSpine({ author: w.author, canon: "Canon", readingTime: "1 h" })).toMatch(/^by Itumeleng Ntseng\. /);
  });
  it("each pitch sheet (screen and one-pager) names the author and says it's a placeholder", () => {
    for (const w of works) {
      const kit = getPitch(w.slug);
      if (!kit) continue;
      expect(kit.isPlaceholder).toBe(true);
      const work = { title: w.title, author: w.author, words: 1000, readingTime: "5 min" };
      const html = renderToStaticMarkup(<PitchSheet kit={kit} work={work} />);
      expect(html).toContain("by Itumeleng Ntseng");
      expect(html).toContain("© Itumeleng Ntseng");
      expect(html).toContain("Placeholder pitch");
      const md = onePager(kit, work);
      expect(md).toContain("**by Itumeleng Ntseng**");
      expect(md).toContain("> Placeholder pitch");
    }
  });
  it("the work page shows the author and the placeholder line", () => {
    const page = readFileSync("app/works/[slug]/page.tsx", "utf8");
    expect(page).toContain("by {work.author}</p>");
    expect(page).toContain("{work.isPlaceholder && (");
    expect(page).toContain("Placeholder text — the manuscript has not arrived yet.");
  });
});
