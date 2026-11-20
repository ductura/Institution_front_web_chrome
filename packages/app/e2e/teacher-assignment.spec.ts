import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

import { assignmentSetupMessages as wizard } from "../../../src/components/teacher/TeacherSetup/messages.hr";
import type { TeacherCourse } from "../../../src/components/teacher/teacher-courses-read";
import { messagesHr } from "../../../src/lib/i18n/messages.hr";

const fixtures = JSON.parse(readFileSync(new URL("./fixtures/teacher.json", import.meta.url), "utf8")) as {
  "teacher.courses.get": { courses: TeacherCourse[] };
};

const newPath = "/app/web/nastavnik/zadatak/novi";
const { assignment, existingCourse } = messagesHr.teacher;
const { newVersion, workLanguageException } = messagesHr.teacher;
const course = fixtures["teacher.courses.get"].courses[0]!;
const current = {
  assignmentId: "a04d5e6f-7081-4c93-9da4-e5f607182904", courseId: course.id, versionNo: 2,
  title: "Izmišljeni seminar", instructions: "Upute za izmišljeni zadatak.", workType: "seminar_paper",
  opensAt: "2026-10-01T06:00:00.000Z", dueAt: "2027-01-31T22:59:00.000Z", aiPolicy: "partially_allowed",
  aiPurposes: ["proofreading"], evidenceProfile: "basic", importAllowed: false, wordMin: 1500, wordMax: 2500,
};
const documentId = "izmisljeni-rad-01";
const teacherPath = `/app/chrome/nastavnik/zadatak/${current.assignmentId}`;
const assignmentApi = `**/api/v1/institution/assignments/${current.assignmentId}`;
const workApi = `${assignmentApi}/works/${documentId}/work-language`;

async function teacherSession(page: Page) {
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { roles: ["teacher"], institutionName: "Izmišljeni fakultet" },
  }));
  await page.route("**/api/v1/auth/login?*", (route) => route.fulfill({ body: "Lažni AAI@EduHr" }));
}

test("teacher selects a course and sees publication only after the API confirms it", async ({ page }) => {
  await teacherSession(page);
  await page.route("**/api/v1/teacher/courses", (route) => route.fulfill({ json: fixtures["teacher.courses.get"] }));

  let confirm!: () => void;
  const confirmed = new Promise<void>((resolve) => { confirm = resolve; });
  await page.route(`**/api/v1/institution/courses/${course.id}/assignments`, async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toMatchObject({ title: "Izmišljeni novi zadatak", aiPolicy: course.aiPolicy });
    await confirmed;
    await route.fulfill({ status: 201, json: { id: "12345678-0000-4000-8000-000000000001" } });
  });

  await page.goto(newPath);
  await page.getByRole("link", { name: new RegExp(course.name) }).click();
  await expect(page).toHaveURL(`${newPath}?kolegij=${course.id}`);
  await page.getByLabel(assignment.title, { exact: true }).fill("Izmišljeni novi zadatak");
  const next = page.getByRole("button", { name: wizard.next });
  await next.click();
  await page.getByLabel(assignment.opensAt, { exact: true }).fill("2027-01-10T10:00");
  await page.getByLabel(assignment.dueAt, { exact: true }).fill("2027-01-30T16:00");
  await next.click();
  await next.click();
  await next.click();
  try {
    await page.getByRole("button", { name: assignment.publish, exact: true }).click();
    await expect(page.getByRole("button", { name: assignment.pending, exact: true })).toBeDisabled();
    await expect(page.getByText(wizard.publishedNotice)).toHaveCount(0);
  } finally {
    confirm();
  }
  await expect(page.getByRole("status").filter({ hasText: wizard.publishedNotice })).toBeVisible();
});

test("course read 401 returns to the selected course after AAI@EduHr sign-in", async ({ page }) => {
  await teacherSession(page);
  await page.route("**/api/v1/teacher/courses", (route) => route.fulfill({ status: 401, json: { code: "unauthorized" } }));
  const path = `${newPath}?kolegij=${course.id}`;
  await page.goto(path);
  await expect(page).toHaveURL(/\/api\/v1\/auth\/login\?/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(path);
});

test("course read failure is visible and retry loads the course list", async ({ page }) => {
  await teacherSession(page);
  let failed = false;
  await page.route("**/api/v1/teacher/courses", (route) => {
    if (failed) return route.fulfill({ json: fixtures["teacher.courses.get"] });
    failed = true;
    return route.fulfill({ status: 503, json: { code: "unavailable" } });
  });
  await page.goto(newPath);
  await expect(page.getByRole("alert").filter({ hasText: existingCourse.unavailable })).toBeVisible();
  await page.getByRole("button", { name: messagesHr.teacherCourses.retry }).click();
  await expect(page.getByRole("link", { name: new RegExp(course.name) })).toBeVisible();
});

test("teacher publishes the next version and the return link stays in the Chrome host", async ({ page }) => {
  await teacherSession(page);
  await page.route(assignmentApi, (route) => route.fulfill({ json: current }));
  let confirm!: () => void;
  const confirmed = new Promise<void>((resolve) => { confirm = resolve; });
  await page.route(`${assignmentApi}/versions`, async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toMatchObject({ expectedVersion: 2, title: "Izmišljeni seminar s novim naslovom" });
    await confirmed;
    await route.fulfill({ status: 201, json: { assignmentId: current.assignmentId, versionNo: 3 } });
  });
  await page.goto(`${teacherPath}/uredi`);
  await page.getByLabel(assignment.title, { exact: true }).fill("Izmišljeni seminar s novim naslovom");
  const published = page.getByText(newVersion.published.replace("{n}", "3"), { exact: true });
  try {
    await page.getByRole("button", { name: newVersion.publish.replace("{n}", "3") }).click();
    await expect(page.getByRole("button", { name: newVersion.pending })).toBeDisabled();
    await expect(published).toHaveCount(0);
  } finally {
    confirm();
  }
  await expect(published).toBeVisible();
  const links = page.locator("form").getByRole("link", { name: messagesHr.teacher.backCourses });
  await expect(links).toHaveAttribute("href", "/app/chrome/nastavnik");
});

test("version conflict reloads the current version before another write", async ({ page }) => {
  await teacherSession(page);
  let versionNo = current.versionNo;
  await page.route(assignmentApi, (route) => route.fulfill({ json: { ...current, versionNo } }));
  await page.route(`${assignmentApi}/versions`, (route) => {
    versionNo += 1;
    return route.fulfill({ status: 409, json: { code: "version_conflict" } });
  });
  await page.goto(`${teacherPath}/uredi`);
  await page.getByLabel(assignment.title, { exact: true }).fill("Zastarjela izmjena izmišljenog seminara");
  await page.getByRole("button", { name: newVersion.publish.replace("{n}", "3") }).click();
  await expect(page.getByRole("alert").filter({ hasText: newVersion.errors.conflict })).toBeVisible();
  await page.getByText(newVersion.reload, { exact: true }).click();
  await expect(page.getByText(newVersion.current.replace("{n}", "3"), { exact: true })).toBeVisible();
});

test("teacher changes the work language only after a confirmed API response", async ({ page }) => {
  await teacherSession(page);
  let confirm!: () => void;
  const confirmed = new Promise<void>((resolve) => { confirm = resolve; });
  await page.route(workApi, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { title: current.title, assignmentLanguage: "hr", exception: null } });
      return;
    }
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({ language: "en" });
    await confirmed;
    await route.fulfill({ json: { language: "en" } });
  });
  await page.goto(`${teacherPath}/rad/${documentId}/jezik`);
  const en = messagesHr.workspace.upute.workLanguages.en;
  await page.getByRole("radio", { name: en, exact: true }).check();
  const saved = page.getByRole("status").filter({ hasText: workLanguageException.saved.replace("{language}", en) });
  try {
    await page.getByRole("button", { name: workLanguageException.save }).click();
    await expect(page.getByRole("button", { name: workLanguageException.pending })).toBeDisabled();
    await expect(saved).toHaveCount(0);
  } finally {
    confirm();
  }
  await expect(saved).toBeVisible();
});

for (const { name, path, api, unavailable } of [
  { name: "assignment version", path: `${teacherPath}/uredi`, api: assignmentApi, unavailable: newVersion.unavailable },
  { name: "work language", path: `${teacherPath}/rad/${documentId}/jezik`, api: workApi, unavailable: workLanguageException.unavailable },
]) {
  test(`${name} read 401 returns to the same host after sign-in`, async ({ page }) => {
    await teacherSession(page);
    await page.route(api, (route) => route.fulfill({ status: 401, json: { code: "unauthorized" } }));
    await page.goto(path);
    await expect(page).toHaveURL(/\/api\/v1\/auth\/login\?/);
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe(path);
  });

  test(`${name} read failure is visible`, async ({ page }) => {
    await teacherSession(page);
    await page.route(api, (route) => route.fulfill({ status: 503, json: { code: "unavailable" } }));
    await page.goto(path);
    await expect(page.getByRole("alert").filter({ hasText: unavailable })).toBeVisible();
    await expect(page.getByRole("button", { name: messagesHr.teacherCourses.retry })).toBeVisible();
  });
}
