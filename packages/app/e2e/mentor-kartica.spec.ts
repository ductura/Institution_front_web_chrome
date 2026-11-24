// WEB-NUZ-MENTOR-1 (NF-6 MK-1): the whole Mentor card in the "Mentor" tab of the editor's right panel,
// and on a phone in the panel's drawer. The server is the VIZ "puno" scenario over the contract's vectors,
// with the card's reads answered per test. Every person, course, text and identifier is invented.
import { axe, setTheme } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";
import { FIKSNI_DATUM, T1 } from "../test-fakes/viz-scenariji";
import { generatedServer } from "./viz/server";

const MESSAGES = { messages: [{ id: "00000000-0000-4000-8000-0000000000a1", senderRole: "teacher", text: "Izmišljena poruka mentora.", createdAt: "2026-11-04T10:00:00.000Z" }] };
const MILESTONES = { milestones: [
  { id: "00000000-0000-4000-8000-0000000000b1", title: "Izmišljena etapa: plan rada", description: "", dueAt: "2026-11-02T10:00:00.000Z", state: "approved" },
  { id: "00000000-0000-4000-8000-0000000000b2", title: "Izmišljena etapa: prvo poglavlje", description: "", dueAt: "2026-11-09T10:00:00.000Z", state: "open" },
] };

type Answers = { requests?: unknown; failMessages?: boolean };

async function student(page: Page, answers: Answers = {}) {
  const server = generatedServer("puno");
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === "POST" && path.endsWith("/revision-requests/list")) return route.fulfill({ json: answers.requests ?? { requests: [] } });
    if (req.method() === "GET" && path.endsWith("/messages")) {
      return answers.failMessages ? route.fulfill({ status: 503, json: { error: "unavailable" } }) : route.fulfill({ json: MESSAGES });
    }
    if (req.method() === "GET" && path.endsWith("/milestones")) return route.fulfill({ json: MILESTONES });
    if (req.method() === "GET" && path.endsWith("/consultation-slots")) return route.fulfill({ json: { slots: [] } });
    const result = server.answer("student", req.method(), path);
    if (result === "hang") return undefined;
    return route.fulfill(result);
  });
}

async function skipGuide(page: Page) {
  const skip = page.getByRole("button", { name: "Preskoči vodič" });
  await skip.waitFor({ state: "visible", timeout: 5000 }).then(() => skip.click(), () => undefined);
}

/** Opens the "Mentor" tab by keyboard; on a phone first the panel's drawer. */
async function openMentor(page: Page, width: number) {
  if (width <= 640) {
    const drawer = page.getByRole("button", { name: "Bočni panel" });
    await drawer.focus();
    await page.keyboard.press("Enter");
  }
  const tab = page.getByRole("tab", { name: "Mentor" });
  await tab.focus();
  await expect(tab).toBeFocused();
  await page.keyboard.press("Enter");
  return page.locator("[data-mentor-card]");
}

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`MK-1: the whole Mentor card in the editor's Mentor tab (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await student(page);
      await page.goto(`/app/web/rad/${T1}`);
      await setTheme(page, theme);
      await skipGuide(page);
      const card = await openMentor(page, width);
      await expect(card.getByRole("heading", { name: "Mentor", exact: true })).toBeVisible();
      // Stanje rada: no request ever, so the work is with the student; the next stage from the server.
      await expect(card.getByText("Rad je kod Vas", { exact: true })).toBeVisible();
      await expect(card.getByText("Sljedeća etapa: Izmišljena etapa: prvo poglavlje", { exact: false })).toBeVisible();
      // The mentor's message after the student's last one is new.
      await expect(card.getByText("Mentor: 1 novo", { exact: true })).toBeVisible();
      // The consultations live inside the card; what the server does not give says so.
      await expect(card.locator("[data-consult-panel]")).toBeVisible();
      await card.getByText("Kako mentor radi", { exact: true }).click();
      await expect(card.getByText("Ovaj podatak trenutačno nije dostupan.", { exact: true })).toBeVisible();
      await axe(page, info, `mentor-kartica-${width}-${theme}`);
    });
  }
}

test("MK-1: an open revision request says dorada with the mentor's instruction", async ({ page }) => {
  const nulls = Object.fromEntries(["response_kind", "response_explanation", "response_revision", "response_is_own", "response_window",
    "closed_as", "closed_is_own", "closed_window", "accepted_revision", "accepted_range_hash"].map((k) => [k, null]));
  const row = {
    ...nulls, request_id: "00000000-0000-4000-8000-0000000000c1", request_state: "open", request_version: 1, request_row_seq: 1,
    version: 1, instruction: "Izmišljena uputa: dopunite prvo poglavlje.", requested_revision: 1, opened_is_own: false,
    opened_window: "2026-11-03T10:00:00.000Z",
    anchor: { nodeId: "00000000-0000-4000-8000-0000000000d1", quote: "izmišljeni", prefix: "", suffix: "", startHint: 0, endHint: 10 },
  };
  await page.setViewportSize({ width: 1280, height: 900 });
  await student(page, { requests: { requests: [row] } });
  await page.goto(`/app/web/rad/${T1}`);
  await skipGuide(page);
  const card = await openMentor(page, 1280);
  await expect(card.getByText("Rad je kod Vas: dorada", { exact: true })).toBeVisible();
  await expect(card.getByText("Izmišljena uputa: dopunite prvo poglavlje.", { exact: true })).toBeVisible();
  await expect(card.getByText(/1 obvezni komentar otvoren/)).toBeVisible();
});

test("MK-1: a revision list the client cannot read says the state is unavailable, never a guess", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await student(page, { requests: { requests: [{ request_id: "nije-ispravno" }] } });
  await page.goto(`/app/web/rad/${T1}`);
  await skipGuide(page);
  const card = await openMentor(page, 1280);
  await expect(card.getByText("Stanje rada trenutačno nije dostupno.", { exact: true })).toBeVisible();
});

test("MK-1: a message read that fails leaves no badge and keeps the rest of the card", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await student(page, { failMessages: true });
  await page.goto(`/app/web/rad/${T1}`);
  await skipGuide(page);
  const card = await openMentor(page, 1280);
  await expect(card.getByText("Rad je kod Vas", { exact: true })).toBeVisible();
  await expect(card.getByText(/^Mentor: \d+ novo$/)).toHaveCount(0);
});
