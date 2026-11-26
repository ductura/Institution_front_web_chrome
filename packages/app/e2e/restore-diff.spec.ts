// ED-17 (NF2-P15): "Vratiti ovu verziju?" shows what "Da, vrati" changes before anything is written:
// the paragraphs added and removed, the first changed blocks and the note that no version is removed.
// Without a network "Da, vrati" is off. The server is the VIZ "puno" scenario with the version reads
// answered here; nothing is restored in these tests. Every text and identifier is invented.
import { axe, hiddenFocus, setTheme } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";
import { FIKSNI_DATUM, T1 } from "../test-fakes/viz-scenariji";
import { generatedServer } from "./viz/server";

const VERSIONS = [
  { kind: "checkpoint", revision: 2, savedMinute: "2026-11-02T10:00:00.000Z" },
  { kind: "checkpoint", revision: 3, savedMinute: "2026-11-03T10:00:00.000Z" },
  { kind: "submission", revision: 4, savedMinute: "2026-11-04T10:00:00.000Z", afterDeadline: false },
];

async function openEditor(page: Page) {
  const compares: string[] = [];
  const restores: string[] = [];
  const generated = generatedServer("puno");
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === "GET" && url.pathname.endsWith("/versions")) {
      return route.fulfill({ json: { versions: VERSIONS, nextBeforeRevision: null } });
    }
    if (req.method() === "GET" && url.pathname.endsWith("/compare")) {
      compares.push(url.search);
      return route.fulfill({ json: { from: Number(url.searchParams.get("from")), to: Number(url.searchParams.get("to")), blocks: [
        { kind: "paragraph", change: "unchanged", text: "Izmišljeni uvod ostaje." },
        { kind: "paragraph", change: "added", text: "Izmišljeni odlomak dodan poslije." },
      ] } });
    }
    if (url.pathname.endsWith("/restore")) restores.push(url.pathname);
    const result = generated.answer("student", req.method(), url.pathname);
    if (result === "hang") return undefined;
    return route.fulfill(result);
  });
  await page.goto(`/app/web/rad/${T1}`);
  await expect(page.locator('.ProseMirror[contenteditable="true"]').first()).toBeVisible({ timeout: 20_000 });
  const skip = page.getByRole("button", { name: "Preskoči vodič" });
  await skip.waitFor({ state: "visible", timeout: 5000 }).then(() => skip.click(), () => undefined);
  await page.locator("summary", { hasText: "Povijest dokumenta" }).first().click();
  const restore = page.getByRole("region", { name: "Vrati raniju verziju" });
  await expect(restore.getByRole("combobox")).toBeVisible();
  return { compares, restores, restore };
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`ED-17 Vraćanje s pregledom razlike, ${theme}`, () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test("the step shows the change against the newest version before Da, vrati", async ({ page }, info) => {
      const { compares, restores, restore } = await openEditor(page);
      await setTheme(page, theme);
      await restore.getByRole("combobox").selectOption("3");
      await restore.getByRole("button", { name: "Vrati ovu verziju" }).click();
      const step = page.getByRole("alertdialog", { name: "Vratiti ovu verziju?" });
      await expect(step.getByText("Dodano 0 odlomaka, uklonjeno 1 odlomak.")).toBeVisible();
      await expect(step.getByText("Vraćanje stvara novu verziju; nijedna ranija verzija se ne briše.")).toBeVisible();
      await expect(step).toContainText("poslije.");
      await expect(step).not.toContainText("uvod ostaje");
      expect(compares).toEqual(["?from=3&to=4"]);
      await expect(step.getByRole("button", { name: "Da, vrati" })).toBeEnabled();
      await axe(page, info, `restore-diff-${theme}`);
      expect(await hiddenFocus(page)).toEqual([]);
      await step.getByRole("button", { name: "Odustani" }).click();
      await expect(step).toHaveCount(0);
      expect(restores).toEqual([]);
    });
  });
}

test.describe("ED-17 Vraćanje bez mreže", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("without a network Da, vrati is off and says why; it comes back with the network", async ({ page }) => {
    const { restore } = await openEditor(page);
    await restore.getByRole("combobox").selectOption("2");
    await restore.getByRole("button", { name: "Vrati ovu verziju" }).click();
    const step = page.getByRole("alertdialog", { name: "Vratiti ovu verziju?" });
    await page.evaluate(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
      window.dispatchEvent(new Event("offline"));
    });
    await expect(step.getByText("Vraćanje traži vezu s mrežom.")).toBeVisible();
    await expect(step.getByRole("button", { name: "Da, vrati" })).toBeDisabled();
    await page.evaluate(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
      window.dispatchEvent(new Event("online"));
    });
    await expect(step.getByText("Vraćanje traži vezu s mrežom.")).toHaveCount(0);
    await expect(step.getByRole("button", { name: "Da, vrati" })).toBeEnabled();
  });
});
