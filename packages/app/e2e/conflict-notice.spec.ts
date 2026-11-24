// ED-08 (NF2-P3): when the server's work differs, the notice promises no decision the server cannot make yet; it
// says to export the text and contact support. Invented assignment, invented server; the conflict is set in this
// device's journal (meta.state CONFLICT), as a refused commit leaves it.
import { axe, hiddenFocus, setTheme } from "./a11y/check";

import { expect, test, type Page } from "./fixtures/test";

const ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c51";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d41";
const SCOPE = "c".repeat(64);
const TAG = "izmisljena-oznaka-prijave-0008";
const PATH = `/app/web/rad/${ID}`;
const SENTENCE = "Izmišljena rečenica osam.";

async function server(page: Page) {
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
}

async function openConflict(page: Page) {
  await server(page);
  await page.goto(PATH);
  const editor = page.locator('.ProseMirror[contenteditable="true"]').first();
  await expect(editor).toBeVisible({ timeout: 20_000 });
  await editor.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(` ${SENTENCE}`);
  await expect.poll(() => page.evaluate(markJournal, { state: "CONFLICT" }), { timeout: 15_000 }).toBeGreaterThan(0);
  await page.reload();
  await expect(notice(page)).toBeVisible({ timeout: 20_000 });
}

/** In the page: sets the given fields on every work row of every journal; how many rows it set. */
async function markJournal(fields: Record<string, unknown>): Promise<number> {
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
          cursor.update({ ...cursor.value, ...fields });
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

const notice = (page: Page) => page.getByText("Rad na poslužitelju razlikuje se od teksta na ovom uređaju.", { exact: false });

test.describe("ED-08 Sukob", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("the notice says what to do and promises no decision", async ({ page }) => {
    await openConflict(page);
    await expect(notice(page)).toHaveText(
      "Rad na poslužitelju razlikuje se od teksta na ovom uređaju. Tekst ostaje na uređaju i zasad se ništa ne šalje. Izvezite tekst i javite se podršci.",
    );
    await expect(page.getByText(/dok ne odlučite/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Odluči/ })).toHaveCount(0);
  });

  for (const width of [390, 1280]) {
    for (const theme of ["dark", "light"] as const) {
      test(`axe ${width} ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await openConflict(page);
        await setTheme(page, theme);
        await page.keyboard.press("Tab");
        expect(await hiddenFocus(page)).toEqual([]);
        await axe(page, test.info(), `ed08-sukob-${width}-${theme}`);
      });
    }
  }
});