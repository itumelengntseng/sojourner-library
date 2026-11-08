import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// C228: the pitch kit editor says at the top when the kit is still a placeholder, and points to the tick.
describe("pitch kit editor placeholder line (C228)", () => {
  it("shows only for a placeholder kit and links to the own-words tick", () => {
    const f = readFileSync("components/PitchKitForm.tsx", "utf8");
    expect(f).toContain("{kit.isPlaceholder && <p data-kit-placeholder");
    expect(f).toContain('<a href="#own-words"');
    expect(f).toContain('<input id="own-words" type="checkbox" name="ownWords" defaultChecked={!kit.isPlaceholder}');
  });
});
