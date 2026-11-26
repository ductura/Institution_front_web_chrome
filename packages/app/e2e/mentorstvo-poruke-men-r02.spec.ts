// F4-MEN-R02: on N-16 the mentor reads the messages beside each work and sends one (work.messages.get/post).
// The server is the VIZ "puno" scenario over the contract's vectors, with the messages answered per test.
// Every person, text and identifier is invented.
import { axe, setTheme } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";
import { FIKSNI_DATUM } from "../test-fakes/viz-scenariji";
import { DOKUMENT_T1 } from "../test-fakes/viz-predaja";
import { generatedServer } from "./viz/server";
import { workMessagesHr as m } from "../../../src/components/editor/mentor/messages/messages.hr";

const STUDENT_SAID = { id: "00000000-0000-4000-8000-00000000f401", senderRole: "student", text: "Izmišljeno pitanje o metodi.", createdAt: "2026-11-24T09:00:00.000Z" };
const REPLY = { id: "00000000-0000-4000-8000-00000000f402", senderRole: "teacher", text: "Izmišljeni odgovor mentora.", createdAt: "2026-11-24T10:00:00.000Z" };

type Sent = { path: string; body: unknown };

async function serve(page: Page, post: { status: number; json: unknown }) {
  const server = generatedServer("puno");
  const sent: Sent[] = [];
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path.endsWith("/messages") && path.startsWith("/api/v1/works/")) {
      if (req.method() === "GET") return route.fulfill({ json: { messages: path.includes(DOKUMENT_T1) ? [STUDENT_SAID] : [] } });
      sent.push({ path, body: JSON.parse(req.postData() as string) as unknown });
      return route.fulfill(post);
    }
    const result = server.answer("teacher", req.method(), path);
    if (result === "hang") return undefined;
    return route.fulfill(result);
  });
  return sent;
}

for (const width of [1280, 390]) {
  test(`F4-MEN-R02: the mentor reads the student's message and replies by keyboard (${width} px)`, async ({ page }, info) => {
    const sent = await serve(page, { status: 201, json: REPLY });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/app/web/nastavnik/mentorstva");
    const plan = page.getByTestId("mentor-work-plan").filter({ has: page.getByText(/Izmišljeno pitanje o metodi\./) });
    await expect(plan).toHaveCount(1);
    await plan.getByText(m.count.replace("{total}", "1")).click();
    await expect(plan.getByText("Izmišljeno pitanje o metodi.")).toBeVisible();
    for (const theme of ["dark", "light"] as const) {
      await setTheme(page, theme);
      await axe(page, info, `mentorstva-poruke-${width}-${theme}`);
    }
    await plan.getByLabel(m.label.teacher).fill("Izmišljeni odgovor mentora.");
    await plan.getByRole("button", { name: m.send }).focus();
    await page.keyboard.press("Enter");
    await expect(plan.getByText("Izmišljeni odgovor mentora.")).toBeVisible();
    expect(sent).toEqual([{ path: `/api/v1/works/${DOKUMENT_T1}/messages`, body: { text: "Izmišljeni odgovor mentora." } }]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("F4-MEN-R02: a refused message is said as refused and the draft stays", async ({ page }) => {
  await serve(page, { status: 422, json: { error: "validation_failed", code: "validation_failed" } });
  await page.goto("/app/web/nastavnik/mentorstva");
  const plan = page.getByTestId("mentor-work-plan").filter({ has: page.getByText(/Izmišljeno pitanje o metodi\./) });
  await plan.getByText(m.count.replace("{total}", "1")).click();
  await plan.getByLabel(m.label.teacher).fill("Izmišljeni odgovor.");
  await plan.getByRole("button", { name: m.send }).click();
  await expect(plan.getByText(m.rejected)).toBeVisible();
  await expect(plan.getByLabel(m.label.teacher)).toHaveValue("Izmišljeni odgovor.");
});
