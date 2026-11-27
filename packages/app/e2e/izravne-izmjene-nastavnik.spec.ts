// PM2-R04 (M6.4): the teacher's "Izravne izmjene" card on the live work page. The setting is read from
// work.direct-edit.get; the server has no route for the teacher's text yet (TODO(ugovor)), so the field stays
// closed and says so. Every person, text and identifier is invented.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "./fixtures/test";
import type * as ContractVectors from "../../../src/client/migration-contract-vectors.generated.json";

const documentId = "00000000-0000-4000-8000-0000000000d1";
const vectors = JSON.parse(readFileSync(
  new URL("../../../src/client/migration-contract-vectors.generated.json", import.meta.url), "utf8",
)) as typeof ContractVectors;
const profile = vectors.find((v) => v.route === "profile.me.get" && v.name === "teacher-without-name")!.response.body;

async function teacher(page: Page, setting: { status: number; json: unknown }) {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    switch (path) {
      case "/api/v1/me": return route.fulfill({ json: { ...profile, roles: ["teacher"] } });
      case "/api/v1/teacher/access": return route.fulfill({ json: { access: "allowed", scope: "a".repeat(64) } });
      case "/api/v1/profile/interface-locale": return route.fulfill({ json: { locale: null } });
      case `/api/v1/works/${documentId}/direct-edit`: return route.fulfill(setting);
      default: return route.fallback();
    }
  });
}

const card = (page: Page) => page.getByRole("region", { name: "Izravne izmjene" });

test("PM2-R04: the student allowed direct edits, the teacher sees it but cannot type yet", async ({ page }) => {
  await teacher(page, { status: 200, json: { mode: "direct", changedAt: "2026-11-20T09:00:00.000Z", record: [] } });
  await page.goto(`/aplikacija/nastavnik/rad/${documentId}`);
  await expect(card(page).getByText("Student je dopustio izravne izmjene.", { exact: false })).toBeVisible();
  await expect(card(page).getByText("Spremanje izravnih izmjena još nije dostupno.", { exact: false })).toBeVisible();
  await expect(card(page).getByRole("textbox")).toHaveCount(0);
});

test("PM2-R04: direct edits not allowed, the card says it is locked", async ({ page }) => {
  await teacher(page, { status: 200, json: { mode: "suggestions", changedAt: null, record: [] } });
  await page.goto(`/aplikacija/nastavnik/rad/${documentId}`);
  await expect(card(page).getByText("Student nije dopustio izravne izmjene ovog rada.", { exact: false })).toBeVisible();
  await expect(card(page).getByRole("textbox")).toHaveCount(0);
});

test("PM2-R04: an unreadable setting locks the field and offers a retry, never an open field", async ({ page }) => {
  await teacher(page, { status: 503, json: { error: "unavailable" } });
  await page.goto(`/aplikacija/nastavnik/rad/${documentId}`);
  await expect(card(page).getByText("trenutačno nije moguće provjeriti", { exact: false })).toBeVisible();
  await expect(card(page).getByRole("button", { name: "Pokušaj ponovno" })).toBeVisible();
  await expect(card(page).getByRole("textbox")).toHaveCount(0);
});
