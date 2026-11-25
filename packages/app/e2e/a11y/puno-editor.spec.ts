// ED-02 (NF2-P22, P2-25): in the VIZ "puno" scenario the student's work opens in the editor,
// ready for writing, not in the "Rad trenutačno nije moguće otvoriti" sheet. Invented data only.
import { expect, test } from "@playwright/test";

import { otvori } from "../viz/otvori";
import { ASSIGNMENT_ID } from "./fake-server";
import type { Screen } from "./screens";

const WORK: Screen = { name: "student: rad", path: `/rad/${ASSIGNMENT_ID}`, role: "student" };

test("puno: the work opens in the editor, ready for writing", async ({ page }) => {
  await otvori(page, WORK, "puno");
  await expect(page.locator('.ProseMirror[contenteditable="true"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Rad trenutačno nije moguće otvoriti")).toHaveCount(0);
  await expect(page.getByRole("alert").filter({ hasText: /otvoriti/ })).toHaveCount(0);
});
