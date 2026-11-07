#!/usr/bin/env node
/**
 * Automated accessibility check (axe-core through Playwright) for every page of
 * CampusSafe, for every role, in light and dark themes, at phone (360px) and
 * desktop (1280px) widths. See docs/ACCESSIBILITY.md for the method.
 *
 *   npm run dev:local                      # in one terminal (seeded test accounts)
 *   npm run a11y                           # in another
 *
 * Options (environment variables):
 *   A11Y_BASE_URL   app address (default http://127.0.0.1:8080)
 *   A11Y_JSON       write the full results as JSON to this path
 *   A11Y_ONLY       comma-separated filter on page names, e.g. "admin,login"
 *   A11Y_THEMES     "light,dark" (default both)
 *   A11Y_WIDTHS     "360,1280" (default both)
 *   A11Y_PREPARE    "0" skips creating the test SOS, report and assignment
 *
 * Test accounts come from .env.local.example (BOOTSTRAP_*); the npm script loads
 * that file. Exits with status 1 when a serious or critical violation remains,
 * other than the documented exceptions in EXCEPTIONS (still printed).
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const AXE_SOURCE = require("fs").readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const BASE = (process.env.A11Y_BASE_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const THEMES = (process.env.A11Y_THEMES ?? "light,dark").split(",");
const WIDTHS = (process.env.A11Y_WIDTHS ?? "360,1280").split(",").map(Number);
const ONLY = process.env.A11Y_ONLY?.split(",").filter(Boolean) ?? [];
/** On campus, so maps, Safe Walk and the SOS countdown behave as for a real student. */
const CAMPUS = { latitude: 30.26815, longitude: 77.99575, accuracy: 15 };

/**
 * Findings reviewed and accepted, with the reason (docs/ACCESSIBILITY.md).
 * They are listed in the output but do not fail the run.
 */
const EXCEPTIONS = [
  {
    rule: "target-size",
    target: /leaflet-marker-icon/,
    why:
      "map pins at almost the same spot overlap; each pin is 24px and the same alert " +
      "is reachable from the list beside the map (WCAG 2.5.8 'equivalent' exception)",
  },
];
const excepted = (ruleId, target) =>
  EXCEPTIONS.find((e) => e.rule === ruleId && e.target.test(target));

const ACCOUNTS = {
  student: [process.env.BOOTSTRAP_STUDENT_EMAIL, process.env.BOOTSTRAP_STUDENT_PASSWORD],
  responder: [process.env.BOOTSTRAP_RESPONDER_EMAIL, process.env.BOOTSTRAP_RESPONDER_PASSWORD],
  admin: [process.env.BOOTSTRAP_ADMIN_EMAIL, process.env.BOOTSTRAP_ADMIN_PASSWORD],
};

/**
 * Pages per role. `path` may be a function that discovers an id from a list
 * page (first matching link). `state` runs after load to open a dialog, panel
 * or menu so axe sees it too.
 */
/** Filled in by prepare(): the open SOS every SOS detail page shows. */
const prepared = { sosId: null };

const PAGES = {
  public: [
    { name: "login", path: "/login" },
    { name: "signup", path: "/signup" },
    { name: "anonymous", path: "/anonymous" },
    { name: "anonymous step 2", path: "/anonymous", state: anonymousNext },
    { name: "track", path: "/track/CS-7F3K-92QD" },
    { name: "forbidden", path: "/forbidden" },
  ],
  student: [
    { name: "student onboarding", path: "/", onboarding: true },
    { name: "student home", path: "/" },
    { name: "student SOS countdown", path: "/", state: sosCountdown },
    { name: "student profile panel", path: "/", state: openProfile },
    { name: "student bell", path: "/", state: openBell },
    { name: "student report", path: "/report" },
    { name: "student report errors", path: "/report", state: submitEmpty },
    { name: "student my reports", path: "/reports" },
    { name: "student report detail", path: firstLink("/reports", /^\/reports\/[^/]+$/) },
    { name: "student live SOS", path: () => prepared.sosId && `/sos/${prepared.sosId}` },
  ],
  responder: [
    { name: "responder alerts", path: "/staff" },
    { name: "responder alert detail", path: () => prepared.sosId && `/staff/${prepared.sosId}` },
    {
      name: "responder incident",
      path: firstLink("/staff", /^\/staff\/incidents\/[^/]+$/),
      optional: true,
    },
  ],
  admin: [
    { name: "admin dashboard", path: "/admin" },
    { name: "admin command palette", path: "/admin", state: commandPalette, desktopOnly: true },
    { name: "admin SOS", path: "/admin/sos" },
    { name: "admin SOS detail", path: () => prepared.sosId && `/admin/sos/${prepared.sosId}` },
    { name: "admin incidents", path: "/admin/incidents" },
    {
      name: "admin incident detail",
      path: firstLink("/admin/incidents", /^\/admin\/incidents\/[^/]+$/),
    },
    { name: "admin anonymous", path: "/admin/anonymous" },
    { name: "admin users", path: "/admin/users" },
    { name: "admin responders", path: "/admin/responders" },
    { name: "admin analytics", path: "/admin/analytics" },
    { name: "admin alerts", path: "/admin/alerts" },
  ],
};

function firstLink(listPath, pattern) {
  return async (page) => {
    await goto(page, listPath);
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
    return hrefs.find((h) => h && pattern.test(h)) ?? null;
  };
}

async function goto(page, path) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function anonymousNext(page) {
  // Pick the first choice on step 1 and move on, if the page has steps.
  const tile = page.locator("main button[aria-pressed]").first();
  if (await tile.count()) await tile.click().catch(() => {});
  const next = page.getByRole("button", { name: /next|continue/i }).first();
  if (await next.count()) await next.click().catch(() => {});
  await page.waitForTimeout(300);
}

async function sosCountdown(page) {
  const sos = page.locator(".sos-btn:visible").first();
  await sos.focus();
  await page.keyboard.down("Space");
  await page.waitForTimeout(2300);
  await page.keyboard.up("Space");
  await page.getByRole("alertdialog").waitFor({ timeout: 3000 });
}

async function openProfile(page) {
  const btn = page
    .getByRole("button", { name: /profile|account/i })
    .locator("visible=true")
    .first();
  await btn.click();
  await page.waitForTimeout(500);
}

async function openBell(page) {
  const btn = page
    .getByRole("button", { name: /updates on your reports|critical alerts/i })
    .locator("visible=true")
    .first();
  await btn.click();
  await page.waitForTimeout(400);
}

async function submitEmpty(page) {
  const submit = page.locator("main form button[type=submit]").first();
  await submit.click().catch(() => {});
  await page.waitForTimeout(400);
}

async function commandPalette(page) {
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(300);
}

async function signIn(context, role) {
  const [email, password] = ACCOUNTS[role];
  if (!email || !password) throw new Error(`Missing BOOTSTRAP_* credentials for ${role}`);
  const res = await context.request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email, password },
    headers: { origin: BASE },
  });
  if (!res.ok()) throw new Error(`Sign-in as ${role} failed: ${res.status()}`);
  return (await res.json()).user?.id;
}

async function audit(page) {
  await page.addScriptTag({ content: AXE_SOURCE });
  return page.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
      },
      resultTypes: ["violations"],
    });
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      tags: v.tags.filter((t) => /^wcag\d/.test(t)),
      help: v.help,
      nodes: v.nodes.map((n) => ({ target: n.target.join(" "), summary: n.failureSummary })),
    }));
  });
}

const results = [];
let failures = 0;

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timed out after ${ms / 1000}s`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
// Playwright's own Chromium if installed (`npx playwright install chromium`),
// otherwise the system Chrome or Edge.
async function launch() {
  const channels = [process.env.A11Y_CHANNEL, undefined, "chrome", "msedge"];
  let lastError;
  for (const channel of channels.filter((c, i) => i > 0 || c)) {
    try {
      return await chromium.launch(channel ? { channel } : {});
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
/**
 * Make sure there is something behind every detail page: an open SOS from the
 * test student (sent with the keyboard double-press, which also exercises the
 * no-long-press path), one incident report, and the SOS assigned to the test
 * responder. Safe to repeat: the server keeps one open SOS per student.
 */
async function prepare() {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 860 },
    geolocation: CAMPUS,
    permissions: ["geolocation"],
  });
  const studentId = await signIn(context, "student");
  await context.addInitScript((id) => localStorage.setItem(`cs-onboarded:${id}`, "1"), studentId);
  const page = await context.newPage();
  try {
    await goto(page, "/reports");
    const hasReport = await page.locator('a[href^="/reports/"]').count();
    if (!hasReport) {
      await goto(page, "/report");
      await page.locator("main form button[aria-pressed]").first().click();
      await page.locator("main form textarea").first().fill("Accessibility audit test report.");
      await page.locator("main form button[type=submit]").click();
      await page.waitForURL(/\/reports?\b/, { timeout: 10000 }).catch(() => {});
    }
    await goto(page, "/");
    await page.locator(".sos-btn:visible").first().focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/sos\//, { timeout: 25000 });
    const sosPath = new URL(page.url()).pathname;
    prepared.sosId = sosPath.split("/").pop();
    await context.clearCookies();
    await signIn(context, "admin");
    await goto(page, `/admin${sosPath}`);
    // The account's own unit carries its full name (seeded units can share a first name).
    const responderName = process.env.BOOTSTRAP_RESPONDER_NAME ?? "";
    const unit = page
      .locator("aside button[aria-pressed]:not([disabled])", { hasText: responderName })
      .first();
    if ((await unit.count()) && (await unit.getAttribute("aria-pressed")) === "false") {
      await unit.click();
      await page.waitForTimeout(1200);
    }
    if (!(await unit.count()) || (await unit.getAttribute("aria-pressed")) !== "true") {
      console.warn("  prepare: could not assign the SOS to the test responder");
    }
    console.log(`Prepared: SOS ${sosPath}, report and assignment in place.`);
  } catch (err) {
    console.warn(`  prepare: ${err.message.split("\n")[0]} (detail pages may be skipped)`);
  }
  await context.close();
}

const browser = await launch();
try {
  if (process.env.A11Y_PREPARE !== "0") await prepare();
  for (const [role, pages] of Object.entries(PAGES)) {
    for (const theme of THEMES) {
      for (const width of WIDTHS) {
        const context = await browser.newContext({
          viewport: { width, height: width < 768 ? 780 : 860 },
          isMobile: width < 768,
          hasTouch: width < 768,
          reducedMotion: "reduce",
          geolocation: CAMPUS,
          permissions: ["geolocation"],
        });
        let userId = null;
        if (role !== "public") userId = await signIn(context, role);
        await context.addInitScript(
          ([t, id]) => {
            try {
              localStorage.setItem("campussafe.theme", t);
              if (id && !sessionStorage.getItem("a11y-onboarding")) {
                localStorage.setItem(`cs-onboarded:${id}`, "1");
              }
            } catch {
              /* ignore */
            }
          },
          [theme, userId],
        );
        for (const spec of pages) {
          if (ONLY.length && !ONLY.some((o) => spec.name.includes(o))) continue;
          if (spec.desktopOnly && width < 768) continue;
          const page = await context.newPage();
          const label = `${spec.name} · ${theme} · ${width}px`;
          try {
            if (spec.onboarding) {
              await page.addInitScript(
                ([id]) => {
                  sessionStorage.setItem("a11y-onboarding", "1");
                  localStorage.removeItem(`cs-onboarded:${id}`);
                },
                [userId],
              );
            }
            const path = typeof spec.path === "function" ? await spec.path(page) : spec.path;
            if (!path) {
              if (!spec.optional) console.warn(`  skip ${label}: no item to open`);
              await page.close();
              continue;
            }
            // One stuck page (a dev-server reload mid-check) must not stall the run.
            const violations = await withTimeout(
              (async () => {
                await goto(page, path);
                if (spec.state) await spec.state(page);
                return audit(page);
              })(),
              90_000,
            );
            results.push({ page: spec.name, role, theme, width, path, violations });
            const count = violations.reduce((n, v) => n + v.nodes.length, 0);
            console.log(`${count ? "✗" : "✓"} ${label}${count ? ` — ${count} issue(s)` : ""}`);
          } catch (err) {
            console.warn(`  error ${label}: ${err.message.split("\n")[0]}`);
            failures += 1;
          }
          await withTimeout(page.close(), 10_000).catch(() => {});
        }
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

// Summary: one line per rule, with where it appears.
const byRule = new Map();
for (const r of results) {
  for (const v of r.violations) {
    for (const n of v.nodes) {
      const why = excepted(v.id, n.target)?.why;
      const key = why ? `${v.id} (accepted)` : v.id;
      const entry = byRule.get(key) ?? {
        ...v,
        id: key,
        why,
        count: 0,
        where: new Set(),
        targets: new Set(),
      };
      entry.count += 1;
      entry.where.add(`${r.page} (${r.theme}, ${r.width}px)`);
      entry.targets.add(n.target);
      byRule.set(key, entry);
    }
  }
}
const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
const rules = [...byRule.values()].sort((a, b) => order[a.impact] - order[b.impact]);
console.log(`\n${results.length} page views checked.`);
if (!rules.length) console.log("No axe violations.");
for (const r of rules) {
  console.log(`\n[${r.impact}] ${r.id} — ${r.help} (${r.tags.join(", ") || "best practice"})`);
  console.log(`  ${r.count} node(s) on ${r.where.size} view(s)`);
  if (r.why) console.log(`  accepted: ${r.why}`);
  for (const t of [...r.targets].slice(0, 6)) console.log(`    ${t}`);
  if (r.targets.size > 6) console.log(`    … ${r.targets.size - 6} more`);
}
if (process.env.A11Y_JSON) {
  writeFileSync(process.env.A11Y_JSON, JSON.stringify(results, null, 2));
  console.log(`\nFull results: ${process.env.A11Y_JSON}`);
}
const blocking = rules.filter((r) => !r.why && (r.impact === "serious" || r.impact === "critical"));
if (failures) console.log(`\n${failures} page view(s) could not be checked (see "error" lines).`);
process.exitCode = blocking.length || failures ? 1 : 0;
