import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const run = (args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, ["scripts/e2e.mjs", ...args], { env: { PATH: process.env.PATH ?? "", ...env } as unknown as NodeJS.ProcessEnv, encoding: "utf8" });

describe("end-to-end smoke script", () => {
  it("refuses to start without a target", () => {
    const r = run([]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/Set E2E_BASE/);
  });
  it("needs a saved sign-in for a library run, and never guesses one", () => {
    const r = run([], { E2E_BASE: "https://example.invalid", E2E_STATE: "/nonexistent/session.json" });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/--login first/);
  });
  it("rejects a malformed address", () => {
    expect(run([], { E2E_BASE: "example.org" }).stderr).toMatch(/must start with http/);
  });
});

// C211: the script checks the C207 line from a chapter without notes.
describe("end-to-end smoke script steps", () => {
  it("opens a chapter without notes and waits for the elsewhere line", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("scripts/e2e.mjs", "utf8");
    expect(src).toContain('await step("read: a chapter without notes says how many are elsewhere"');
    expect(src).toContain("No notes in this chapter yet · \\d+ elsewhere in this book · see Contents$");
    expect(src.indexOf("a chapter without notes")).toBeGreaterThan(src.indexOf('step("read: a highlight says it was saved, and removed"'));
  });
});
