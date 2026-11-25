// ED-15 (NF2-P8, P2-10b): the proofs the mentor asked for, at the top of the Izvori card, read from
// student.source-proof-requests.get. Invented assignment, invented server: loading, an error with
// "Pokušaj ponovno", none asked, all attached and open requests with their deadline.
import { axe, hiddenFocus, setTheme } from "./a11y/check";

import { expect, test, type Page } from "./fixtures/test";

const ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c15";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d15";
const PATH = `/app/web/rad/${ID}`;

const notice = {
  assignmentId: ID, versionNo: 1, templateVersion: 1, title: "Izmišljeni esej o starim kartama",
  instructions: "Opišite izmišljenu kartu.", workType: "essay", opensAt: "2025-11-02T08:00:00.000Z",
  dueAt: "2099-12-15T22:59:00.000Z", aiPolicy: "not_allowed", aiPurposes: [], evidenceProfile: "basic",
  wordMin: 500, wordMax: 1500, readAt: null, acknowledgedAt: "2025-11-03T09:20:00.000Z",
};

const request = (n: number, closedAt: string | null, dueAt: string, instruction = `Izmišljena uputa ${n}: priložite stranicu s navodom.`) => ({
  id: `0000000${n}-1111-4222-8333-444455556666`, sourceId: `0000000${n}-aaaa-4bbb-8ccc-ddddeeeeffff`,
  instruction, dueAt, createdAt: "2026-11-20T09:00:00.000Z", closedAt,
});

type Reply = { status: number; json: unknown } | "hang";
/** What the server answers now; a test changes it, since every mount of the block reads again. */
type Answer = { now: Reply };

async function server(page: Page, answer: Answer) {
  const asked: string[] = [];
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" }, journalScope: "f".repeat(64), sessionTag: "izmisljena-oznaka-0015" },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: notice.title, dueAt: notice.dueAt, noticeFirst: false },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState: "in_progress" }] },
  }));
  await page.route(`**/api/v1/student/assignments/${ID}/notice`, (route) => route.fulfill({ json: notice }));
  await page.route(`**/api/v1/student/assignments/${ID}/source-proof-requests`, async (route) => {
    asked.push(route.request().method());
    const reply = answer.now;
    if (reply === "hang") return;
    await route.fulfill({ status: reply.status, json: reply.json });
  });
  return asked;
}

async function openSources(page: Page, now: Reply) {
  const answer: Answer = { now };
  const asked = await server(page, answer);
  await page.goto(PATH);
  await expect(page.locator('.ProseMirror[contenteditable="true"]').first()).toBeVisible({ timeout: 20_000 });
  const skip = page.getByRole("button", { name: "Preskoči vodič" });
  await skip.waitFor({ state: "visible", timeout: 5000 }).then(() => skip.click(), () => undefined);
  if ((page.viewportSize()?.width ?? 1280) <= 640) {
    const drawer = page.getByRole("button", { name: "Bočni panel" });
    await drawer.focus();
    await page.keyboard.press("Enter");
  }
  const tab = page.getByRole("tab", { name: "Izvori" });
  await tab.focus();
  await page.keyboard.press("Enter");
  const block = page.locator("[data-proof-requests]");
  await expect(block).toBeVisible({ timeout: 15_000 });
  return { block, asked, answer };
}

for (const { width, theme } of [{ width: 1280, theme: "dark" as const }, { width: 390, theme: "light" as const }]) {
  test.describe(`ED-15 Zatražene potvrde ${width} px, ${theme}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("open requests are shown first, earliest deadline first, with what to attach", async ({ page }, info) => {
      const { block } = await openSources(page, { status: 200, json: { proofRequests: [
        request(1, null, "2099-12-01T10:00:00.000Z"),
        request(2, "2026-11-21T10:00:00.000Z", "2099-11-01T10:00:00.000Z"),
        request(3, null, "2099-11-28T10:00:00.000Z"),
      ] } });
      await setTheme(page, theme);
      await expect(block.locator("summary")).toHaveText("Zatražene potvrde (2 otvorene)");
      await expect(block).toHaveAttribute("open", "");
      await expect(block.getByText("Još 2 od 3 čeka potvrdu.")).toBeVisible();
      const items = block.getByRole("listitem");
      await expect(items).toHaveCount(2);
      await expect(items.nth(0)).toContainText("Izmišljena uputa 3");
      await expect(items.nth(0)).toContainText("Rok 28. 11. 2099.");
      await expect(items.nth(1)).toContainText("Izmišljena uputa 1");
      await expect(block.getByText("radne bilješke mentora ne vidite", { exact: false })).toBeVisible();
      await axe(page, info, `proof-requests-open-${width}-${theme}`);
      expect(await hiddenFocus(page)).toEqual([]);
    });

    test("an unavailable read says so and Pokušaj ponovno asks again", async ({ page }, info) => {
      const { block, asked, answer } = await openSources(page, { status: 503, json: { error: "unavailable" } });
      await setTheme(page, theme);
      await block.locator("summary").click();
      await expect(block.getByRole("alert")).toContainText("Zahtjeve nastavnika trenutačno nije moguće dohvatiti.");
      await axe(page, info, `proof-requests-error-${width}-${theme}`);
      const before = asked.length;
      answer.now = { status: 200, json: { proofRequests: [] } };
      const retry = block.getByRole("button", { name: "Pokušaj ponovno" });
      await retry.focus();
      await page.keyboard.press("Enter");
      await expect(block.getByText("Nastavnik za sada nije zatražio potvrde.")).toBeVisible();
      expect(asked.length).toBe(before + 1);
      expect(new Set(asked)).toEqual(new Set(["GET"]));
    });
  });
}

test.describe("ED-15 Zatražene potvrde, stanja", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("while the read runs the block says it is loading", async ({ page }) => {
    const { block } = await openSources(page, "hang");
    await block.locator("summary").click();
    await expect(block.getByRole("status")).toHaveText("Učitavam zahtjeve nastavnika…");
  });

  test("all requests closed: nothing waits, the block stays closed", async ({ page }) => {
    const { block } = await openSources(page, { status: 200, json: { proofRequests: [request(1, "2026-11-21T10:00:00.000Z", "2099-11-01T10:00:00.000Z")] } });
    await expect(block.locator("summary")).toHaveText("Zatražene potvrde");
    await expect(block).not.toHaveAttribute("open", "");
    await block.locator("summary").click();
    await expect(block.getByText("Sve zatražene potvrde su priložene.")).toBeVisible();
    await expect(block.getByRole("listitem")).toHaveCount(0);
  });

  test("a deadline that has passed says so", async ({ page }) => {
    const { block } = await openSources(page, { status: 200, json: { proofRequests: [request(1, null, "2020-11-01T10:00:00.000Z")] } });
    await expect(block.getByText("Rok je istekao 1. 11. 2020.")).toBeVisible();
    await expect(block.getByText("Zatražena potvrda: izvor koji više nije u radu")).toBeVisible();
  });
});
