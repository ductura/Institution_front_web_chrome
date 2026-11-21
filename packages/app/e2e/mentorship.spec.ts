import { expect, test, type Page } from "@playwright/test";

import { mentorshipRequestText as s } from "../src/host/student/mentorship-request/messages.hr";
import { messagesHr } from "../../../src/lib/i18n/messages.hr";

// WEB-1404: the mentorship pages in the host with an invented /api/v1. The routes of a
// request are not in the contract yet (TODO(ugovor)), so the client does not call them and
// both pages say "unavailable"; the flow itself (request → approval → list, decline,
// withdrawal) is held by the unit tests over the invented server (fake-port.ts).
async function session(page: Page, role: "student" | "teacher") {
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role, roles: [role], institution: { displayName: "Izmišljeni fakultet" }, institutionName: "Izmišljeni fakultet" },
  }));
}

test("the student's request page says unavailable, never an empty list, and sends nothing", async ({ page }) => {
  await session(page, "student");
  const sent: string[] = [];
  page.on("request", (request) => { if (request.method() === "POST" && request.url().includes("/api/v1/")) sent.push(request.url()); });
  await page.goto("/app/web/zadaci/mentorstvo");
  await expect(page.getByRole("heading", { name: s.title })).toBeVisible();
  await expect(page.getByText(s.unavailable)).toBeVisible();
  await expect(page.getByText(s.empty)).toHaveCount(0);
  await page.getByLabel(s.fieldTitle).fill("Izmišljeni naslov");
  await page.getByRole("button", { name: s.send }).click();
  await expect(page.getByText(s.sent)).toHaveCount(0);
  expect(sent).toEqual([]);
});

test("the teacher's page says the requests are unavailable and shows no success", async ({ page }) => {
  await session(page, "teacher");
  await page.route("**/api/v1/teacher/mentorships", (route) => route.fulfill({ json: { works: [] } }));
  await page.goto("/app/web/nastavnik/mentorstva");
  await expect(page.getByRole("heading", { name: "Moji studenti" })).toBeVisible();
  await expect(page.getByText(messagesHr.mentorshipRequests.unavailable)).toBeVisible();
  await expect(page.getByText("Još nemate odobrenih studenata.")).toBeVisible();
});
