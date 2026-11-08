import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LineageForm } from "@/components/AtlasForms";
import { LINEAGE } from "@/content/lineage";
import { waitingForWords } from "@/lib/waiting";

// C235: the waiting panel's family-wall and timeline rows open the editor on "Placeholders only".
describe("atlas editor opened on Placeholders only (C235)", () => {
  it("the waiting rows link with ?only=1", () => {
    const r = waitingForWords({ works: [], kits: [], people: [{ isPlaceholder: true }], places: [], events: [{ isPlaceholder: true }], hallsNamed: true }).rows;
    expect(r.map((x) => x.href)).toEqual(["/writers-room/atlas?only=1#lineage-doc", "/writers-room/atlas?only=1#timeline-doc"]);
  });
  it("the form starts with the toggle on and the first placeholder open", () => {
    const people = [{ ...LINEAGE.people[0], isPlaceholder: false }, ...LINEAGE.people.slice(1)];
    const html = renderToStaticMarkup(<LineageForm value={{ ...LINEAGE, people }} works={{}} onChange={() => {}} startOnlyPlaceholders />);
    expect(html).toMatch(/<input type="checkbox"[^>]*checked=""[^>]*\/>Placeholders only/);
    expect(html).not.toContain(`>${people[0].name}</button>`);
    expect(html).toContain(`aria-pressed="true" class="rounded-full border px-3 py-1 font-sans text-xs border-lamplight bg-lamplight/15 text-lamplight">${people[1].name}</button>`);
  });
  it("off by default", () => {
    const html = renderToStaticMarkup(<LineageForm value={LINEAGE} works={{}} onChange={() => {}} />);
    expect(html).not.toMatch(/checked=""[^>]*\/>Placeholders only/);
  });
  it("the page reads the parameter once and passes it to both editors", () => {
    const page = readFileSync("app/writers-room/atlas/page.tsx", "utf8");
    expect(page).toContain('const only = (await searchParams).only === "1";');
    expect(page.match(/placeholdersOnly=\{only\}/g)?.length).toBe(2);
  });
});
