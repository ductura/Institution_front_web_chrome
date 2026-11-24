// WEB-NF6-KONZ (NF-6 MK-2, MK-3): consultation slots with a topic, and "Povuci zahtjev", "Odbij" and
// "Otkaži termin" through work.consultation-slot-close.post. The student in the editor's Mentor card,
// the mentor on the work's N-12 page. The server is the VIZ "puno" scenario over the contract's vectors,
// with the slot writes answered per test. Every person, text and identifier is invented.
import { axe, setTheme } from "./a11y/check";
import { ASSIGNMENT_ID } from "./a11y/fake-server";
import { expect, test, type Page } from "./fixtures/test";
import { FIKSNI_DATUM, T1 } from "../test-fakes/viz-scenariji";
import { generatedServer } from "./viz/server";

const REQUESTED = "00000000-0000-4000-8000-00000000a7a1";
const CONFIRMED = "00000000-0000-4000-8000-00000000a7a3";
const AT = "2026-11-05T12:00:00.000Z";
const requested = {
  id: REQUESTED, startsAt: "2026-12-04T12:00:00.000Z", proposedAt: "2026-11-03T10:00:00.000Z", state: "requested",
  topic: "Izmišljena tema: metoda istraživanja", closing: null, preparation: null,
};
const confirmed = {
  id: CONFIRMED, startsAt: "2026-11-20T09:00:00.000Z", proposedAt: "2026-11-02T10:00:00.000Z", state: "confirmed",
  topic: null, closing: null, preparation: null,
};
const cancelledByStudent = {
  id: "00000000-0000-4000-8000-00000000a7a2", startsAt: "2026-11-10T09:00:00.000Z", proposedAt: "2026-11-01T10:00:00.000Z",
  state: "cancelled", topic: null, closing: { by: "student", reason: "Izmišljeni razlog: bolest.", at: "2026-11-02T11:00:00.000Z" }, preparation: null,
};
const SLOTS = { slots: [requested, confirmed, cancelledByStudent] };

type Sent = { method: string; path: string; body: unknown };
type Answers = { close?: (body: { action: string; reason?: string }, slotId: string) => { status: number; json: unknown } };

async function serve(page: Page, role: "student" | "teacher", answers: Answers = {}) {
  const server = generatedServer("puno");
  const sent: Sent[] = [];
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const body = req.postData() ? JSON.parse(req.postData() as string) as unknown : undefined;
    if (path.includes("consultation-slot")) sent.push({ method: req.method(), path, body });
    if (req.method() === "GET" && path.endsWith("/consultation-slot-details")) return route.fulfill({ json: SLOTS });
    if (req.method() === "GET" && path.endsWith("/consultation-slots")) return route.fulfill({ json: { slots: [] } });
    if (req.method() === "GET" && path.endsWith("/consultation-records")) return route.fulfill({ json: { records: [] } });
    if (req.method() === "POST" && path.endsWith("/consultation-slots")) {
      const asked = body as { startsAt: string; topic?: string };
      return route.fulfill({ status: 201, json: {
        id: "00000000-0000-4000-8000-00000000a7a9", startsAt: new Date(asked.startsAt).toISOString(), proposedAt: AT, state: "requested", topic: asked.topic ?? null,
      } });
    }
    const close = /\/consultation-slots\/([^/]+)\/close$/.exec(path);
    if (req.method() === "POST" && close && answers.close) {
      const { status, json } = answers.close(body as { action: string; reason?: string }, close[1] as string);
      return route.fulfill({ status, json });
    }
    const result = server.answer(role, req.method(), path);
    if (result === "hang") return undefined;
    return route.fulfill(result);
  });
  return sent;
}

const closedAs = (state: string, by: string) => (body: { reason?: string }, slotId: string) => {
  const slot = SLOTS.slots.find((s) => s.id === slotId) ?? requested;
  return { status: 200, json: { ...slot, state, closing: { by, reason: body.reason ?? null, at: AT } } };
};

async function skipGuide(page: Page) {
  const skip = page.getByRole("button", { name: "Preskoči vodič" });
  await skip.waitFor({ state: "visible", timeout: 5000 }).then(() => skip.click(), () => undefined);
}

/** Opens the "Mentor" tab by keyboard; on a phone first the panel's drawer. */
async function studentSlots(page: Page, width: number) {
  await page.goto(`/app/web/rad/${T1}`);
  await skipGuide(page);
  if (width <= 640) {
    await page.getByRole("button", { name: "Bočni panel" }).focus();
    await page.keyboard.press("Enter");
  }
  const tab = page.getByRole("tab", { name: "Mentor" });
  await tab.focus();
  await page.keyboard.press("Enter");
  const slots = page.locator("section[aria-labelledby='konzultacije-termini']");
  await expect(slots.getByRole("heading", { name: "Termini konzultacija · 3" })).toBeVisible();
  return slots;
}

async function teacherSlots(page: Page) {
  await page.goto(`/app/web/nastavnik/rad/${ASSIGNMENT_ID}/konzultacije`);
  const slots = page.locator("section[aria-labelledby='konzultacije-termini']");
  await expect(slots.getByRole("heading", { level: 2, name: "Termini konzultacija · 3" })).toBeVisible();
  return slots;
}

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`MK-3: the student sees the topic and the closing, and withdraws a request (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      const sent = await serve(page, "student", { close: closedAs("withdrawn", "student") });
      const slots = await studentSlots(page, width);
      await setTheme(page, theme);
      await expect(slots.getByText("Tema: Izmišljena tema: metoda istraživanja", { exact: true })).toBeVisible();
      await expect(slots.getByText("Tema nije upisana.", { exact: true }).first()).toBeVisible();
      await expect(slots.getByText(/^Zatvorili ste .+ Razlog: Izmišljeni razlog: bolest\.$/)).toBeVisible();
      // A request nobody answered is withdrawn; the confirmed slot ahead may be cancelled; the closed one has no action.
      await expect(slots.getByRole("button", { name: "Povuci zahtjev" })).toHaveCount(1);
      await expect(slots.getByRole("button", { name: "Otkaži termin" })).toHaveCount(1);
      await expect(slots.getByRole("button", { name: "Odbij" })).toHaveCount(0);
      await axe(page, info, `konzultacije-student-${width}-${theme}`);

      const withdraw = slots.getByRole("button", { name: "Povuci zahtjev" });
      await withdraw.focus();
      await page.keyboard.press("Enter");
      const confirm = slots.getByRole("group", { name: "Povući zahtjev za konzultacije?" });
      await confirm.getByLabel("Razlog (nije obavezno)").fill("Izmišljeni razlog: riješeno porukom.");
      await axe(page, info, `konzultacije-student-potvrda-${width}-${theme}`);
      await confirm.getByRole("button", { name: "Potvrdi" }).click();
      await expect(slots.getByRole("status").filter({ hasText: "Zahtjev je povučen." })).toBeVisible();
      await expect(slots.getByText("zahtjev je povučen", { exact: true })).toBeVisible();
      await expect(slots.getByRole("button", { name: "Povuci zahtjev" })).toHaveCount(0);
      const posts = sent.filter((s) => s.method === "POST");
      expect(posts.map((s) => s.body)).toEqual([{ action: "withdraw", reason: "Izmišljeni razlog: riješeno porukom." }]);
      expect(posts[0]?.path).toMatch(new RegExp(`^/api/v1/works/[^/]+/consultation-slots/${REQUESTED}/close$`));
    });
  }
}

test("MK-2, MK-3: the student asks for a slot with a topic; a too long topic is not sent", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const sent = await serve(page, "student");
  const slots = await studentSlots(page, 1280);
  await slots.getByRole("button", { name: "Zatraži konzultacije" }).click();
  await slots.getByLabel("Predloženi termin").fill("2026-11-25T13:30");
  const topic = slots.getByLabel("O čemu želite razgovarati");
  await topic.fill("a".repeat(201));
  await slots.getByRole("button", { name: "Pošalji mentoru" }).click();
  await expect(slots.getByRole("alert")).toHaveText("Tema je preduga. Skratite je na najviše 200 znakova.");
  expect(sent.filter((s) => s.method === "POST")).toEqual([]);
  await topic.fill("  Izmišljena tema: struktura poglavlja  ");
  await slots.getByRole("button", { name: "Pošalji mentoru" }).click();
  await expect(slots.getByRole("heading", { name: "Termini konzultacija · 4" })).toBeVisible();
  await expect(slots.getByText("Tema: Izmišljena tema: struktura poglavlja", { exact: true })).toBeVisible();
  const post = sent.find((s) => s.method === "POST");
  expect(post?.path).toMatch(/^\/api\/v1\/works\/[^/]+\/consultation-slots$/);
  expect((post?.body as { topic?: string }).topic).toBe("Izmišljena tema: struktura poglavlja");
});

test("MK-3: a closing the server refuses as changed says so and reads the list again", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const sent = await serve(page, "student", { close: () => ({ status: 409, json: { error: "conflict", code: "conflict" } }) });
  const slots = await studentSlots(page, 1280);
  await slots.getByRole("button", { name: "Otkaži termin" }).click();
  await slots.getByRole("group", { name: "Otkazati termin?" }).getByRole("button", { name: "Potvrdi" }).click();
  await expect(slots.getByRole("alert")).toContainText("više se ne može zatvoriti");
  await expect.poll(() => sent.filter((s) => s.method === "GET" && s.path.endsWith("/consultation-slot-details")).length).toBeGreaterThan(1);
});

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`MK-2, MK-3: the mentor answers on N-12 and declines a request (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      const sent = await serve(page, "teacher", { close: closedAs("declined", "teacher") });
      const slots = await teacherSlots(page);
      await setTheme(page, theme);
      await expect(slots.getByText("čeka Vaš odgovor", { exact: true })).toBeVisible();
      await expect(slots.getByText(/^Student je zatvorio .+ Razlog: Izmišljeni razlog: bolest\.$/)).toBeVisible();
      await expect(slots.getByRole("button", { name: "Potvrdi" })).toHaveCount(1);
      await expect(slots.getByRole("button", { name: "Predloži drugi termin" })).toHaveCount(1);
      await expect(slots.getByRole("button", { name: "Odbij" })).toHaveCount(1);
      await expect(slots.getByRole("button", { name: "Povuci zahtjev" })).toHaveCount(0);
      await axe(page, info, `konzultacije-mentor-${width}-${theme}`);

      const decline = slots.getByRole("button", { name: "Odbij" });
      await decline.focus();
      await page.keyboard.press("Enter");
      const confirm = slots.getByRole("group", { name: "Odbiti zahtjev za konzultacije?" });
      await confirm.getByRole("button", { name: "Odustani" }).focus();
      await page.keyboard.press("Enter");
      await expect(confirm).toHaveCount(0);
      await decline.click();
      await slots.getByRole("group", { name: "Odbiti zahtjev za konzultacije?" }).getByRole("button", { name: "Potvrdi" }).click();
      await expect(slots.getByRole("status").filter({ hasText: "Zahtjev je odbijen. Student vidi odgovor." })).toBeVisible();
      await expect(slots.getByText("odbijeno", { exact: true })).toBeVisible();
      expect(sent.filter((s) => s.method === "POST")).toEqual([{
        method: "POST", path: `/api/v1/works/${ASSIGNMENT_ID}/consultation-slots/${REQUESTED}/close`, body: { action: "decline" },
      }]);
    });
  }
}

test("MK-3: the mentor cancels a confirmed slot ahead", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await serve(page, "teacher", { close: closedAs("cancelled", "teacher") });
  const slots = await teacherSlots(page);
  await slots.getByRole("button", { name: "Otkaži termin" }).click();
  await slots.getByRole("group", { name: "Otkazati termin?" }).getByRole("button", { name: "Potvrdi" }).click();
  await expect(slots.getByRole("status").filter({ hasText: "Termin je otkazan. Druga strana to vidi." })).toBeVisible();
  await expect(slots.getByText(/^Zatvorili ste /)).toBeVisible();
});
