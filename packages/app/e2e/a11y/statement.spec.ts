// WEB-1805 (M11.6, F-03), criterion 3: the accessibility statement is
// published. It is public (no session is read), carries the sections of the
// model statement the Croatian law asks for and the reference to EN 301 549,
// is reached from the shell of every role, reads in both interface languages
// and reflows at 320 px. Invented data only.
import { expect, test } from "@playwright/test";

import { messagesEn as interfaceEn } from "../../../../locales/en.ts";
import { messagesHr as interfaceHr } from "../../../../locales/hr.ts";
import { findForbiddenTerms } from "../../../../scripts/forbidden-terms/terms.ts";

import { COMPLIANCE, ENFORCEMENT_BODY, STANDARD, statementEn, statementHr } from "../../app/(host)/pristupacnost/statement";
import { fakeServer } from "./fake-server";

const SECTIONS_HR = [
  "Status usklađenosti", "Što je provjereno", "Nepristupačni sadržaj", "Priprema ove izjave",
  "Povratne informacije i podaci za kontakt", "Postupak praćenja provedbe",
];

function texts(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (node !== null && typeof node === "object") return Object.values(node).flatMap(texts);
  return [];
}

function shape(node: unknown): unknown {
  if (Array.isArray(node)) return node.length;
  if (node !== null && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, shape(v)]));
  return typeof node;
}

test("the statement opens without reading the session, with every section of the model statement", async ({ page }) => {
  const seen = await fakeServer(page, null);
  await page.goto("/aplikacija/pristupacnost");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Izjava o pristupačnosti");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(SECTIONS_HR);
  await expect(page.getByText("Narodne novine, broj 17/2019", { exact: false })).toBeVisible();
  await expect(page.getByText(STANDARD, { exact: false })).toBeVisible();
  await expect(page.getByText("djelomično je usklađena", { exact: false })).toBeVisible();
  await expect(page.getByText("Izjava je sastavljena 21. studenoga 2026.")).toBeVisible();
  await expect(page.getByRole("link", { name: ENFORCEMENT_BODY.email })).toHaveAttribute("href", `mailto:${ENFORCEMENT_BODY.email}`);
  await expect(page.getByRole("link", { name: "Na početnu" })).toHaveAttribute("href", "/aplikacija/");
  await expect(page).toHaveTitle("Izjava o pristupačnosti, Ductura");
  expect(seen.me).toBe(0);
});

test("English text, from the saved interface language", async ({ page }) => {
  await fakeServer(page, null);
  await page.addInitScript(() => localStorage.setItem("ductura.interface-locale", "en"));
  await page.goto("/aplikacija/pristupacnost");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accessibility statement");
  await expect(page.getByText("This statement was prepared on 21 November 2026.")).toBeVisible();
  await expect(page).toHaveTitle("Accessibility statement, Ductura");
});

for (const role of ["student", "teacher", "institution_admin"] as const) {
  test(`the shell of the ${role} links to the statement`, async ({ page }) => {
    await fakeServer(page, role);
    await page.goto("/aplikacija/");
    const link = page.getByRole("complementary").getByRole("link", { name: "Izjava o pristupačnosti" });
    await expect(link).toHaveAttribute("href", "/aplikacija/pristupacnost");
    await link.click();
    await expect(page).toHaveURL(/\/aplikacija\/pristupacnost$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Izjava o pristupačnosti");
  });
}

test("at 320 px the statement reflows without horizontal scrolling (WCAG 1.4.10)", async ({ page }) => {
  await fakeServer(page, null);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/aplikacija/pristupacnost");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the texts: both languages have the same sections, nothing empty, no forbidden term", () => {
  expect(shape(statementEn)).toEqual(shape(statementHr));
  for (const [lang, table] of [["hr", statementHr], ["en", statementEn]] as const) {
    for (const text of texts(table)) {
      expect(text.trim(), text).not.toBe("");
      expect(findForbiddenTerms(text, lang), text).toEqual([]);
    }
  }
  expect(statementHr.title).toBe(interfaceHr.shell.accessibilityStatement);
  expect(statementEn.title).toBe(interfaceEn.shell.accessibilityStatement);
  // Partial until the screen-reader check of every main screen is recorded (Daniel's checklist).
  expect(COMPLIANCE).toBe("partial");
  expect(statementHr.status.partial).toContain("EN 301 549");
});
