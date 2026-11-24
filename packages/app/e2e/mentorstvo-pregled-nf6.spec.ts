// WEB-NF6-PREGLED (NF-6 MK-11, MK-13, MK-15): "Moji studenti" on N-16 with "čeka Vas" first, and one timeline
// of a mentorship for the mentor and the student. Each screen at 1280 and 390 px, dark and light theme, axe
// and the keyboard. The server is the contract's fake (fixtures/test.ts) with the reads of this page answered
// per test. Every person, text and identifier is invented.
import { axe, hiddenFocus, setTheme } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";
import { overviewText as o } from "../src/host/teacher/mentorships/messages.hr";
import { keyDatesMessages as k } from "../src/host/teacher/key-dates/messages.hr";

const TODAY = "2026-12-01T12:00:00+01:00";
const M1 = "7f6e5d4c-3b2a-4190-8f7e-6d5c4b3a2a01";
const M2 = "7f6e5d4c-3b2a-4190-8f7e-6d5c4b3a2a02";
const M3 = "7f6e5d4c-3b2a-4190-8f7e-6d5c4b3a2a03";
const ASSIGNMENT = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e01";
const WORKS = [
  { mentorshipId: M1, assignmentId: ASSIGNMENT, documentId: "izmisljeni-rad-a", student: { givenName: "Student", familyName: "A" }, title: "Izmišljeni rad o gradu", workType: "bachelor_thesis", workState: "in_progress" },
  { mentorshipId: M2, assignmentId: ASSIGNMENT, documentId: "izmisljeni-rad-b", student: { givenName: "Student", familyName: "B" }, title: "Izmišljeni rad o rijeci", workType: "master_thesis", workState: "in_progress" },
  { mentorshipId: M3, assignmentId: ASSIGNMENT, documentId: "izmisljeni-rad-c", student: { givenName: "Student", familyName: "C" }, title: "Izmišljeni rad o mostu", workType: "bachelor_thesis", workState: "submitted" },
];
const milestone = (title: string, state: string, dueAt: string) => ({
  id: "00000000-0000-4000-8000-0000000000e1", title, description: "", dueAt, state, everSubmitted: state !== "not_submitted", submittedRevisionId: null,
  submittedAt: null, revisionComment: null, revisionDueAt: null, revisionRequestedAt: null, approvedAt: null, approvalMessage: null,
});
const DATES = { dates: [
  { kind: "milestone", id: "00000000-0000-4000-8000-0000000000d1", at: "2026-11-20T09:00:00.000Z", title: "Nacrt uvoda" },
  { kind: "deadline", id: "00000000-0000-4000-8000-0000000000d2", at: "2027-01-15T22:59:00.000Z" },
] };

async function session(page: Page, role: "student" | "teacher") {
  await page.clock.setFixedTime(new Date(TODAY));
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role, roles: [role], institution: { displayName: "Izmišljeni fakultet" }, institutionName: "Izmišljeni fakultet" },
  }));
}

async function teacher(page: Page, failReads = false) {
  await session(page, "teacher");
  await page.route("**/api/v1/teacher/mentorships", (route) => route.fulfill({ json: { works: WORKS } }));
  await page.route("**/api/v1/teacher/mentorship-requests", (route) => route.fulfill({ json: { requests: [] } }));
  await page.route("**/api/v1/mentorships/*/key-dates", (route) => route.fulfill({ json: DATES }));
  await page.route("**/api/v1/works/*/milestone-states", (route) => {
    if (failReads) return route.fulfill({ status: 503, json: { code: "unavailable" } });
    const b = route.request().url().includes("izmisljeni-rad-b");
    return route.fulfill({ json: { milestones: [b ? milestone("Prvo poglavlje", "submitted", "2026-12-10T12:00:00.000Z") : milestone("Nacrt", "not_submitted", "2026-11-28T12:00:00.000Z")] } });
  });
  await page.route("**/api/v1/works/*/consultation-slots", (route) => route.fulfill({ json: { slots: [] } }));
  await page.goto("/app/web/nastavnik/mentorstva");
  await expect(page.getByRole("heading", { name: "Radovi uz mentora" })).toBeVisible();
}

const rowsOf = (page: Page) => page.getByTestId("my-students").locator("tbody tr");

test("the mentor sees 'čeka Vas' first, then the student's turn, then submitted, and filters by work type (MK-11)", async ({ page }) => {
  await teacher(page);
  const card = page.getByTestId("my-students");
  await expect(card).toHaveAttribute("data-state", "ok");
  await expect(card.getByRole("table", { name: o.caption })).toBeVisible();
  await expect(rowsOf(page)).toHaveCount(3);
  await expect(rowsOf(page).nth(0)).toContainText("čeka Vas: etapa „Prvo poglavlje” je na pregledu");
  await expect(rowsOf(page).nth(0).getByRole("rowheader")).toContainText("Student B");
  await expect(rowsOf(page).nth(1)).toContainText("kod studenta, rok je bio prije 3 dana");
  await expect(rowsOf(page).nth(2)).toContainText(o.submitted);
  await card.getByLabel(o.filter).selectOption("master_thesis");
  await expect(rowsOf(page)).toHaveCount(1);
  await card.getByLabel(o.filter).selectOption("doctoral_thesis");
  await expect(card.getByText(o.emptyFilter)).toBeVisible();
  // MK-13: the mentor's timeline of each mentorship, split at today.
  const line = page.getByTestId("key-dates").first();
  await expect(line.getByRole("heading", { name: k.past })).toBeVisible();
  await expect(line.getByText("Danas je 1. 12. 2026.")).toBeVisible();
  await expect(line.getByText("(za 45 dana)")).toBeVisible();
});

test("when the reads fail the works list stays and the card says so with a retry (MK-11)", async ({ page }) => {
  await teacher(page, true);
  await expect(page.getByTestId("mentored-work")).toHaveCount(3);
  await expect(page.getByText(o.unavailable)).toBeVisible();
  await expect(page.getByTestId("my-students").getByRole("button", { name: o.retry })).toBeVisible();
  await expect(page.getByTestId("my-students").locator("table")).toHaveCount(0);
});

test("the student sees the same timeline for an approved mentorship (MK-13)", async ({ page }) => {
  await session(page, "student");
  await page.route("**/api/v1/student/mentor-candidates", (route) => route.fulfill({ json: { candidates: [] } }));
  await page.route("**/api/v1/student/mentorship-requests", (route) => route.fulfill({ json: { requests: [{
    requestId: "00000000-0000-4000-8000-000000000001", teacherId: "10000000-0000-4000-8000-000000000001", teacherName: { givenName: "Marko", familyName: "Izmišljeni" },
    workType: "bachelor_thesis", requestedAt: "2026-11-01T10:00:00.000Z", state: "approved", endedAt: "2026-11-02T10:00:00.000Z", mentorshipId: M1,
  }] } }));
  await page.route("**/api/v1/mentorships/*/key-dates", (route) => route.fulfill({ json: DATES }));
  await page.goto("/app/web/zadaci/mentorstvo");
  const line = page.getByTestId("key-dates");
  await expect(line.getByRole("heading", { name: k.forMentor("Marko Izmišljeni") })).toBeVisible();
  await expect(line.locator('ol[data-list="past"] li')).toHaveText(["Etapa „Nacrt uvoda”: 20. 11. 2026. u 10:00 (prije 11 dana)"]);
  await expect(line.locator('ol[data-list="ahead"] li')).toHaveText(["Rok predaje: 15. 1. 2027. u 23:59 (za 45 dana)"]);
});

for (const width of [1280, 390]) {
  for (const theme of ["dark", "light"] as const) {
    test(`MK-15: N-16 with Moji studenti and the student's timeline at ${width} px, ${theme}: axe, focus, no sideways scroll`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await teacher(page);
      await expect(page.getByTestId("my-students")).toHaveAttribute("data-state", "ok");
      await setTheme(page, theme);
      await axe(page, info, `n16-${width}-${theme}`);
      expect(await hiddenFocus(page, 60)).toEqual([]);
      // The table scrolls inside its own focusable region; the page itself never scrolls sideways.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.locator("html")).toHaveAttribute("lang", "hr");
    });
  }
}

test("MK-15: the filter and the work links are reached with the keyboard alone", async ({ page }) => {
  await teacher(page);
  await expect(page.getByTestId("my-students")).toHaveAttribute("data-state", "ok");
  const filter = page.getByTestId("my-students").getByLabel(o.filter);
  await filter.focus();
  await page.keyboard.press("ArrowDown");
  await expect(filter).not.toHaveValue("");
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("my-students").getByRole("region", { name: o.caption })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveAttribute("href", /\/app\/web\/nastavnik\/rad\//);
});
