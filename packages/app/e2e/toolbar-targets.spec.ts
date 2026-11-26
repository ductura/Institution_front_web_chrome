// ED-25 (NF2-P4, part): at 640 px and below every target of the student editor's toolbar is at least 44 × 44 px,
// the buttons of the bar and the menus beside it alike; wider screens keep the dense 32 px bar.
// Invented assignment, invented server.
import type { Locator } from "@playwright/test";

import { expect, test, type Page } from "./fixtures/test";

const ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c25";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d25";
const SCOPE = "c".repeat(64);
const TAG = "izmisljena-oznaka-prijave-0025";
const PATH = `/app/web/rad/${ID}`;

async function server(page: Page) {
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" }, journalScope: SCOPE, sessionTag: TAG },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: "Izmišljeni seminar o obalnim svjetionicima", dueAt: "2099-12-15T22:59:00.000Z", noticeFirst: false },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState: "in_progress" }] },
  }));
  // evidence/open: the shared fake answers with the contract's own opened work (fixtures/test).
}

async function openEditor(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await server(page);
  await page.goto(PATH);
  await expect(page.locator('.ProseMirror[contenteditable="true"]').first()).toBeVisible({ timeout: 20_000 });
}

/** The visible ones only: a tool folded into "Više" is not a target on the page. */
async function sizes(targets: Locator) {
  const out: { name: string; width: number; height: number }[] = [];
  for (const b of await targets.all()) {
    if (!(await b.isVisible())) continue;
    const box = await b.boundingBox();
    if (box) out.push({ name: (await b.getAttribute("aria-label")) ?? (await b.innerText()), width: box.width, height: box.height });
  }
  return out;
}

const barButtons = (page: Page) => page.getByRole("toolbar").first().getByRole("button");
const menuButtons = (page: Page) => page.locator('button[aria-haspopup="menu"]');

test("at 390 px every toolbar target is at least 44 × 44 px", async ({ page }) => {
  await openEditor(page, 390);
  const bar = await sizes(barButtons(page));
  const menus = await sizes(menuButtons(page));
  expect(bar.length).toBeGreaterThan(3);
  expect(menus.map((m) => m.name)).toEqual(expect.arrayContaining(["Izvezi ▾"]));
  // Half a pixel of rounding, no more.
  const small = [...bar, ...menus].filter((s) => s.width < 43.5 || s.height < 43.5);
  expect(small).toEqual([]);
});

test("at 1280 px the bar stays dense", async ({ page }) => {
  await openEditor(page, 1280);
  const bar = await sizes(barButtons(page));
  expect(bar.length).toBeGreaterThan(3);
  expect(bar.every((s) => s.height < 40)).toBe(true);
});
