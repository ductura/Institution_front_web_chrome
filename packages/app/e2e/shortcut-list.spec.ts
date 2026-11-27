// ED-03 (NF2-P5, P2-2): one shortcut list. Ctrl+/, "?" outside the text and the "Prečaci" button
// open the same dialog, and every row it shows is pressed here in the real editor: a row whose
// keys do nothing fails, and a new row without a probe fails too. Invented assignment, invented server.
import { axe, hiddenFocus, setTheme } from "./a11y/check";

import { expect, test, type Page } from "./fixtures/test";

import { shortcutListGroups, SHORTCUTS } from "../../../src/components/editor/commands/shortcut-definitions";

const ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4e";
const COURSE = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d2f";
const SCOPE = "b".repeat(64);
const TAG = "izmisljena-oznaka-prijave-0003";
const PATH = `/aplikacija/rad/${ID}`;

async function server(page: Page) {
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { role: "student", institution: { displayName: "Izmišljeni fakultet" }, journalScope: SCOPE, sessionTag: TAG },
  }));
  await page.route("**/api/v1/student/assignments", (route) => route.fulfill({
    json: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [
      { id: ID, title: "Izmišljeni seminar o gradskim parkovima", dueAt: "2099-12-15T22:59:00.000Z", noticeFirst: false },
    ] }] },
  }));
  await page.route("**/api/v1/student/assignment-work", (route) => route.fulfill({
    json: { assignments: [{ assignmentId: ID, workState: "in_progress" }] },
  }));
  // evidence/open: the shared fake answers with the contract's own opened work (fixtures/test).
}

async function openEditor(page: Page, path = PATH) {
  await server(page);
  await page.goto(path);
  const editor = page.locator('.ProseMirror[contenteditable="true"]').first();
  await expect(editor).toBeVisible({ timeout: 20_000 });
  // At 390 px the guide panel lies over the text; the keyboard reaches the editor anyway.
  await editor.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  return editor;
}

const list = (page: Page) => page.getByRole("dialog", { name: "Prečaci" });

type Probe = (page: Page) => Promise<void>;

/** One probe per row: it presses the row's keys and checks what they do. */
const PROBES: Record<string, Probe> = {
  undo: async (page) => {
    await page.keyboard.type("Izmišljenaponišti");
    await page.keyboard.press("Control+Z");
    await expect(page.locator(".ProseMirror")).not.toContainText("Izmišljenaponišti");
  },
  redo: async (page) => {
    await page.keyboard.type("Izmišljenaponovi");
    await page.keyboard.press("Control+Z");
    await expect(page.locator(".ProseMirror")).not.toContainText("Izmišljenaponovi");
    await page.keyboard.press("Control+Y");
    await expect(page.locator(".ProseMirror")).toContainText("Izmišljenaponovi");
  },
  bold: async (page) => {
    await page.keyboard.press("Control+B");
    await page.keyboard.type("Debelo");
    await expect(page.locator(".ProseMirror strong", { hasText: "Debelo" })).toBeVisible();
  },
  italic: async (page) => {
    await page.keyboard.press("Control+I");
    await page.keyboard.type("Koso");
    await expect(page.locator(".ProseMirror em", { hasText: "Koso" })).toBeVisible();
  },
  heading1: async (page) => heading(page, 1),
  heading2: async (page) => heading(page, 2),
  heading3: async (page) => heading(page, 3),
  paragraph: async (page) => {
    await page.keyboard.type("Natrag u odlomak");
    await page.keyboard.press("Control+Alt+2");
    await expect(page.locator(".ProseMirror h2", { hasText: "Natrag u odlomak" })).toBeVisible();
    await page.keyboard.press("Control+Alt+0");
    await expect(page.locator(".ProseMirror p", { hasText: "Natrag u odlomak" })).toBeVisible();
  },
  palette: async (page) => {
    await page.keyboard.press("Control+K");
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await page.keyboard.press("Escape");
  },
  find: async (page) => {
    await page.keyboard.press("Control+F");
    await expect(page.locator("input[type='search']:focus")).toHaveCount(1);
  },
  toolbar: async (page) => {
    await page.keyboard.press("Alt+F10");
    const inToolbar = await page.evaluate(() => !!document.activeElement?.closest("[data-roving], [data-command-trigger]")
      || !!document.activeElement?.matches("[data-roving], [data-command-trigger]"));
    expect(inToolbar).toBe(true);
  },
  focus: async (page) => {
    await page.keyboard.press("Control+.");
    await expect(page.locator('[data-focus="true"]')).toHaveCount(1);
    await page.keyboard.press("Control+.");
    await expect(page.locator('[data-focus="true"]')).toHaveCount(0);
  },
  // ED-33 (P2-2): Alt+↑/↓ swaps the sentence with its neighbour, Alt+Shift+↑/↓ the chapter.
  moveSentence: async (page) => {
    const paragraph = page.locator(".ProseMirror p", { hasText: "Izmišljena prva." });
    await page.keyboard.type("Izmišljena prva. Izmišljena druga.");
    await page.keyboard.press("Alt+ArrowUp");
    await expect(paragraph).toHaveText("Izmišljena druga. Izmišljena prva.");
    await page.keyboard.press("Alt+ArrowDown");
    await expect(paragraph).toHaveText("Izmišljena prva. Izmišljena druga.");
  },
  moveChapter: async (page) => {
    const order = () => page.locator(".ProseMirror h2").filter({ hasText: /Izmišljeno (prvo|drugo) poglavlje/ }).allInnerTexts();
    for (const name of ["Izmišljeno prvo poglavlje", "Izmišljeno drugo poglavlje"]) {
      await page.keyboard.type(name);
      await page.keyboard.press("Control+Alt+2");
      await page.keyboard.press("End");
      await page.keyboard.press("Enter");
      await page.keyboard.type("Tekst poglavlja.");
      await page.keyboard.press("Enter");
    }
    // The cursor is in the second chapter; Alt+Shift+↑ puts that chapter before the first.
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Alt+Shift+ArrowUp");
    await expect.poll(async () => (await order()).map((t) => t.replace(/^[\d.\s]+/, ""))).toEqual(["Izmišljeno drugo poglavlje", "Izmišljeno prvo poglavlje"]);
  },
  shortcuts: async (page) => {
    await page.keyboard.press("Control+/");
    await expect(list(page)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
  },
  close: async (page) => {
    await page.keyboard.press("Control+/");
    await expect(list(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(list(page)).toHaveCount(0);
  },
};

async function heading(page: Page, level: 1 | 2 | 3) {
  const text = `Naslov razine ${level}`;
  await page.keyboard.type(text);
  await page.keyboard.press(`Control+Alt+${level}`);
  await expect(page.locator(`.ProseMirror h${level}`, { hasText: text })).toBeVisible();
}

test("every row of the list has a probe, and no probe is for a row that is gone", () => {
  expect(Object.keys(PROBES).sort()).toEqual(SHORTCUTS.map(({ id }) => id).sort());
});

for (const { id, label } of SHORTCUTS) {
  test(`the row "${label}" does what the list says`, async ({ page }) => {
    await openEditor(page);
    await PROBES[id]!(page);
  });
}

test("Lab S12: moves past the abbreviation and decimal, with separate undo and redo", {
  tag: "@ductura-lab-sentence-move",
}, async ({ page }) => {
  const editor = await openEditor(page, PATH);
  const paragraph = editor.locator("p").last();
  const first = "Rezultat je npr. dobar.";
  const second = "Vrijednost je 3.14.";
  const third = "Slijedi zaključak.";
  const original = [first, second, third].join(" ");
  const moved = [first, third, second].join(" ");

  await page.keyboard.insertText(original);
  await expect(paragraph).toHaveText(original);
  await page.keyboard.press("Alt+ArrowUp");
  await expect(paragraph).toHaveText(moved);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(paragraph).toHaveText(original);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(paragraph).toHaveText(moved);
  await page.keyboard.press("Alt+ArrowDown");
  await expect(paragraph).toHaveText(original);
});

test("Lab S13: moves a formatted quotation with its citation past initials and a date", {
  tag: "@ductura-lab-sentence-move",
}, async ({ page }) => {
  const editor = await openEditor(page, PATH);
  const paragraph = editor.locator("p").last();
  const first = "Prof. dr. sc. A. B. Čičak pisao je 12. 3. 2024.";
  const quote = "„Zašto?”";
  const citation = "(Žunić, 2023, str. 14).";
  const second = quote + " " + citation;

  await page.keyboard.insertText(first + " " + second);
  await expect(paragraph).toHaveText(first + " " + second);
  await paragraph.evaluate((element, { from, to }) => {
    const text = element.firstChild!;
    const selection = window.getSelection()!;
    selection.setBaseAndExtent(text, from, text, to);
  }, { from: first.length + 1, to: first.length + 1 + quote.length });
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe(quote);
  await page.keyboard.press("ControlOrMeta+b");
  await expect(paragraph.locator("strong")).toHaveText(quote);
  await page.keyboard.press("Control+End");
  expect(await paragraph.locator("strong").textContent()).toBe(quote);
  const blockId = await paragraph.getAttribute("data-node-id");
  expect(blockId).toBeTruthy();

  await page.keyboard.press("Alt+ArrowUp");
  await expect(paragraph).toHaveText(second + " " + first);
  await expect(paragraph.locator("strong")).toHaveText(quote);
  await expect(paragraph).toHaveAttribute("data-node-id", blockId!);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(paragraph).toHaveText(first + " " + second);
  await expect(paragraph.locator("strong")).toHaveText(quote);
  await expect(paragraph).toHaveAttribute("data-node-id", blockId!);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(paragraph).toHaveText(second + " " + first);
  await expect(paragraph.locator("strong")).toHaveText(quote);
  await expect(paragraph).toHaveAttribute("data-node-id", blockId!);
});

test("Ctrl+/, ? and the Prečaci button open the same one list, with the rows of the one definition", async ({ page }) => {
  await openEditor(page);
  const rows = shortcutListGroups(true).flatMap(({ items }) => items.map(({ label }) => label));

  await page.keyboard.press("Control+/");
  await expect(list(page)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  const fromKeys = await list(page).locator("li").allInnerTexts();
  await page.keyboard.press("Escape");

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("?");
  await expect(list(page)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Prečaci" }).click();
  await expect(list(page)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  expect(await list(page).locator("li").allInnerTexts()).toEqual(fromKeys);
  for (const label of rows) await expect(list(page).getByText(label, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(list(page)).toHaveCount(0);
});

test("the palette's Prečaci opens the same list", async ({ page }) => {
  await openEditor(page);
  await page.keyboard.press("Control+K");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.type("Prečaci");
  await page.keyboard.press("Enter");
  await expect(list(page)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
});

test("a grey / command says why: nije u pilotu", async ({ page }) => {
  await openEditor(page);
  await page.keyboard.type("/");
  const grey = page.getByRole("option", { disabled: true }).first();
  await expect(grey).toBeVisible();
  await expect(grey).toContainText("nije u pilotu");
});

for (const width of [390, 1280]) {
  for (const theme of ["dark", "light"] as const) {
    test(`a11y: ${width} px, ${theme}: the list passes axe, no overflow, focus visible`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await setTheme(page, theme);
      await openEditor(page);
      await page.keyboard.press("Control+/");
      await expect(list(page)).toBeVisible();
      await axe(page, test.info(), `prečaci ${width} ${theme}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBe(0);
      await page.keyboard.press("Tab");
      expect(await hiddenFocus(page)).toEqual([]);
    });
  }
}
