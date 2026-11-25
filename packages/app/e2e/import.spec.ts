// ED-20 (NF2-P19): "Uvezi tekst iz datoteke". A .docx or .pdf up to 2 MB goes to the server
// (`work.imports.post`), the preview waits for "Potvrdi uvoz" (`work.imports.confirm.post`), and only
// then is the text at the end of the work. The server is the VIZ "puno" scenario with the import
// routes answered per test. Every text, file and identifier is invented.
import { axe, hiddenFocus, setTheme } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";
import { FIKSNI_DATUM, T1 } from "../test-fakes/viz-scenariji";
import { generatedServer } from "./viz/server";

const IMPORT = "44444444-4444-4444-8444-444444444444";
const NODE = "55555555-5555-4555-8555-555555555555";
type Reply = { status: number; json: unknown };
type Answers = { preview: Reply; confirm: Reply };

const PREVIEW: Reply = { status: 201, json: {
  importId: IMPORT, manifestSha256: "b".repeat(64), source: "import", evidenceKind: "imported", fileFormat: "docx",
  content: { schemaVersion: 2, sources: [], nodes: [
    { type: "paragraph", id: NODE, children: [{ type: "text", text: "Izmišljeni uvezeni odlomak o čitanju naglas.", marks: [] }] },
  ] },
  traces: [], rawByteLength: 12, fileName: "izmisljeni-rad.docx", baseRevision: 1, expiresAt: "2026-11-25T12:00:00.000Z",
} };
const CONFIRMED: Reply = { status: 200, json: { importId: IMPORT, eventId: "izmisljeni-dogadaj-1" } };

async function openEditor(page: Page, answers: Answers) {
  const asked: string[] = [];
  const generated = generatedServer("puno");
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === "POST" && path.endsWith("/imports")) { asked.push("preview"); return route.fulfill({ status: answers.preview.status, json: answers.preview.json }); }
    if (req.method() === "POST" && path.endsWith("/confirm") && path.includes("/imports/")) { asked.push("confirm"); return route.fulfill({ status: answers.confirm.status, json: answers.confirm.json }); }
    const result = generated.answer("student", req.method(), path);
    if (result === "hang") return undefined;
    return route.fulfill(result);
  });
  await page.goto(`/app/web/rad/${T1}`);
  await expect(page.locator('.ProseMirror[contenteditable="true"]').first()).toBeVisible({ timeout: 20_000 });
  const skip = page.getByRole("button", { name: "Preskoči vodič" });
  await skip.waitFor({ state: "visible", timeout: 5000 }).then(() => skip.click(), () => undefined);
  return { asked, dialog: page.getByRole("dialog") };
}

async function press(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true }).first();
  await button.focus();
  await page.keyboard.press("Enter");
}

const file = (name: string, size = 12) => ({ name, mimeType: "application/octet-stream", buffer: Buffer.alloc(size, 1) });

for (const { width, theme } of [{ width: 1280, theme: "dark" as const }, { width: 390, theme: "light" as const }]) {
  test.describe(`ED-20 Uvezi tekst iz datoteke ${width} px, ${theme}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("the preview adds nothing until Potvrdi uvoz, then the text is at the end of the work", async ({ page }, info) => {
      const { dialog, asked } = await openEditor(page, { preview: PREVIEW, confirm: CONFIRMED });
      await setTheme(page, theme);
      await press(page, "Uvezi tekst iz datoteke");
      await expect(dialog.getByRole("heading", { name: "Uvezi tekst iz datoteke" })).toBeVisible();
      await expect(dialog.getByText("Datoteka (.docx ili .pdf, do 2 MB)")).toBeVisible();
      await axe(page, info, `import-pick-${width}-${theme}`);
      await dialog.getByLabel("Datoteka (.docx ili .pdf, do 2 MB)").setInputFiles(file("izmisljeni-rad.docx"));
      await press(page, "Pregledaj uvoz");
      await expect(dialog.getByRole("heading", { name: "Pregled uvoza" })).toBeVisible();
      await expect(dialog.getByText("izmisljeni-rad.docx · 6 riječi")).toBeVisible();
      await expect(dialog.getByRole("status")).toHaveText("Pregled čeka Vašu potvrdu. Ništa nije dodano u rad.");
      await expect(page.locator(".ProseMirror").first()).not.toContainText("Izmišljeni uvezeni odlomak");
      await axe(page, info, `import-preview-${width}-${theme}`);
      expect(await hiddenFocus(page)).toEqual([]);

      await press(page, "Potvrdi uvoz");
      await expect(dialog).toHaveCount(0);
      await expect(page.locator(".ProseMirror").first()).toContainText("Izmišljeni uvezeni odlomak o čitanju naglas.");
      await expect(page.getByText("Uvezeno 6 riječi, označeno kao uvezeno.")).toBeAttached();
      expect(asked).toEqual(["preview", "confirm"]);
    });

    test("a wrong format and a file over 2 MB are refused before any request", async ({ page }, info) => {
      const { dialog, asked } = await openEditor(page, { preview: PREVIEW, confirm: CONFIRMED });
      await setTheme(page, theme);
      await press(page, "Uvezi tekst iz datoteke");
      const input = dialog.getByLabel("Datoteka (.docx ili .pdf, do 2 MB)");
      await input.setInputFiles(file("izmisljeni-rad.odt"));
      await press(page, "Pregledaj uvoz");
      await expect(dialog.getByRole("alert")).toHaveText("Podržani su samo .docx i .pdf.");
      await axe(page, info, `import-error-${width}-${theme}`);
      await input.setInputFiles(file("izmisljeni-rad.pdf", 2 * 1024 * 1024 + 1));
      await press(page, "Pregledaj uvoz");
      await expect(dialog.getByRole("alert")).toHaveText("Datoteka je veća od 2 MB. Odaberite manju ili zalijepite tekst.");
      expect(asked).toEqual([]);
    });
  });
}

test.describe("ED-20 Uvezi tekst iz datoteke, odgovori poslužitelja", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("a PDF without a text layer is named as such", async ({ page }) => {
    const { dialog } = await openEditor(page, { preview: { status: 422, json: { code: "pdf_no_text_layer" } }, confirm: CONFIRMED });
    await press(page, "Uvezi tekst iz datoteke");
    await dialog.getByLabel("Datoteka (.docx ili .pdf, do 2 MB)").setInputFiles(file("izmisljeni-sken.pdf"));
    await press(page, "Pregledaj uvoz");
    await expect(dialog.getByRole("alert")).toHaveText("PDF nema sloj teksta, na primjer kad je skeniran. Odaberite DOCX ili PDF s tekstom.");
  });

  test("when the work changed since the preview nothing is added and the student starts over", async ({ page }) => {
    const { dialog } = await openEditor(page, { preview: PREVIEW, confirm: { status: 409, json: { code: "import_revision_changed" } } });
    await press(page, "Uvezi tekst iz datoteke");
    await dialog.getByLabel("Datoteka (.docx ili .pdf, do 2 MB)").setInputFiles(file("izmisljeni-rad.docx"));
    await press(page, "Pregledaj uvoz");
    await press(page, "Potvrdi uvoz");
    await expect(dialog.getByRole("alert")).toHaveText("Rad se u međuvremenu promijenio. Odaberite datoteku ponovno.");
    await expect(dialog.getByLabel("Datoteka (.docx ili .pdf, do 2 MB)")).toBeVisible();
    await expect(page.locator(".ProseMirror").first()).not.toContainText("Izmišljeni uvezeni odlomak");
  });

  test("offline the import asks for the network", async ({ page, context }) => {
    const { dialog, asked } = await openEditor(page, { preview: PREVIEW, confirm: CONFIRMED });
    await press(page, "Uvezi tekst iz datoteke");
    await dialog.getByLabel("Datoteka (.docx ili .pdf, do 2 MB)").setInputFiles(file("izmisljeni-rad.docx"));
    await context.setOffline(true);
    await press(page, "Pregledaj uvoz");
    await expect(dialog.getByRole("alert")).toHaveText("Uvoz traži vezu s mrežom. Tekst možete zalijepiti.");
    await context.setOffline(false);
    expect(asked).toEqual([]);
  });
});
