import { expect, test, type Page } from "@playwright/test";

import { mentorshipRequestText as s } from "../src/host/student/mentorship-request/messages.hr";
import { messagesHr } from "../../../src/lib/i18n/messages.hr";

// WEB-1404: the mentorship pages in the host with an invented /api/v1. WEB-1409 spojio
// studentsku stranicu na rute SRV-1414; the teacher's decision still has no route in the
// client (TODO(ugovor)) and says "unavailable". The whole flow is held by the unit tests
// over the invented server (fake-port.ts).
async function session(page: Page, role: "student" | "teacher") {
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role, roles: [role], institution: { displayName: "Izmišljeni fakultet" }, institutionName: "Izmišljeni fakultet" },
  }));
}

const TEACHER = { teacherId: "10000000-0000-4000-8000-000000000001", displayName: "Marko Izmišljeni" };
const REQUEST = {
  requestId: "00000000-0000-4000-8000-000000000001", title: "Izmišljeni naslov", workType: "bachelor_thesis", teacherId: TEACHER.teacherId,
  teacherName: TEACHER.displayName, status: "pending", requestedAt: "2026-11-21T10:00:00.000Z", decidedAt: null,
};

test("the student picks a teacher, sends a request, sees a declined one as declined and withdraws a pending one", async ({ page }) => {
  await session(page, "student");
  const rows: Array<Record<string, unknown>> = [{
    ...REQUEST, requestId: "00000000-0000-4000-8000-000000000002", title: "Odbijeni naslov", status: "declined", decidedAt: "2026-11-21T11:00:00.000Z",
  }];
  const posted: unknown[] = [];
  await page.route("**/api/v1/student/mentor-candidates", (route) => route.fulfill({ json: { candidates: [TEACHER] } }));
  await page.route("**/api/v1/student/mentorship-requests", async (route) => {
    if (route.request().method() === "POST") {
      posted.push(route.request().postDataJSON());
      rows.unshift(REQUEST);
      return route.fulfill({ status: 201, json: { request: REQUEST } });
    }
    return route.fulfill({ json: { requests: rows } });
  });
  await page.route("**/api/v1/student/mentorship-requests/withdraw", (route) => {
    rows[0] = { ...REQUEST, status: "withdrawn", decidedAt: "2026-11-21T12:00:00.000Z" };
    return route.fulfill({ json: { requestId: REQUEST.requestId, status: "withdrawn" } });
  });
  await page.goto("/app/web/zadaci/mentorstvo");
  await expect(page.getByRole("heading", { name: s.title })).toBeVisible();
  await expect(page.getByText(s.unavailable)).toHaveCount(0);
  await expect(page.getByText(s.status.declined, { exact: true })).toBeVisible();
  await page.getByLabel(s.fieldTitle).fill(REQUEST.title);
  await page.getByRole("button", { name: s.send }).click();
  await expect(page.getByText(s.fieldTeacherRequired)).toBeVisible();
  expect(posted).toEqual([]);
  await page.getByLabel(s.fieldTeacher).selectOption(TEACHER.teacherId);
  await page.getByRole("button", { name: s.send }).click();
  await expect(page.getByText(s.sent)).toBeVisible();
  expect(posted).toEqual([{ title: REQUEST.title, workType: "bachelor_thesis", teacherId: TEACHER.teacherId }]);
  await expect(page.getByText(s.status.pending, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `${s.withdraw}: ${REQUEST.title}` }).click();
  await expect(page.getByText(s.withdrawn, { exact: true })).toBeVisible();
  await expect(page.getByText(s.status.withdrawn, { exact: true })).toBeVisible();
});

test("when the routes fail the page says unavailable, never an empty list", async ({ page }) => {
  await session(page, "student");
  await page.route("**/api/v1/student/**", (route) => route.fulfill({ status: 503, json: { code: "internal" } }));
  await page.goto("/app/web/zadaci/mentorstvo");
  await expect(page.getByText(s.unavailable)).toBeVisible();
  await expect(page.getByText(s.empty)).toHaveCount(0);
});

test("the teacher's page says the requests are unavailable and shows no success", async ({ page }) => {
  await session(page, "teacher");
  await page.route("**/api/v1/teacher/mentorships", (route) => route.fulfill({ json: { works: [] } }));
  await page.goto("/app/web/nastavnik/mentorstva");
  await expect(page.getByRole("heading", { name: "Moji studenti" })).toBeVisible();
  await expect(page.getByText(messagesHr.mentorshipRequests.unavailable)).toBeVisible();
  await expect(page.getByText("Još nemate odobrenih studenata.")).toBeVisible();
});
