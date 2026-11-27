// WEB-DIZ-S-ZAJEDNICKO (Ductus#2059 c.7214951129, A4): the browser tab reads "{naslov}, {aplikacija}",
// with a comma instead of "·", on the shell's own pages and on a path no page has (A3, 404).
// Over the fake server; invented data only.
import { expect, test } from "@playwright/test";

import { axe } from "./check";
import { fakeServer } from "./fake-server";

test("a path no page has: \"Stranica ne postoji, Ductura\" in the tab, the heading in the shell, axe clean", async ({ page }, info) => {
  await fakeServer(page, "student");
  await page.goto("/aplikacija/nema-takve-stranice");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Stranica ne postoji");
  await expect(page).toHaveTitle("Stranica ne postoji, Ductura");
  expect(await page.title()).not.toContain("·");
  await axe(page, info, "not-found");
});

test("a public page sends the comma title from the server too", async ({ page }) => {
  await fakeServer(page, null);
  await page.goto("/aplikacija/o-aplikaciji");
  await expect(page).toHaveTitle(/^.+, Ductura$/);
});
