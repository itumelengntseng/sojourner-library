import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { glance } from "@/lib/glance";

const w = (openLoans: number) => ({ visibility: "members" as const, words: 10, openLoans });
const loansTile = (t: ReturnType<typeof glance>) => t.find((x) => x.label === "Out on loan now")!;

describe("Writer's Room loans tile — due back within the day (C122)", () => {
  it("adds the count after the open loans", () => {
    expect(loansTile(glance([w(2), w(1)], 0, 3, 2)).note).toBe("3 open loans · 2 due back within the day");
    expect(loansTile(glance([w(1)], 0, 3, 1)).note).toBe("1 open loan · 1 due back within the day");
  });
  it("keeps the plain note when nothing is due soon (or the count is missing)", () => {
    expect(loansTile(glance([w(2)], 0, 3, 0)).note).toBe("2 open loans");
    expect(loansTile(glance([w(2)], 0, 3)).note).toBe("2 open loans");
    expect(loansTile(glance([w(0)], 0, 3, 0)).note).toBe("every book is in");
  });
  it("never says more are due than are out", () => {
    expect(loansTile(glance([w(1)], 0, 3, 4)).note).toBe("1 open loan · 1 due back within the day");
    expect(loansTile(glance([w(0)], 0, 3, 2)).note).toBe("every book is in");
  });
  it("is a count only: library mode asks for a head count of open loans in the next day, preview reads the cookie desk", () => {
    const src = readFileSync("lib/writersRoom.ts", "utf8");
    expect(src).toMatch(/from\("loans"\)\.select\("id", \{ count: "exact", head: true \}\)\.is\("returned_at", null\)/);
    expect(src).toMatch(/\.gt\("due_at"[\s\S]*?\.lte\("due_at"/);
    expect(src).toMatch(/dueBackSoon\(out, Date\.now\(\)\)\.length/);
    expect(readFileSync("app/writers-room/page.tsx", "utf8")).toMatch(/room\.dueSoon\)/);
  });
});
