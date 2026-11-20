const { readFile } = require("node:fs/promises");
const { expect, test } = require("@playwright/test");

const fixture = "/src/components/editor/print-export/browser/index.html";
const docxType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function onePagePdf() {
  let pdf = "%PDF-1.4\n";
  const offsets = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>",
  ].map((value, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${value}\nendobj\n`;
    return `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  return pdf + `xref\n0 4\n0000000000 65535 f \n${offsets.join("")}trailer\n`
    + `<< /Size 4 /Root 1 0 R >>\nstartxref\n${pdf.length}\n%%EOF\n`;
}

test("the preview can retry and Word downloads the file returned by the loader", async ({ page }) => {
  let previews = 0;
  let downloads = 0;
  await page.route("**/__fixture/export.pdf", (route) => ++previews === 1
    ? route.fulfill({ status: 503 })
    : route.fulfill({ contentType: "application/pdf", body: onePagePdf() }));
  await page.route("**/__fixture/export.docx", (route) => ++downloads === 1
    ? route.fulfill({ contentType: "text/html", body: "<p>Izmišljena pogreška</p>" })
    : route.fulfill({ contentType: docxType, body: "Izmišljeni seminarski rad" }));

  await page.setViewportSize({ width: 360, height: 750 });
  await page.goto(fixture);
  const opener = page.getByRole("button", { name: "Otvori pregled ispisa" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Pregled ispisa" });
  await expect(dialog.getByRole("alert")).toHaveText("Pregled ispisa nije dostupan.");
  await dialog.getByRole("button", { name: "Pokušaj ponovno" }).click();
  const preview = dialog.locator('iframe[title="Pregled rada u PDF-u"]');
  await expect(preview).toHaveAttribute("src", /^blob:/);
  await expect(dialog.getByRole("link", { name: "Otvori PDF u novoj kartici" }))
    .toHaveAttribute("href", await preview.getAttribute("src"));
  expect((await dialog.boundingBox()).width).toBeLessThan(360);

  const word = dialog.getByRole("button", { name: "Preuzmi Word (.docx)" });
  await word.click();
  await expect(dialog.getByRole("alert")).toContainText("Preuzimanje rada nije uspjelo");
  const downloadPromise = page.waitForEvent("download");
  await word.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("izmisljeni-rad.docx");
  expect(await readFile(await download.path(), "utf8")).toBe("Izmišljeni seminarski rad");
  const previewUrl = await preview.getAttribute("src");
  await dialog.getByRole("button", { name: "Zatvori" }).click();
  await expect(opener).toBeFocused();
  expect(await page.evaluate((url) => fetch(url).then(() => true, () => false), previewUrl)).toBe(false);
});

test("closing cancels a pending preview and restores editor focus", async ({ page }) => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  await page.route("**/__fixture/export.pdf", async (route) => {
    await pending;
    await route.fulfill({ status: 503 });
  });
  try {
    await page.goto(fixture);
    const opener = page.getByRole("button", { name: "Otvori pregled ispisa" });
    await opener.click();
    await expect(page.getByRole("status")).toHaveText("Pripremam pregled ispisa…");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.locator("body")).toHaveAttribute("data-aborted", "pdf");
    await expect(opener).toBeFocused();
  } finally {
    release();
  }
});
