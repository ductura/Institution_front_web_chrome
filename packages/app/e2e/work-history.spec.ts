// ED-16 (NF2-P14): one way into the work's history, "Povijest i usporedba". The header button, the
// Raspored menu and Ctrl+K open the same dialog: the list "Verzije rada (n)", one version only for
// reading, and the comparison of sent versions only. The server is the VIZ "puno" scenario with the
// version reads answered per test. Every text and identifier is invented.
import { axe, hiddenFocus, setTheme } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";
import { FIKSNI_DATUM, T1 } from "../test-fakes/viz-scenariji";
import { generatedServer } from "./viz/server";

type Version = { kind: "checkpoint" | "submission"; revision: number; savedMinute: string; afterDeadline?: boolean };
type Reply = { status: number; json: unknown } | "hang";
/** What the versions read answers now; a test changes it before asking again. */
type Answer = { now: Reply };

const FULL: Version[] = [
  { kind: "submission", revision: 2, savedMinute: "2026-11-02T10:00:00.000Z", afterDeadline: false },
  { kind: "checkpoint", revision: 3, savedMinute: "2026-11-03T10:00:00.000Z" },
  { kind: "submission", revision: 4, savedMinute: "2026-11-04T10:00:00.000Z", afterDeadline: false },
];
const versions = (list: Version[]): Reply => ({ status: 200, json: { versions: list, nextBeforeRevision: null } });
const DOCUMENT = (revision: number) => JSON.stringify({ schemaVersion: 2, nodes: [
  { type: "heading", children: [{ type: "text", text: "Izmišljeni uvod" }] },
  { type: "paragraph", children: [{ type: "text", text: `Izmišljeni odlomak verzije ${revision}.` }] },
] });

async function server(page: Page, answer: Answer) {
  const asked: string[] = [];
  const generated = generatedServer("puno");
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === "GET" && path.endsWith("/versions")) {
      asked.push(path);
      const reply = answer.now;
      if (reply === "hang") return undefined;
      return route.fulfill({ status: reply.status, json: reply.json });
    }
    const one = /\/versions\/(\d+)$/u.exec(path);
    if (req.method() === "GET" && one) {
      const revision = Number(one[1]);
      return route.fulfill({ json: { revision, document: DOCUMENT(revision) } });
    }
    if (req.method() === "GET" && path.endsWith("/compare")) {
      const url = new URL(req.url());
      return route.fulfill({ json: { from: Number(url.searchParams.get("from")), to: Number(url.searchParams.get("to")),
        blocks: [{ kind: "paragraph", change: "added", text: "Izmišljeni novi odlomak." }] } });
    }
    const result = generated.answer("student", req.method(), path);
    if (result === "hang") return undefined;
    return route.fulfill(result);
  });
  return asked;
}

async function openEditor(page: Page, now: Reply) {
  const answer: Answer = { now };
  const asked = await server(page, answer);
  await page.goto(`/app/web/rad/${T1}`);
  await expect(page.locator('.ProseMirror[contenteditable="true"]').first()).toBeVisible({ timeout: 20_000 });
  const skip = page.getByRole("button", { name: "Preskoči vodič" });
  await skip.waitFor({ state: "visible", timeout: 5000 }).then(() => skip.click(), () => undefined);
  return { asked, answer, dialog: page.getByRole("dialog") };
}

async function press(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true }).first();
  await button.focus();
  await page.keyboard.press("Enter");
}

for (const { width, theme } of [{ width: 1280, theme: "dark" as const }, { width: 390, theme: "light" as const }]) {
  test.describe(`ED-16 Povijest i usporedba ${width} px, ${theme}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("Povijest lists the versions, shows one only for reading and compares sent ones", async ({ page }, info) => {
      const { dialog } = await openEditor(page, versions(FULL));
      await setTheme(page, theme);
      await press(page, "Povijest");
      await expect(dialog.getByRole("heading", { name: "Povijest i usporedba" })).toBeVisible();
      await expect(dialog.getByRole("heading", { name: "Verzije rada (3)" })).toBeVisible();
      const rows = dialog.getByRole("listitem");
      await expect(rows).toHaveCount(3);
      await expect(rows.nth(0)).toContainText("Predaja 2");
      await expect(rows.nth(1)).toContainText("Verzija 3");
      await expect(rows.nth(2)).toContainText("Predaja 1");
      await expect(dialog.getByRole("heading", { name: "Usporedba poslanih verzija" })).toBeVisible();
      await expect(dialog.getByText("Izmišljeni novi odlomak.")).toBeVisible();
      await axe(page, info, `work-history-list-${width}-${theme}`);
      expect(await hiddenFocus(page)).toEqual([]);

      const first = rows.nth(1).getByRole("button");
      await first.focus();
      await page.keyboard.press("Enter");
      await expect(dialog.getByRole("heading", { name: "Verzija 3 · samo za čitanje" })).toBeVisible();
      await expect(dialog.getByText("Izmišljeni odlomak verzije 3.")).toBeVisible();
      await axe(page, info, `work-history-version-${width}-${theme}`);
      await press(page, "Natrag na popis");
      await expect(dialog.getByRole("heading", { name: "Verzije rada (3)" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    });

    test("an unavailable list keeps the local text and Pokušaj ponovno asks again", async ({ page }, info) => {
      const { dialog, asked, answer } = await openEditor(page, { status: 503, json: { error: "unavailable" } });
      await setTheme(page, theme);
      await press(page, "Povijest");
      await expect(dialog.getByRole("alert")).toHaveText("Verzije trenutačno nije moguće dohvatiti. Tekst na ovom uređaju je netaknut.");
      await axe(page, info, `work-history-error-${width}-${theme}`);
      const before = asked.length;
      answer.now = versions([]);
      await press(page, "Pokušaj ponovno");
      await expect(dialog.getByText("Još nema verzija. Prva se pojavi nakon prvog spremanja na poslužitelju.")).toBeVisible();
      expect(asked.length).toBe(before + 1);
    });
  });
}

test.describe("ED-16 Povijest i usporedba, stanja i ulazi", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("while the list is read the dialog says it is loading", async ({ page }) => {
    const { dialog } = await openEditor(page, "hang");
    await press(page, "Povijest");
    await expect(dialog.getByRole("status")).toHaveText("Učitavam verzije…");
  });

  test("with one sent version there is nothing to compare", async ({ page }) => {
    const { dialog } = await openEditor(page, versions([FULL[0]!, FULL[1]!]));
    await press(page, "Povijest");
    await expect(dialog.getByRole("heading", { name: "Verzije rada (2)" })).toBeVisible();
    await expect(dialog.getByText("Za usporedbu su potrebne dvije poslane verzije.", { exact: false })).toBeVisible();
    await expect(dialog.getByRole("combobox")).toHaveCount(0);
  });

  test("the Raspored menu and Ctrl+K open the same dialog", async ({ page }) => {
    const { dialog } = await openEditor(page, versions(FULL));
    await page.locator("summary", { hasText: "Raspored" }).click();
    await press(page, "Povijest i usporedba");
    await expect(dialog.getByRole("heading", { name: "Verzije rada (3)" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    await page.locator(".ProseMirror").first().click();
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog");
    await expect(palette).toBeVisible();
    await page.keyboard.type("Povijest i usporedba");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Verzije rada (3)" })).toBeVisible();
  });
});
