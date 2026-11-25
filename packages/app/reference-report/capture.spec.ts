// DAN-1565: captures every connected screen of the real app at the reference
// widths, dark and light, and writes one HTML file that lays each capture
// next to its reference image and their difference. It compares nothing to
// the catalogue's baselines and fails only when a screen does not open.
//   pnpm --filter @ductura/app run reference:report
// The references are docs/design/reference of this repository; DUCTURA_REFERENCES names another folder.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { diffImages } from "./diff.ts";
import { buildReport, type ReportRow } from "./html.ts";
import { captureName, referencePath, SCREENS, THEMES, WIDTHS, type ReportScreen } from "./screens.ts";

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => JSON.parse(readFileSync(join(here, path), "utf8")) as unknown;
const INSTITUTION = "Izmišljeni fakultet za testove";
const assignments = read("../../../src/components/student/fixtures/student.assignments.get.json") as {
  vectors: { name: string; response: { body: unknown } }[];
};
const teacher = read("../e2e/fixtures/teacher.json") as Record<string, unknown>;
const BODIES: Readonly<Record<string, unknown>> = {
  "student/assignments": assignments.vectors.find((v) => v.name === "ready")!.response.body,
  "teacher/courses": teacher["teacher.courses.get"],
  "teacher/mentorships": teacher["teacher.mentorships.get"],
};
const ME: Readonly<Record<ReportScreen["role"], unknown>> = {
  student: { role: "student", displayName: "Iva Izmišljena", institution: { slug: "izm", displayName: INSTITUTION } },
  teacher: { roles: ["teacher"], institutionName: INSTITUTION },
};

const referenceRoot = resolve(process.env.DUCTURA_REFERENCES ?? join(here, "../../../docs/design/reference"));
const outDir = resolve(process.env.DUCTURA_REFERENCE_REPORT ?? join(here, "dist"));

/** The institution server of one role: invented data only, and nothing leaves the browser. */
async function fakeServer(page: Page, role: ReportScreen["role"]) {
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1/", "");
    const body = path === "me" ? ME[role] : BODIES[path];
    return body === undefined
      ? route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "not_found" }) })
      : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("writes the report of real screens next to their reference images", async ({ browser }) => {
  test.setTimeout(300_000);
  mkdirSync(join(outDir, "snimke"), { recursive: true });
  const rows: ReportRow[] = [];
  for (const screen of SCREENS) {
    for (const theme of THEMES) {
      for (const width of WIDTHS) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, locale: "hr-HR" });
        await context.addInitScript((stored) => window.localStorage.setItem("ductura.theme", stored), theme.stored);
        const page = await context.newPage();
        // One moment for every capture, so a date on a screen does not change the report.
        await page.clock.setFixedTime(new Date("2026-10-12T08:00:00.000Z"));
        await fakeServer(page, screen.role);
        await page.goto(`/app/web${screen.route}`);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(screen.heading);
        await page.evaluate(() => document.fonts.ready);
        const shot = await page.screenshot({ fullPage: true, animations: "disabled" });
        writeFileSync(join(outDir, "snimke", captureName(screen, theme, width)), shot);

        const actual = shot.toString("base64");
        const base = { screen: screen.id, route: screen.route, theme: theme.id, width, actual };
        const file = referencePath(screen, theme, width);
        const full = file === null ? null : join(referenceRoot, file);
        if (full === null || !existsSync(full)) {
          const missing = file === null ? "za ovaj ekran nije zadana" : `nema datoteke ${file}`;
          rows.push({ ...base, missing });
        } else {
          const reference = readFileSync(full).toString("base64");
          const diff = await diffImages(page, reference, actual);
          rows.push({
            ...base,
            compared: { referenceFile: file!, reference, diff: diff.diffBase64, percent: diff.percent, sameSize: diff.sameSize },
          });
        }
        await context.close();
      }
    }
  }
  const source = `reference: ${referenceRoot}`;
  writeFileSync(join(outDir, "index.html"), buildReport(rows, { generatedAt: new Date().toISOString(), source }));
  expect(rows).toHaveLength(SCREENS.length * THEMES.length * WIDTHS.length);
  console.log(`Izvještaj: ${join(outDir, "index.html")}`);
});
