// WEB-NF6-RUNDA (NF-6 MK-8, MK-9, MK-10): "Što je mentor rekao", "Samo za Vas" (Poruka sebi, Dokle sam stao)
// and "Priprema za konzultacije" in the student's Mentor tab, and "Pregled runde" on the mentor's N-16.
// The server is the VIZ "puno" scenario over the contract's vectors, with the reads of these items answered
// per test. Every person, course, text and identifier is invented.
import { axe, setTheme } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";
import { FIKSNI_DATUM, T1 } from "../test-fakes/viz-scenariji";
import { generatedServer } from "./viz/server";

const RETURN = {
  id: "00000000-0000-4000-8000-0000000000e1", targetId: "00000000-0000-4000-8000-0000000000e2", documentId: "",
  comment: "Izmišljena napomena: dopunite zaključak jednim izvorom.", revisionDueAt: "2026-11-08T22:59:59.000Z",
  createdAt: "2026-11-04T10:00:00.000Z", readAt: null,
};
const RECORD = { id: "00000000-0000-4000-8000-0000000000f1", heldOn: "2026-11-02", revision: 2, topic: "Izmišljena tema", agreement: "", additions: [] };
const PLACE = { place: { nodeId: "00000000-0000-4000-8000-0000000000d1", offset: 0 }, updatedAt: "2026-11-03T10:00:00.000Z" };

async function student(page: Page, posted: unknown[], failReturns = false) {
  const server = generatedServer("puno");
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === "POST" && path.endsWith("/revision-requests/list")) return route.fulfill({ json: { requests: [] } });
    if (req.method() === "GET" && path.endsWith("/notifications/returned-for-revision")) {
      return failReturns ? route.fulfill({ status: 503, json: { error: "unavailable" } })
        : route.fulfill({ json: { notifications: [{ ...RETURN, documentId: "SVAKI" }], nextBefore: null } });
    }
    if (req.method() === "GET" && path.endsWith("/messages")) return route.fulfill({ json: { messages: [] } });
    if (req.method() === "POST" && path.endsWith("/messages")) {
      const body = req.postDataJSON() as { text: string };
      posted.push(body.text);
      return route.fulfill({ status: 201, json: { id: "00000000-0000-4000-8000-0000000000a9", senderRole: "student", text: body.text, createdAt: "2026-11-05T22:00:00.000Z" } });
    }
    if (req.method() === "GET" && path.endsWith("/milestones")) return route.fulfill({ json: { milestones: [] } });
    if (req.method() === "GET" && path.endsWith("/consultation-slots")) return route.fulfill({ json: { slots: [] } });
    if (req.method() === "GET" && path.endsWith("/consultation-records")) return route.fulfill({ json: { records: [RECORD] } });
    if (req.method() === "GET" && path.endsWith("/versions")) {
      return route.fulfill({ json: { versions: [{ kind: "checkpoint", revision: 4, savedMinute: "2026-11-04T10:00:00.000Z" }], nextBeforeRevision: null } });
    }
    if (req.method() === "GET" && path.endsWith("/compare")) {
      return route.fulfill({ json: { from: 2, to: 4, blocks: [{ kind: "paragraph", change: "added", text: "Izmišljeni novi odlomak." }] } });
    }
    if (req.method() === "GET" && path.endsWith("/sealed-self-note")) return route.fulfill({ json: { note: null, readingPlace: PLACE } });
    const result = server.answer("student", req.method(), path);
    if (result === "hang") return undefined;
    return route.fulfill(result);
  });
}

async function skipGuide(page: Page) {
  const skip = page.getByRole("button", { name: "Preskoči vodič" });
  await skip.waitFor({ state: "visible", timeout: 5000 }).then(() => skip.click(), () => undefined);
}

async function openMentor(page: Page, width: number) {
  if (width <= 640) {
    const drawer = page.getByRole("button", { name: "Bočni panel" });
    await drawer.focus();
    await page.keyboard.press("Enter");
  }
  const tab = page.getByRole("tab", { name: "Mentor" });
  await tab.focus();
  await page.keyboard.press("Enter");
  return page.locator("[data-mentor-card]");
}

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`MK-8, MK-9, MK-10 in the student's Mentor tab (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      const posted: unknown[] = [];
      await student(page, posted);
      await page.goto(`/app/web/rad/${T1}`);
      await setTheme(page, theme);
      await skipGuide(page);
      const card = await openMentor(page, width);
      // MK-8: the return of another work is not this work's; the mentor has said nothing here.
      const said = card.locator("[data-mentor-said]");
      await expect(said.getByRole("heading", { name: "Što je mentor rekao" })).toBeVisible();
      await expect(said.getByText("Mentor još nije vratio rad na doradu.")).toBeVisible();
      // MK-9: only the student's, with the kept reading place and the honest "cannot set".
      const own = page.locator("[data-own-panel]");
      await expect(own.getByText("Ovo ne vidi ni mentor ni nastavnik.")).toBeVisible();
      await expect(own.getByText(/^Ovdje ste stali prošli put/)).toBeVisible();
      await expect(own.getByText("Novu oznaku Ductura zasad ne može spremiti na poslužitelj.")).toBeVisible();
      // MK-10: composed from the record, the comparison and the requests; sent only after the server confirms.
      await card.getByText("Priprema za konzultacije", { exact: true }).first().click();
      const prep = card.locator("[data-prep-panel]");
      await expect(prep.getByText("Priprema je zapis o unosu u tekst, ne o autorstvu.")).toBeVisible();
      const make = prep.getByRole("button", { name: "Složi iz rada" });
      await make.focus();
      await page.keyboard.press("Enter");
      const area = prep.getByLabel("Tekst pripreme (možete ga promijeniti prije slanja)");
      await expect(area).toHaveValue(/izmijenjeno odlomaka: 1/);
      await area.fill("Priprema za konzultacije\nIzmišljeno: dopunio sam zaključak.");
      await prep.getByRole("button", { name: "Pošalji mentoru" }).click();
      await expect(prep.getByText("Priprema je poslana mentoru kao poruka.")).toBeVisible();
      expect(posted).toEqual(["Priprema za konzultacije\nIzmišljeno: dopunio sam zaključak."]);
      await axe(page, info, `mentor-runda-${width}-${theme}`);
    });
  }
}

test("MK-8: a failed read of the returns says unavailable and reads again on request", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await student(page, [], true);
  await page.goto(`/app/web/rad/${T1}`);
  await skipGuide(page);
  const card = await openMentor(page, 1280);
  const said = card.locator("[data-mentor-said]");
  await expect(said.getByText("Povratna informacija mentora trenutačno nije dostupna.")).toBeVisible();
  await expect(said.getByRole("button", { name: "Pokušaj ponovno" })).toBeVisible();
});

const WORK = {
  mentorshipId: "00000000-0000-4000-8000-000000000101", assignmentId: "00000000-0000-4000-8000-000000000102",
  documentId: "izmisljeni-rad-0001", student: { givenName: "Iva", familyName: "Izmišljena" },
  title: "Izmišljeni završni rad", workType: "bachelor_thesis", workState: "in_progress",
};

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`MK-8: "Pregled runde" on the mentor's N-16 (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route("**/api/v1/**", (route) => {
        const req = route.request();
        const path = new URL(req.url()).pathname;
        if (path.endsWith("/me")) {
          return route.fulfill({ json: { role: "teacher", roles: ["teacher"], institution: { displayName: "Izmišljeni fakultet" }, institutionName: "Izmišljeni fakultet" } });
        }
        if (path.endsWith("/teacher/mentorships")) return route.fulfill({ json: { works: [WORK] } });
        if (path.endsWith("/changes-since-review")) {
          return route.fulfill({ json: { reviewedRevision: 3, currentRevision: 5, changed: true, blocks: [
            { kind: "paragraph", text: "Izmišljeni dodani odlomak.", change: "added" },
            { kind: "paragraph", text: "Izmišljeni uklonjeni odlomak.", change: "removed" },
            { kind: "paragraph", text: "Izmišljeni isti odlomak.", change: "unchanged" },
          ] } });
        }
        if (path.endsWith("/revision-requests/list")) return route.fulfill({ json: { requests: [] } });
        return route.fulfill({ status: 503, json: { code: "unavailable" } });
      });
      await page.goto("/app/web/nastavnik/mentorstva");
      await setTheme(page, theme);
      const round = page.locator("[data-round-review]");
      await expect(round.getByRole("heading", { name: "Pregled runde: Iva Izmišljena" })).toBeVisible();
      await expect(round.getByText("Od zadnjeg pregleda: novih ili izmijenjenih odlomaka 1, uklonjenih 1.")).toBeVisible();
      await expect(round.getByText("Nema zahtjeva uz tekst.")).toBeVisible();
      const open = round.getByRole("link", { name: "Otvori rad za pregled" });
      await open.focus();
      await expect(open).toBeFocused();
      await axe(page, info, `pregled-runde-${width}-${theme}`);
    });
  }
}
