// F4-MEN-R03: on N-16 the mentor adds the tasks agreed at the latest consultation and ticks them
// (work.consultation-tasks.get/post, work.consultation-task-mark.post). The server is the VIZ "puno" scenario
// over the contract's vectors, with the records and tasks answered per test. Every person, text and identifier is invented.
import { axe, setTheme } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";
import { FIKSNI_DATUM } from "../test-fakes/viz-scenariji";
import { DOKUMENT_T1 } from "../test-fakes/viz-predaja";
import { generatedServer } from "./viz/server";
import { mentorPlanText } from "../src/host/teacher/mentorships/messages.hr";

const t = mentorPlanText.agreed.taskList;
const RECORD = "00000000-0000-4000-8000-00000000e7a1";
const RECORDS = { records: [{
  id: RECORD, heldOn: "2026-11-14", revision: 3, topic: "Izmišljena tema: metoda",
  agreement: "Izmišljeni dogovor: dovršiti uvod.", additions: [],
}] };
const task = (n: number, text: string, done: boolean) => ({
  id: `00000000-0000-4000-8000-00000000e7${String(n).padStart(2, "0")}`, recordId: RECORD, position: n, text, done,
  markedAt: done ? "2026-11-24T10:00:00.000Z" : null, createdAt: "2026-11-14T10:00:00.000Z",
});
const FIRST = task(1, "Izmišljeni zadatak: proširiti metodu", false);
const ADDED = task(2, "Izmišljeni zadatak: dopisati zaključak", false);

type Sent = { path: string; body: unknown };

async function serve(page: Page, add: { status: number; json: unknown }) {
  const server = generatedServer("puno");
  const sent: Sent[] = [];
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const mine = path.includes(DOKUMENT_T1);
    if (req.method() === "GET" && path.endsWith("/consultation-records")) return route.fulfill({ json: mine ? RECORDS : { records: [] } });
    if (req.method() === "GET" && path.endsWith("/consultation-tasks")) return route.fulfill({ json: { tasks: mine ? [FIRST] : [] } });
    if (req.method() === "POST" && (path.endsWith("/tasks") || path.endsWith("/mark"))) {
      const body = JSON.parse(req.postData() as string) as { done?: boolean };
      sent.push({ path, body });
      if (path.endsWith("/tasks")) return route.fulfill(add);
      return route.fulfill({ json: { ...ADDED, done: body.done, markedAt: "2026-11-25T10:00:00.000Z" } });
    }
    const result = server.answer("teacher", req.method(), path);
    if (result === "hang") return undefined;
    return route.fulfill(result);
  });
  return sent;
}

const planOf = (page: Page) => page.getByTestId("mentor-work-plan").filter({ has: page.getByText("Izmišljeni dogovor: dovršiti uvod.") });

for (const width of [1280, 390]) {
  test(`F4-MEN-R03: the mentor adds an agreed task and ticks it by keyboard (${width} px)`, async ({ page }, info) => {
    const sent = await serve(page, { status: 201, json: ADDED });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/aplikacija/nastavnik/mentorstva");
    const plan = planOf(page);
    await expect(plan).toHaveCount(1);
    await expect(plan.getByRole("heading", { name: t.title })).toBeVisible();
    await expect(plan.getByRole("checkbox", { name: FIRST.text })).not.toBeChecked();
    await expect(page.getByText("još nije moguće voditi")).toHaveCount(0);
    for (const theme of ["dark", "light"] as const) {
      await setTheme(page, theme);
      await axe(page, info, `mentorstva-zadaci-${width}-${theme}`);
    }

    await plan.getByLabel(t.field).fill("  Izmišljeni zadatak: dopisati zaključak  ");
    await plan.getByLabel(t.field).press("Enter");
    await expect(plan.getByText(t.added)).toBeVisible();
    await expect(plan.getByLabel(t.field)).toHaveValue("");
    const added = plan.getByRole("checkbox", { name: ADDED.text });
    await expect(added).not.toBeChecked();

    await added.focus();
    await page.keyboard.press("Space");
    await expect(added).toBeChecked();
    expect(sent).toEqual([
      { path: `/api/v1/works/${DOKUMENT_T1}/consultation-records/${RECORD}/tasks`, body: { text: "Izmišljeni zadatak: dopisati zaključak" } },
      { path: `/api/v1/works/${DOKUMENT_T1}/consultation-tasks/${ADDED.id}/mark`, body: { done: true } },
    ]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("F4-MEN-R03: a refused task is said as refused and the draft stays", async ({ page }) => {
  await serve(page, { status: 422, json: { error: "validation_failed", code: "validation_failed" } });
  await page.goto("/aplikacija/nastavnik/mentorstva");
  const plan = planOf(page);
  await plan.getByLabel(t.field).fill("Izmišljeni zadatak");
  await plan.getByRole("button", { name: t.add }).click();
  await expect(plan.getByText(t.invalid)).toBeVisible();
  await expect(plan.getByLabel(t.field)).toHaveValue("Izmišljeni zadatak");
  await expect(plan.getByRole("checkbox")).toHaveCount(1);
});
