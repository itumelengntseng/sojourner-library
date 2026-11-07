import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { glance } from "@/lib/glance";

describe("Writer's Room loans tile — read in one order (C151)", () => {
  it("note carries borrowed, then returned; the ember due part follows in the same dd", () => {
    const [, , , t] = glance([{ visibility: "members", words: 100, openLoans: 3 }], 0, 2, 2, 1, 1);
    expect(t.note).toBe("3 open loans · 1 borrowed in the last hour · 1 returned in the last hour");
    expect(t.urgentNote).toBe("2 due back within the day");
    const src = readFileSync("app/writers-room/page.tsx", "utf8");
    expect(src).toContain('{t.note && <dd className="font-sans text-[0.65rem] text-sandstone/80">{t.note}{t.urgentNote && <span className="text-ember"> · {t.urgentNote}</span>}</dd>}');
  });
});
