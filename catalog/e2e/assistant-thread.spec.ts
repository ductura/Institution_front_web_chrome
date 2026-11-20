import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const thread = "#AssistantThread";
const demoAddress = "demo-student@example.invalid";

test("shows a plain-text conversation, accepts multiline input and announces the reply", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const states = page.locator(thread).locator("dd");
  const example = states.first();
  const log = example.getByRole("log", { name: "Razgovor s pomoćnikom" });
  const field = example.getByRole("textbox", { name: "Poruka pomoćniku" });
  const send = example.getByRole("button", { name: "Pošalji pomoćniku" });
  const waiting = states.nth(1);
  await expect(waiting.getByRole("status")).toHaveText("Pomoćnik odgovara…");
  await expect(waiting.getByRole("textbox")).not.toBeEditable();
  await expect(waiting.getByRole("button")).toBeDisabled();
  await expect(log).toHaveText("Još nema poruka.");
  await field.fill("  ");
  await expect(send).toBeDisabled();
  await field.fill("Izmišljeno pitanje");
  await field.press("Enter");
  await expect(field).toHaveValue("Izmišljeno pitanje\n");
  await expect(log).toHaveText("Još nema poruka.");
  await field.fill("Izmišljeno pitanje\n<b>Primjer</b>");
  await send.press("Enter");
  await expect(log.getByRole("listitem")).toHaveCount(2);
  expect(await log.locator("li p").first().textContent()).toBe("Izmišljeno pitanje\n<b>Primjer</b>");
  await expect(log.locator("b")).toHaveCount(0);
  await expect(log.getByRole("listitem").last()).toContainText("Pomoćnik");
  await expect(example.getByRole("status")).toBeEmpty();
  await expect(field).toBeEditable();
  await expect(field).toBeFocused();
});

for (const confirm of ["Ukloni ih i pošalji", "Pošalji svejedno"]) {
  test(`reviews a demo address before sending, then selects ${confirm}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto(confirm === "Pošalji svejedno" ? "/?theme=light" : "/", { waitUntil: "domcontentloaded" });
    const example = page.locator(thread).locator("dd").first();
    const log = example.getByRole("log");
    const field = example.getByRole("textbox");
    const send = example.getByRole("button", { name: "Pošalji pomoćniku" });
    const warning = example.getByRole("group", { name: "U tekstu su osobni podaci" });
    await field.fill(`Probni kontakt: ${demoAddress}`);
    await send.press("Enter");
    await expect(warning.locator("[tabindex='-1']")).toBeFocused();
    await expect(warning).toContainText("E-adresa");
    await expect(log.getByRole("listitem")).toHaveCount(0);
    const axe = await new AxeBuilder({ page }).include(`${thread} [role="group"]`).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(axe.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([]);

    await warning.getByRole("button", { name: "Odustani" }).press("Enter");
    await expect(field).toBeFocused();
    await expect(field).toHaveValue(`Probni kontakt: ${demoAddress}`);
    await expect(log.getByRole("listitem")).toHaveCount(0);
    await send.press("Enter");
    await warning.getByRole("button", { name: confirm }).press("Enter");
    const sent = confirm === "Pošalji svejedno" ? demoAddress : "[uklonjeno]";
    await expect(log.getByRole("listitem").first()).toContainText(`Probni kontakt: ${sent}`);
    if (sent !== demoAddress) await expect(log).not.toContainText(demoAddress);
  });
}
