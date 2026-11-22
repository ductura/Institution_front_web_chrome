import { expect, test, type Page } from "./fixtures/test";

import { mentorshipRequestText as s } from "../src/host/student/mentorship-request/messages.hr";
import { messagesHr } from "../../../src/lib/i18n/messages.hr";

// WEB-1404: the mentorship pages in the host with an invented /api/v1. WEB-2002 spojio
// studentsku stranicu na rute ugovora (mentorship.*); the teacher's decision still has no route in the
// client (TODO(ugovor)) and says "unavailable". The whole flow is held by the unit tests
// over the invented server (fake-port.ts).
async function session(page: Page, role: "student" | "teacher") {
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role, roles: [role], institution: { displayName: "Izmišljeni fakultet" }, institutionName: "Izmišljeni fakultet" },
  }));
}

const TEACHER = { teacherId: "10000000-0000-4000-8000-000000000001", name: { givenName: "Marko", familyName: "Izmišljeni" }, department: null };
const REQUEST = {
  requestId: "00000000-0000-4000-8000-000000000001", workType: "bachelor_thesis", teacherId: TEACHER.teacherId,
  teacherName: TEACHER.name, state: "requested", requestedAt: "2026-11-21T10:00:00.000Z", endedAt: null, mentorshipId: null,
};

test("the student picks a teacher, sends a request, sees a declined one as declined and withdraws a pending one", async ({ page }) => {
  await session(page, "student");
  const rows: Array<Record<string, unknown>> = [{
    ...REQUEST, requestId: "00000000-0000-4000-8000-000000000002", state: "declined", endedAt: "2026-11-21T11:00:00.000Z",
  }];
  const posted: unknown[] = [];
  await page.route("**/api/v1/student/mentor-candidates", (route) => route.fulfill({ json: { candidates: [TEACHER] } }));
  await page.route("**/api/v1/student/mentorship-requests", (route) => route.fulfill({ json: { requests: rows } }));
  await page.route("**/api/v1/mentorship-requests", (route) => {
    posted.push(route.request().postDataJSON());
    rows.unshift(REQUEST);
    return route.fulfill({ status: 201, json: { requestId: REQUEST.requestId, state: "requested" } });
  });
  await page.route("**/api/v1/mentorship-requests/*/withdraw", (route) => {
    rows[0] = { ...REQUEST, state: "withdrawn", endedAt: "2026-11-21T12:00:00.000Z" };
    return route.fulfill({ json: { requestId: REQUEST.requestId, state: "withdrawn" } });
  });
  await page.goto("/app/web/zadaci/mentorstvo");
  await expect(page.getByRole("heading", { name: s.title })).toBeVisible();
  await expect(page.getByText(s.unavailable)).toHaveCount(0);
  await expect(page.getByText(s.status.declined, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: s.send }).click();
  await expect(page.getByText(s.fieldTeacherRequired)).toBeVisible();
  expect(posted).toEqual([]);
  await page.getByLabel(s.fieldTeacher).selectOption(TEACHER.teacherId);
  await page.getByRole("button", { name: s.send }).click();
  await expect(page.getByText(s.sent)).toBeVisible();
  expect(posted).toEqual([{ workType: "bachelor_thesis", teacherId: TEACHER.teacherId }]);
  await expect(page.getByText(s.status.requested, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `${s.withdraw}: ${s.workTypes.bachelor_thesis}` }).click();
  await expect(page.getByText(s.withdrawn, { exact: true })).toBeVisible();
  await expect(page.getByText(s.status.withdrawn, { exact: true })).toBeVisible();
});

test("when the routes fail the page says unavailable, never an empty list", async ({ page }) => {
  await session(page, "student");
  await page.route("**/api/v1/student/**", (route) => route.fulfill({ status: 503, json: { code: "internal" } }));
  await page.route("**/api/v1/mentorship-requests/**", (route) => route.fulfill({ status: 503, json: { code: "internal" } }));
  await page.goto("/app/web/zadaci/mentorstvo");
  await expect(page.getByText(s.unavailable)).toBeVisible();
  await expect(page.getByText(s.empty)).toHaveCount(0);
});

test("the teacher's page says the requests are unavailable and shows no success", async ({ page }) => {
  await session(page, "teacher");
  await page.route("**/api/v1/teacher/mentorships", (route) => route.fulfill({ json: { works: [] } }));
  await page.route("**/api/v1/teacher/mentorship-requests", (route) => route.fulfill({ status: 503, json: { code: "unavailable" } }));
  await page.goto("/app/web/nastavnik/mentorstva");
  await expect(page.getByRole("heading", { name: "Moji studenti" })).toBeVisible();
  await expect(page.getByText(messagesHr.mentorshipRequests.unavailable)).toBeVisible();
  await expect(page.getByText("Još nemate odobrenih studenata.")).toBeVisible();
});
