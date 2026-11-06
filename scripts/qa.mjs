// QA sweep: every route at phone and desktop widths — accessibility (axe, WCAG 2.1 AA),
// sideways overflow, and console errors. Usage: npm run build && npx next start -p 3200 & npm run qa
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Playwright is not a project dependency: use the machine's install (`npm i -g playwright` locally).
const { chromium } = require("playwright");
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.QA_BASE ?? "http://localhost:3200";
const WIDTHS = [375, 1280];

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

// Borrow a book first so the reading room and a full ledger are reachable.
await page.goto(`${BASE}/works/placeholder-work-one`);
await page.getByRole("button", { name: "Borrow this work" }).click();
await page.getByRole("link", { name: "Open the reading room" }).waitFor();

const routes = ["/", "/halls", "/halls?canon=all", "/card", "/works/placeholder-work-one", "/works/placeholder-work-one/read",
  "/works/placeholder-work-three/read", "/ledger", "/lineage", "/lineage?canon=all", "/timeline", "/timeline?canon=all", "/writers-room", "/writers-room/atlas", "/pitch-room", "/pitch-room/placeholder-work-one", "/pitch-room/placeholder-work-one/edit", "/p/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", "/works/no-such-book"];
let failures = 0;
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  for (const route of routes) {
    errors.length = 0;
    await page.goto(BASE + route);
    await page.waitForTimeout(400);
    await page.evaluate(axeSource);
    const result = await page.evaluate(async () =>
      // eslint-disable-next-line no-undef
      await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] }));
    const bad = result.violations.filter((v) => ["serious", "critical"].includes(v.impact));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const problems = [
      ...bad.map((v) => `axe ${v.impact}: ${v.id} — ${v.help} (${v.nodes.length}× e.g. ${v.nodes.slice(0, 9).map((n) => n.target.join(" ")).join(", ")})`),
      ...(overflow > 0 ? [`page scrolls sideways by ${overflow}px`] : []),
      ...errors.filter((e) => !/404/.test(e)).map((e) => `console: ${e}`),
    ];
    failures += problems.length;
    console.log(`${problems.length ? "✗" : "✓"} ${width}px ${route}`);
    for (const p of problems) console.log(`    ${p}`);
  }
}
// The reading room in every theme and layout, with a highlight and a note on the page.
await page.setViewportSize({ width: 375, height: 900 });
for (const settings of [{ theme: "sepia" }, { theme: "light" }, { theme: "dark", layout: "paged" }]) {
  errors.length = 0;
  await page.goto(`${BASE}/works/placeholder-work-one/read?ch=1`);
  await page.evaluate((s) => localStorage.setItem("soj:reader-settings", JSON.stringify({ ...s, fontSize: 19 })), settings);
  await page.evaluate(() => localStorage.setItem("soj:ann:placeholder-work-one:1", JSON.stringify({
    notes: [{ id: "n1", anchor: 0, body: "QA note", createdAt: 1 }],
    highlights: ["lamplight", "ochre", "sky"].map((c, i) => ({ id: c, start: i * 40, end: i * 40 + 30, colour: c })),
  })));
  await page.reload();
  await page.waitForTimeout(400);
  await page.evaluate(axeSource);
  const result = await page.evaluate(async () => await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] }));
  const bad = result.violations.filter((v) => ["serious", "critical"].includes(v.impact));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const problems = [
    ...bad.map((v) => `axe ${v.impact}: ${v.id} — ${v.help} (${v.nodes.length}× e.g. ${v.nodes.slice(0, 9).map((n) => n.target.join(" ")).join(", ")})`),
    ...(overflow > 0 ? [`page scrolls sideways by ${overflow}px`] : []),
    ...errors.map((e) => `console: ${e}`),
  ];
  failures += problems.length;
  console.log(`${problems.length ? "✗" : "✓"} reading room ${JSON.stringify(settings)}`);
  for (const p of problems) console.log(`    ${p}`);
}

await browser.close();
console.log(failures ? `\n${failures} problem(s)` : "\nAll clear");
process.exit(failures ? 1 : 0);
