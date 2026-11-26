// F4-NAS-R13 (NAS-19, odluka 2164): publishing a new assignment says „Objava zadatka u tijeku…” while the
// server has not answered, then goes back to /nastavnik where a toast confirms it and leaves after 3200 ms.
// A refusal stays on the review with its alert and leaves no toast for later. axe A/AA on every state.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "./fixtures/test";

import type { TeacherCourse } from "../../../src/components/teacher/teacher-courses-read";
import { axe } from "./a11y/check";
import { publishHr } from "../src/host/teacher/publish/messages.hr";

const fixtures = JSON.parse(readFileSync(new URL("./fixtures/teacher.json", import.meta.url), "utf8")) as {
  "teacher.courses.get": { courses: TeacherCourse[] };
};
const course = fixtures["teacher.courses.get"].courses[0]!;
const formPath = `/app/web/nastavnik/zadatak/novi?kolegij=${course.id}`;

async function teacherWithCourses(page: Page) {
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: { roles: ["teacher"], institutionName: "Izmišljeni fakultet" } }));
  await page.route("**/api/v1/auth/login?*", (route) => route.fulfill({ body: "Lažni AAI@EduHr" }));
  await page.route("**/api/v1/teacher/courses", (route) => route.fulfill({ json: fixtures["teacher.courses.get"] }));
}

async function fillAndReview(page: Page) {
  await page.goto(formPath);
  await page.getByLabel("Naslov zadatka", { exact: true }).fill("Izmišljeni zadatak NAS-19");
  await page.getByLabel("Otvaranje", { exact: true }).fill("2027-01-10T10:00");
  await page.getByLabel("Rok", { exact: true }).fill("2027-01-30T16:00");
  await page.getByRole("button", { name: "Pregled i objava" }).click();
}

test("confirmed publish: loading text, then back to /nastavnik with a toast that leaves after 3200 ms", async ({ page }, info) => {
  await teacherWithCourses(page);
  let confirm!: () => void;
  const confirmed = new Promise<void>((resolve) => { confirm = resolve; });
  await page.route(`**/api/v1/institution/courses/${course.id}/assignments`, async (route) => {
    expect(route.request().method()).toBe("POST");
    await confirmed;
    await route.fulfill({ status: 201, json: { id: "12345678-0000-4000-8000-000000000013" } });
  });

  await fillAndReview(page);
  const toast = page.getByRole("status").filter({ hasText: publishHr.published });
  try {
    await page.getByRole("button", { name: "Objavi zadatak", exact: true }).click();
    const busy = page.locator('[aria-busy="true"]').getByRole("status");
    await expect(busy).toHaveText(publishHr.pending);
    await expect(page.getByText(publishHr.published)).toHaveCount(0);
    await axe(page, info, "nas-r13-u-tijeku");
  } finally {
    confirm();
  }

  await expect(page).toHaveURL("/app/web/nastavnik");
  await expect(toast).toBeVisible();
  await axe(page, info, "nas-r13-toast");
  // TEACHER_TOAST_MS: the neutral toast leaves by itself.
  await expect(toast).toHaveCount(0, { timeout: 6000 });

  // The mark is used once: a reload shows no second toast.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(publishHr.published)).toHaveCount(0);
});

test("refused publish stays on the review with the alert and leaves no toast for /nastavnik", async ({ page }, info) => {
  await teacherWithCourses(page);
  await page.route(`**/api/v1/institution/courses/${course.id}/assignments`, (route) =>
    route.fulfill({ status: 403, json: { code: "forbidden" } }));

  await fillAndReview(page);
  await page.getByRole("button", { name: "Objavi zadatak", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: publishHr.refused })).toBeVisible();
  await expect(page).toHaveURL(formPath);
  await axe(page, info, "nas-r13-odbijeno");

  await page.goto("/app/web/nastavnik");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(publishHr.published)).toHaveCount(0);
});
