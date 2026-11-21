import { expect, test } from "@playwright/test";

test("what the student confirms on the port is all the teacher receives", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const flow = page.locator("#DeclarationFlow");
  const student = flow.locator("[data-flow=student]");
  const teacher = flow.locator("[data-flow=teacher]");

  await expect(teacher.getByText("Dopuna na čekanju")).toBeVisible();

  const required = student.getByRole("checkbox", { name: "Razgovor 1 · Lektura · 2. 11. 14:05" });
  await expect(required).toBeChecked();
  await required.click({ force: true });
  await expect(required).toBeChecked();
  await expect(student.getByRole("checkbox", { name: /^Razgovor 3/u })).not.toBeChecked();

  await student.getByRole("button", { name: "Pregledaj točne verzije razgovora koji se prilažu" }).click();
  await student.getByRole("button", { name: "Gotov pregled, natrag na izjavu" }).click();
  await student.getByRole("button", { name: "Potvrdi izjavu" }).click();
  await expect(student.getByRole("status")).toHaveText("Izjava je potvrđena.");

  await expect(teacher.getByRole("heading", { name: "Priloženi razgovori (1)" })).toBeVisible();
  await expect(teacher.getByText("Razgovor 1 · Lektura · 2. 11. 14:05").first()).toBeVisible();
  await expect(teacher.getByText(/Razgovor 3/u)).toHaveCount(0);
  await expect(teacher.getByText(/\(0\)/u)).toHaveCount(0);
});
