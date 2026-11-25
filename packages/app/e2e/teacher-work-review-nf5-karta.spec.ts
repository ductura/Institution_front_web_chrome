// WEB-NF5-KARTA (NF-5 PG-2): "Tekst rada s oznakama podrijetla" in the tab Podrijetlo of "Pregled rada", against a
// fake institution server. Invented work, student, course and text only; no request leaves the browser.
import { readFileSync } from "node:fs";

import { expect, test, type Page } from "./fixtures/test";

import type ContractVectors from "../../../src/client/migration-contract-vectors.generated.json";

import { axe, setTheme } from "./a11y/check";
import { markedTextMessages as t } from "../src/host/teacher/provenance/text-messages.hr";

const vectors = JSON.parse(readFileSync(
  new URL("../../../src/client/migration-contract-vectors.generated.json", import.meta.url), "utf8",
)) as typeof ContractVectors;
const profile = vectors.find((v) => v.route === "profile.me.get" && v.name === "teacher-without-name")!.response.body;
const documentId = "rad-izmisljeni-karta";
const assignmentId = "00000000-0000-4000-8000-0000000000a1";
const studentId = "00000000-0000-4000-8000-0000000000e1";
const review = `/app/web/nastavnik/rad/${documentId}/pregled?kartica=podrijetlo`;
const H1 = "00000000-0000-4000-8000-0000000000b1";
const P1 = "00000000-0000-4000-8000-0000000000b2";
const P2 = "00000000-0000-4000-8000-0000000000b3";
const PASTED = "Na izborima u Gradu A natjecalo se pet lista.";
const FROM_ASSISTANT = "Prvi pristup naglašava pravila, drugi interese.";
const DOC = { schemaVersion: 3, sources: [], nodes: [
  { type: "heading", id: H1, level: 1, children: [{ type: "text", text: "1. Uvod", marks: [] }] },
  { type: "paragraph", id: P1, children: [{ type: "text", text: `Lokalni mediji imaju dvostruku ulogu. ${PASTED}`, marks: [] }] },
  { type: "paragraph", id: P2, children: [{ type: "text", text: `${FROM_ASSISTANT} Ostatak odlomka.`, marks: [] }] },
] };
const START = Array.from("Lokalni mediji imaju dvostruku ulogu. ").length;
const SEGMENTS = { revision: 3, segments: [
  { blockId: P1, start: 0, end: START, kind: "typed", segmentRef: null },
  { blockId: P1, start: START, end: START + Array.from(PASTED).length, kind: "pasted_unknown", segmentRef: null },
  { blockId: P2, start: 0, end: Array.from(FROM_ASSISTANT).length, kind: "assistant_inserted", segmentRef: "odsjecak-1" },
] };

async function fakeServer(page: Page, segmentsFail = false) {
  let fail = segmentsFail;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    switch (path) {
      case "/api/v1/me": return route.fulfill({ json: { ...profile, roles: ["teacher"] } });
      case "/api/v1/teacher/access": return route.fulfill({ json: { access: "allowed", scope: "a".repeat(64) } });
      case "/api/v1/profile/interface-locale": return route.fulfill({ json: { locale: null } });
      case "/api/v1/teacher/courses": return route.fulfill({ json: { courses: [] } });
      case `/api/v1/teacher/works/${documentId}`: return route.fulfill({ json: {
        documentId, studentId, studentName: "Student A", assignmentId, state: "nije_predano", prevDocumentId: null, nextDocumentId: null,
      } });
      case `/api/v1/teacher/assignments/${assignmentId}/grade`: return route.fulfill({ json: { eligible: true } });
      case `/api/v1/works/${documentId}/origin-composition`: return route.fulfill({ json: { parts: [
        { kind: "typed", percent: 70 }, { kind: "assistant_inserted", percent: 15 }, { kind: "assistant_match", percent: 0 },
        { kind: "imported_file", percent: 0 }, { kind: "pasted_known", percent: 0 }, { kind: "pasted_unknown", percent: 15 },
      ] } });
      case `/api/v1/works/${documentId}/assistant-match`: return route.fulfill({ json: { findings: [] } });
      case `/api/v1/works/${documentId}/origin-segments`: return fail
        ? route.fulfill({ status: 503, json: { code: "unavailable" } }) : route.fulfill({ json: SEGMENTS });
      case `/api/v1/works/${documentId}/versions/3`: return route.fulfill({ json: { revision: 3, document: JSON.stringify(DOC) } });
      default: return route.fallback();
    }
  });
  return { recover: () => { fail = false; } };
}

const sheet = (page: Page) => page.locator("[data-marked-text] [data-map-text]");

test("PG-2: the text of the work carries every mark in words next to its line; who typed is not known", async ({ page }) => {
  await fakeServer(page);
  await page.goto(review);
  await expect(page.getByRole("heading", { name: t.heading })).toBeVisible();
  await expect(page.getByText(t.revision(3))).toBeVisible();
  await expect(sheet(page).locator('[data-kind="pasted_unknown"]')).toHaveText(PASTED);
  await expect(sheet(page).getByText(t.markLabel("pasted_unknown", 1))).toBeVisible();
  await expect(sheet(page).getByText(t.markLabel("assistant_inserted", 2))).toBeVisible();
  await expect(page.locator("[data-marked-text]").getByText(t.whoTyped)).toBeVisible();
  await expect(page.locator("[data-marked-text]")).toContainText(t.notProof);
  const table = page.getByRole("table", { name: t.tableCaption });
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table).toContainText(t.place(2));
});

test("PG-2: „Sljedeće lijepljenje ili prijenos” moves the focus mark by mark from the keyboard", async ({ page }) => {
  await fakeServer(page);
  await page.goto(review);
  const next = page.getByRole("button", { name: t.next });
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(sheet(page).locator('[data-kind="pasted_unknown"]')).toBeFocused();
  await expect(page.locator("[data-mark-status]")).toHaveText(t.markStatus(1, 2, "pasted_unknown"));
  await next.focus();
  await page.keyboard.press("Space");
  await expect(sheet(page).locator('[data-kind="assistant_inserted"]')).toBeFocused();
  await next.click();
  await expect(sheet(page).locator('[data-kind="pasted_unknown"]')).toBeFocused();
});

test("PG-2: with „Podrijetlo teksta” off the words and lines go, the step is off, the list stays", async ({ page }) => {
  await fakeServer(page);
  await page.goto(review);
  await expect(sheet(page).getByText(t.markLabel("pasted_unknown", 1))).toBeVisible();
  await page.locator('input[data-sw="origin"]').uncheck();
  await expect(sheet(page)).toHaveAttribute("data-origin", "off");
  await expect(sheet(page).getByText(t.markLabel("pasted_unknown", 1))).toBeHidden();
  await expect(page.getByRole("button", { name: t.next })).toBeDisabled();
  await expect(page.getByRole("table", { name: t.tableCaption }).getByRole("row")).toHaveCount(3);
});

test("PG-2: a failed read of the ranges is an error with a retry, never a text without marks", async ({ page }) => {
  const server = await fakeServer(page, true);
  await page.goto(review);
  await expect(page.getByText(t.unavailable)).toBeVisible();
  await expect(page.locator("[data-marked-text]")).toHaveCount(0);
  server.recover();
  await page.locator("[data-nf5], section").getByRole("button", { name: t.retry }).first().click();
  await expect(sheet(page).locator('[data-kind="pasted_unknown"]')).toHaveText(PASTED);
});

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`PG-2 axe: the marked text at ${width} px, ${theme} theme`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await fakeServer(page);
      await page.goto(review);
      await expect(sheet(page)).toBeVisible();
      await setTheme(page, theme);
      await axe(page, info, `pregled-nf5-karta-${width}-${theme}`);
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(scroll).toBeLessThanOrEqual(0);
    });
  }
}
