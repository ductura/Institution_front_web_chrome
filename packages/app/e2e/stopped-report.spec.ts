// ED-07 (NF2-P18): next to "Slanje na poslužitelj je zaustavljeno" the student can "Javi problem". The report names
// the state and the kind only; the text of the work never goes into it. Invented assignment, invented server; the
// stop is set in this device's journal (meta.evidenceStopped), as the recorder leaves it after a gap.
import { axe, hiddenFocus, setTheme } from "./a11y/check";

import { expect, test, type Page } from "./fixtures/test";

const ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c50";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d40";
const SCOPE = "c".repeat(64);
const TAG = "izmisljena-oznaka-prijave-0007";
const PATH = `/app/web/rad/${ID}`;
const SENTENCE = "Izmišljena rečenica sedam.";

async function server(page: Page, reports: unknown[], status = 201) {
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" }, journalScope: SCOPE, sessionTag: TAG },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: "Izmišljeni seminar o gradskim vrtovima", dueAt: "2099-12-15T22:59:00.000Z", noticeFirst: false },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState: "in_progress" }] },
  }));
  await page.route("**/api/v1/support/problem-report", (route) => {
    reports.push(route.request().postDataJSON());
    return status === 201
      ? route.fulfill({ status: 201, json: { reference: "PR-00000A0007" } })
      : route.fulfill({ status, json: { type: "about:blank", title: "x", status } });
  });
}

/** Opens the work, types, then marks this device's journal stopped and reloads: the stop notice shows. */
async function openStopped(page: Page, reports: unknown[], status = 201) {
  await server(page, reports, status);
  await page.goto(PATH);
  const editor = page.locator('.ProseMirror[contenteditable="true"]').first();
  await expect(editor).toBeVisible({ timeout: 20_000 });
  await editor.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(` ${SENTENCE}`);
  await expect.poll(() => page.evaluate(stopJournal), { timeout: 15_000 }).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByText("Slanje na poslužitelj je zaustavljeno.", { exact: false })).toBeVisible({ timeout: 20_000 });
}

/** In the page: sets evidenceStopped on every work row of every journal; how many rows it set. */
async function stopJournal(): Promise<number> {
  const names = (await indexedDB.databases()).map((d) => d.name).filter((n): n is string => typeof n === "string");
  let count = 0;
  for (const name of names) {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open(name);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    if (db.objectStoreNames.contains("meta")) {
      count += await new Promise<number>((resolve) => {
        const tx = db.transaction("meta", "readwrite");
        const store = tx.objectStore("meta");
        let n = 0;
        store.openCursor().onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (cursor === null) return;
          cursor.update({ ...cursor.value, evidenceStopped: "gap" });
          n += 1;
          cursor.continue();
        };
        tx.oncomplete = () => resolve(n);
        tx.onerror = () => resolve(0);
      });
    }
    db.close();
  }
  return count;
}

const reportButton = (page: Page) => page.getByRole("button", { name: "Javi problem" });
const dialog = (page: Page) => page.getByRole("dialog", { name: "Javi problem" });

test.describe("ED-07 Javi problem", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  // "Izvezi tekst" stands beside it only while the sheet holds text (canExport); after this reload the sheet is empty.
  test("the stopped notice offers Javi problem", async ({ page }) => {
    await openStopped(page, []);
    await expect(reportButton(page)).toBeVisible();
    await expect(reportButton(page)).toHaveCount(1);
  });

  test("the dialog says what goes in and the work's text does not", async ({ page }) => {
    await openStopped(page, []);
    await reportButton(page).click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page)).toContainText("Tekst rada se ne šalje.");
    await expect(dialog(page)).toContainText("Slanje zaustavljeno");
    await expect(dialog(page)).toContainText("Tehnički problem");
    await expect(dialog(page).getByLabel("Što ste radili (neobavezno)")).toBeFocused();
  });

  test("sending posts the state only, never the text, and says so", async ({ page }) => {
    const reports: unknown[] = [];
    await openStopped(page, reports);
    await reportButton(page).click();
    await page.getByRole("button", { name: "Pošalji prijavu" }).click();
    await expect(page.getByText("Prijava je poslana. U nju je ušla samo oznaka stanja, ne tekst rada.")).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    expect(reports).toHaveLength(1);
    const body = reports[0] as Record<string, unknown>;
    expect(body).toMatchObject({ category: "technical", syncState: "ERROR", route: null });
    expect(Object.keys(body).sort()).toEqual(["appVersion", "browser", "category", "description", "route", "syncState"]);
    expect(JSON.stringify(body)).not.toContain(SENTENCE);
  });

  test("the student's note goes in as written", async ({ page }) => {
    const reports: unknown[] = [];
    await openStopped(page, reports);
    await reportButton(page).click();
    await page.keyboard.type("Veza je pala.");
    await page.getByRole("button", { name: "Pošalji prijavu" }).click();
    await expect.poll(() => reports.length).toBe(1);
    expect((reports[0] as { description: string }).description).toBe("Veza je pala.");
  });

  test("a failed send keeps the dialog open and says why", async ({ page }) => {
    await openStopped(page, [], 503);
    await reportButton(page).click();
    await page.getByRole("button", { name: "Pošalji prijavu" }).click();
    await expect(dialog(page).getByRole("alert")).not.toBeEmpty();
    await expect(dialog(page)).toBeVisible();
  });

  test("keyboard: Escape closes, focus returns to Javi problem", async ({ page }) => {
    await openStopped(page, []);
    await reportButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(reportButton(page)).toBeFocused();
  });

  for (const width of [390, 1280]) {
    for (const theme of ["dark", "light"] as const) {
      test(`axe ${width} ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await openStopped(page, []);
        await setTheme(page, theme);
        await reportButton(page).click();
        await expect(dialog(page)).toBeVisible();
        expect(await hiddenFocus(page)).toEqual([]);
        await axe(page, test.info(), `ed07-javi-problem-${width}-${theme}`);
      });
    }
  }
});
