// WEB-NF4-OBAVIJESTI-2 (NZ-6, NZ-7a; review of WEB#595): the block "Ovako će student vidjeti obavijest" on /uredi
// shows the allowed purposes of the real closed list (all five FPZG čl. 8 purposes) as the student notice does, with
// the grouped word range; the list "Produljeni rokovi" filters by student and says what the student reads. axe at
// 390 and 1280 px in the dark and the light theme; the filter by keyboard. The server is faked per test; invented data only.
import AxeBuilder from "@axe-core/playwright";

import { AI_PURPOSES } from "../../../src/components/teacher/assignment-create";
import { messagesHr } from "../../../src/lib/i18n/messages.hr";
import { BLOCKING, WCAG_TAGS, hiddenFocus } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";

const labels = messagesHr.facultyRuleVersions.purposeLabels;
const K1 = "6c1d0e9f-8a7b-4c6d-9e5f-4a3b2c1d0e11";
const A1 = "6c1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c11";
const S1 = "6c2b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c21";
const S2 = "6c2b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c22";
const S3 = "6c2b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c23";
const TEACHER = "6c3b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c31";
const OTHER_TEACHER = "6c3b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c32";
const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

const VERSION = {
  assignmentId: A1, courseId: K1, versionNo: 2, title: "Izmišljeni seminar o obavijesti", instructions: "Upute za izmišljeni zadatak.",
  workType: "seminar_paper", opensAt: "2026-10-01T06:00:00.000Z", dueAt: "2099-12-15T22:59:00.000Z", aiPolicy: "partially_allowed",
  aiPurposes: [...AI_PURPOSES].reverse(), evidenceProfile: "basic", importAllowed: false, wordMin: 2000, wordMax: 2500,
};
const COURSE = {
  id: K1, name: "Izmišljeni kolegij obavijesti", academicYear: "2026/2027", aiPolicy: "partially_allowed",
  assignments: [{ id: A1, title: VERSION.title, workType: "seminar_paper", opensAt: VERSION.opensAt, dueAt: VERSION.dueAt, currentVersion: 2, enrolledStudents: 3 }],
};
const student = (studentId: string, givenName: string) => ({
  studentId, givenName, familyName: "Izmišljenić", groupName: "Grupa 1", submitted: false, requestedMinute: null, afterDeadline: null, evidenceRecord: null,
});
const EXTENSIONS = [
  { id: "6c4b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c41", scope: "one", studentId: S2, previousDueAt: "2099-12-15T22:59:00.000Z",
    dueAt: "2099-12-20T22:59:00.000Z", reasonId: "technical", createdBy: TEACHER, createdAt: "2026-11-20T08:00:00.000Z" },
  { id: "6c4b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c42", scope: "all", studentId: null, previousDueAt: "2099-12-20T22:59:00.000Z",
    dueAt: "2099-12-22T22:59:00.000Z", reasonId: null, createdBy: OTHER_TEACHER, createdAt: "2026-11-21T08:00:00.000Z" },
];

async function teacher(page: Page, version: Record<string, unknown> = VERSION) {
  await page.route("**/api/v1/me", (route) => route.fulfill(json({
    role: "teacher", displayName: "Iva Izmišljena", institution: { slug: "izm", displayName: "Izmišljeni fakultet" },
  })));
  await page.route("**/api/v1/teacher/courses", (route) => route.fulfill(json({ courses: [COURSE] })));
  await page.route(`**/api/v1/institution/assignments/${A1}`, (route) => route.request().method() === "GET" ? route.fulfill(json(version)) : route.fallback());
  await page.route(`**/api/v1/teacher/assignments/${A1}/overview`, (route) => route.fulfill(json({
    students: [student(S1, "Ana"), student(S2, "Iva"), student(S3, "Luka")],
  })));
  await page.route(`**/api/v1/teacher/assignments/${A1}/deadline-extensions`, (route) => route.request().method() === "GET"
    ? route.fulfill(json({ extensions: EXTENSIONS })) : route.fallback());
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations.filter((v) => BLOCKING.includes(v.impact ?? "")).map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

const preview = (page: Page) => page.getByRole("region", { name: "Ovako će student vidjeti obavijest" });

test("NZ-7a: the preview allows all five real purposes, in the order of the article, with the student's word range", async ({ page }) => {
  await teacher(page);
  await page.goto(`/aplikacija/nastavnik/zadatak/${A1}/uredi`);
  const block = preview(page);
  await expect(block).toBeVisible();
  await expect(block.getByRole("definition")).toHaveText([
    "15. 12. 2099. u 23:59",
    `Asistent je dopušten za: ${AI_PURPOSES.map((p) => labels[p]).join(", ")}`,
    "2 000–2 500 riječi",
    "nije dopušten",
    "2",
  ]);
  await expect(block).not.toContainText("Asistent nije dopušten");
  await expect(block).not.toContainText(/Ana|Iva Izmišljenić|Luka/);
});

for (const purpose of AI_PURPOSES) {
  test(`NZ-7a: a version allowing only ${purpose} shows it as allowed, as the student sees it`, async ({ page }) => {
    await teacher(page, { ...VERSION, aiPurposes: [purpose] });
    await page.goto(`/aplikacija/nastavnik/zadatak/${A1}/uredi`);
    await expect(preview(page).getByRole("definition").nth(1)).toHaveText(`Asistent je dopušten za: ${labels[purpose]}`);
  });
}

test("NZ-6: the filter, by keyboard, keeps one student's extensions and those for all; the hidden reason is said", async ({ page }) => {
  await teacher(page);
  await page.goto(`/aplikacija/nastavnik/zadatak/${A1}/produljenje`);
  const list = page.getByRole("region", { name: "Produljeni rokovi" });
  const rows = list.getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Student vidi: Bio 15. 12. 2099. u 23:59, razlog: Tehnička poteškoća");
  await expect(rows.nth(1)).toContainText("Student vidi: Bio 20. 12. 2099. u 23:59, razlog: (skriven Vama)");
  await expect(rows.nth(1)).toContainText("Razlog koji je zabilježio drugi nastavnik ne vidite; student ga vidi.");

  // Keyboard only: focus the filter and move through the students with the arrow keys.
  const filter = list.getByLabel("Prikaži produljenja za");
  await filter.focus();
  await expect(filter).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(filter).toHaveValue(S1);
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toContainText("Svi studenti zadatka");
  await page.keyboard.press("ArrowDown");
  await expect(filter).toHaveValue(S2);
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Iva Izmišljenić");
  await page.keyboard.press("Home");
  await expect(filter).toHaveValue("");
  await expect(rows).toHaveCount(2);
});

for (const width of [390, 1280]) {
  for (const theme of ["dark", "light"] as const) {
    test(`axe and keyboard focus: NZ-7a preview and NZ-6 list, ${width} px, ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await teacher(page);
      for (const path of ["uredi", "produljenje"]) {
        await page.goto(`/aplikacija/nastavnik/zadatak/${A1}/${path}`);
        await page.locator("html").evaluate((html, value) => html.setAttribute("data-theme", value), theme);
        await expect(path === "uredi" ? preview(page) : page.getByRole("region", { name: "Produljeni rokovi" })).toBeVisible();
        expect(await axe(page)).toEqual([]);
        expect(await hiddenFocus(page)).toEqual([]);
        const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(scroll).toBeLessThanOrEqual(0);
      }
    });
  }
}
