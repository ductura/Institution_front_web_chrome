const { expect, test } = require("@playwright/test");

const fixture = "/__fixture/mentor-timeline";
const work = "**/api/v1/works/demo-work";
const day = "2026-11-20";
const courseId = "00000000-0000-4000-8000-0000000000c1";
const assignmentId = "00000000-0000-4000-8000-0000000000a1";

async function mount(page, { role = "student", versions = [], milestones = [], slots = [], courses = [], students = [] } = {}) {
  await page.route(`**${fixture}*`, (route) => route.fulfill({ contentType: "text/html", body:
    '<!doctype html><html lang="hr"><meta charset="utf-8"><div id="app"></div>' +
    '<script type="module" src="/src/components/editor/mentor/timeline/browser/fixture.spec.tsx"></script></html>',
  }));
  await page.route(`${work}/versions`, (route) => route.fulfill({ json: { versions, nextBeforeRevision: null } }));
  await page.route(`${work}/milestones`, (route) => route.fulfill({ json: { milestones } }));
  await page.route(`${work}/consultation-slots`, (route) => route.fulfill({ json: { slots } }));
  await page.route("**/api/v1/teacher/courses", (route) => route.fulfill({ json: { courses } }));
  await page.route(`**/api/v1/teacher/courses/${courseId}/students`, (route) => route.fulfill({ json: { students } }));
  await page.goto(`${fixture}?role=${role}`);
}

test("sorts projected events chronologically and shows the confirmed submission", async ({ page }) => {
  await mount(page, {
    versions: [
      { kind: "submission", revision: 42, savedMinute: `${day}T11:00:00.000Z`, afterDeadline: false },
      { kind: "checkpoint", revision: 42, savedMinute: `${day}T10:00:00.000Z` },
    ],
    milestones: [{ id: courseId, title: "Izmišljeni nacrt", description: "", state: "open", dueAt: `${day}T08:00:00.000Z` }],
    slots: [{ id: courseId, state: "confirmed", proposedAt: `${day}T09:00:00.000Z`, startsAt: `${day}T12:00:00.000Z` }],
  });
  await expect(page.getByRole("region", { name: "Stanje rada" })).toContainText("Rad je predan");
  await expect(page.locator("details[open]")).toContainText("Nakon predaje");
  await page.getByRole("button", { name: "Vremenska crta" }).click();
  const timeline = page.getByRole("dialog", { name: "Vremenska crta rada" });
  await expect(timeline.getByRole("listitem")).toHaveText([
    /Rok etape · Izmišljeni nacrt/, /Zatražene konzultacije/, /Verzija na poslužitelju · 42/,
    /Rad predan · 42/, /Potvrđeni termin konzultacija/,
  ]);
  await page.keyboard.press("Escape");
  await expect(timeline).toBeHidden();
  await expect(page.getByRole("button", { name: "Vremenska crta" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Moji studenti" })).toHaveCount(0);
});

test("shows the empty timeline for an ongoing work", async ({ page }) => {
  await mount(page);
  await expect(page.getByRole("region", { name: "Stanje rada" })).toContainText("Rad je u tijeku");
  await page.getByRole("button", { name: "Vremenska crta" }).click();
  await expect(page.getByRole("dialog")).toContainText("Još nema događaja na vremenskoj crti.");
});

test("shows the roster with groups and per-assignment state only when a course is available", async ({ page }) => {
  const noCourses = page.waitForResponse("**/api/v1/teacher/courses");
  await mount(page, { role: "teacher" });
  await noCourses;
  await expect(page.getByRole("region", { name: "Stanje rada" })).toContainText("Rad je u tijeku");
  await expect(page.getByRole("button", { name: "Moji studenti" })).toHaveCount(0);
  await page.unrouteAll({ behavior: "wait" });
  await mount(page, {
    role: "teacher",
    courses: [{
      id: courseId, name: "Izmišljeni kolegij", academicYear: "2026/2027", aiPolicy: "prohibited",
      assignments: [{
        id: assignmentId, title: "Izmišljeni seminar", workType: "seminar_paper", currentVersion: 1, enrolledStudents: 1,
        opensAt: "2026-11-19T08:00:00.000Z", dueAt: "2026-12-01T10:00:00.000Z",
      }],
    }],
    students: [{
      studentId: "00000000-0000-4000-8000-0000000000e1", givenName: "Demo", familyName: "Kompost", groupName: "Grupa A",
      assignments: [{ assignmentId, documentId: "demo-work", workState: "submitted" }],
    }],
  });
  await page.getByRole("button", { name: "Moji studenti" }).click();
  await expect(page.getByRole("dialog", { name: "Moji studenti" })).toContainText("Demo Kompost · Grupa A");
  await expect(page.getByRole("dialog", { name: "Moji studenti" })).toContainText("Izmišljeni seminar · Rad je predan");
});
