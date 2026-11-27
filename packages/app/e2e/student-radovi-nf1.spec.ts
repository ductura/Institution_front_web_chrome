// WEB-NF1-RADOVI (NF-1 P-5, P-6, P-7, P-13): the state filter, the submission time, the history of an
// extended deadline and the row's one primary button on "Moji radovi". Every person, course and
// identifier here is invented; the server is faked per test.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d31";
const A_WORK = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e631";
const A_SENT = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e632";
const A_NOTICE = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e633";
const A_EXT = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e634";

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

/** A student with a started work, a submitted one, a notice not yet confirmed and an extended deadline. */
let submissionCalls = 0;

async function student(page: Page, work: Record<string, unknown>[], history: { status: number; json?: unknown } = { status: 200, json: { extensions: [] } },
  submissions: Record<string, unknown>[] | null = [{ assignmentId: A_SENT, submittedAt: "2026-10-30T09:15:00.123456Z", afterDeadline: false }]) {
  const asked: string[] = [];
  submissionCalls = 0;
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", displayName: "Iva Izmišljena", institution: { slug: "izm", displayName: "Izmišljeni fakultet" } },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij medija", academicYear: "2026/2027", assignments: [
      { id: A_WORK, title: "Esej o izmišljenom gradu", dueAt: "2099-12-30T10:00:00.000Z", noticeFirst: false },
      { id: A_SENT, title: "Sažetak izmišljenog članka", dueAt: "2026-11-01T10:00:00.000Z", noticeFirst: false },
      { id: A_NOTICE, title: "Izlaganje o izmišljenom selu", dueAt: "2099-12-31T10:00:00.000Z", noticeFirst: true },
      { id: A_EXT, title: "Osvrt na izmišljeni film", dueAt: "2026-11-02T10:00:00.000Z", noticeFirst: false, extendedDueAt: "2099-12-29T10:00:00.000Z" },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({ json: { assignments: work } }));
  await page.route("**/api/v1/student/assignment-submissions", (route) => { submissionCalls += 1; return submissions === null ? route.fulfill({ status: 503, json: { error: "unavailable" } }) : route.fulfill({ json: { assignments: submissions } }); });
  await page.route("**/api/v1/student/assignments/*/deadline-extensions", (route) => {
    asked.push(new URL(route.request().url()).pathname);
    return route.fulfill(history.json === undefined ? { status: history.status } : { status: history.status, json: history.json });
  });
  return asked;
}

const STATES = [
  { assignmentId: A_WORK, workState: "in_progress" },
  { assignmentId: A_SENT, workState: "submitted" },
  { assignmentId: A_NOTICE, workState: "not_started" },
  { assignmentId: A_EXT, workState: "not_started" },
];
const HISTORY = { extensions: [{ id: "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e6a1", scope: "one", previousDueAt: "2026-11-02T10:00:00.000Z",
  dueAt: "2099-12-29T10:00:00.000Z", reasonId: "technical", createdAt: "2026-11-01T10:00:00.000Z" }] };

for (const width of [390, 1280]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`P-5, P-6, P-7, P-13: filter, time, history and one button per row (${width} px, ${colorScheme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      const asked = await student(page, STATES, { status: 200, json: HISTORY });
      await page.goto("/aplikacija/zadaci/radovi");
      const rows = page.getByRole("list", { name: "Popis radova" }).getByRole("listitem");
      await expect(rows).toHaveCount(4);

      // P-7: only the extended assignment is asked for; the row tells the previous deadline, reason and scope.
      const ext = rows.filter({ hasText: "Osvrt na izmišljeni film" });
      await expect(ext.getByText("Produljeni rok", { exact: true })).toBeVisible();
      await expect(ext.getByText("Prethodni rok: 2. 11. 2026., 11:00. Razlog: tehnički razlog. Vrijedi za samo Vas.")).toBeVisible();
      expect(asked).toEqual([`/api/v1/student/assignments/${A_EXT}/deadline-extensions`]);

      // P-6: the time comes from student.assignment-submissions.get (one call for the list), not guessed.
      const sent = rows.filter({ hasText: "Sažetak izmišljenog članka" });
      await expect(sent.getByText("Predano 30. 10. 2026., 10:15")).toBeVisible();
      await expect(sent.getByText("nakon roka")).toHaveCount(0);
      expect(submissionCalls).toBe(1);

      // P-13: one primary button per row, named with the title and described by the date line (and the history).
      for (let i = 0; i < 4; i += 1) await expect(rows.nth(i).getByRole("link")).toHaveCount(1);
      const open = ext.getByRole("link", { name: "Otvori zadatak: Osvrt na izmišljeni film" });
      await expect(open).toHaveAccessibleDescription(/Produljeni rok.*Prethodni rok/s);
      const box = await open.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);

      // P-5: the state filter narrows and a closed value only.
      await page.getByLabel("Stanje").selectOption("predano");
      await page.getByRole("button", { name: "Prikaži" }).click();
      await expect(page).toHaveURL(/stanje=predano/);
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText("Sažetak izmišljenog članka");
      await axe(page);

      await page.goto("/aplikacija/zadaci/radovi?stanje=zapredati");
      await expect(rows).toHaveCount(2);
      await page.goto("/aplikacija/zadaci/radovi?stanje=obavijest");
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText("Izlaganje o izmišljenom selu");
      await page.goto("/aplikacija/zadaci/radovi?stanje=nesto");
      await expect(rows).toHaveCount(4);
      await axe(page);
    });
  }
}

test("P-5: no match under the state filter says so, and the reset link clears it", async ({ page }) => {
  await student(page, STATES.map((s) => (s.assignmentId === A_SENT ? { ...s, workState: "in_progress" } : s)));
  await page.goto("/aplikacija/zadaci/radovi?stanje=predano");
  await expect(page.getByText("Nijedan rad ne odgovara odabiru.")).toBeVisible();
  await page.getByRole("link", { name: "Poništi odabir" }).click();
  await expect(page.getByRole("list", { name: "Popis radova" }).getByRole("listitem")).toHaveCount(4);
});

test("P-7: a history that cannot be read leaves the row with 'Produljeni rok' alone", async ({ page }) => {
  await student(page, STATES, { status: 503 });
  await page.goto("/aplikacija/zadaci/radovi");
  const ext = page.getByRole("listitem").filter({ hasText: "Osvrt na izmišljeni film" });
  await expect(ext.getByText("Produljeni rok", { exact: true })).toBeVisible();
  await expect(ext.getByText(/Prethodni rok/)).toHaveCount(0);
});

test("P-6: a submission after the deadline says so, and an unreadable answer leaves Predano alone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await student(page, STATES, undefined, [{ assignmentId: A_SENT, submittedAt: "2026-11-02T09:15:00.000000Z", afterDeadline: true }]);
  await page.goto("/aplikacija/zadaci/radovi");
  const sent = page.getByRole("list", { name: "Popis radova" }).getByRole("listitem").filter({ hasText: "Sažetak izmišljenog članka" });
  await expect(sent.getByText("Predano 2. 11. 2026., 10:15, nakon roka")).toBeVisible();
  await axe(page);

  await student(page, STATES, undefined, null);
  await page.goto("/aplikacija/zadaci/radovi");
  const alone = page.getByRole("list", { name: "Popis radova" }).getByRole("listitem").filter({ hasText: "Sažetak izmišljenog članka" });
  await expect(alone.getByText("Predano", { exact: true })).toBeVisible();
});
