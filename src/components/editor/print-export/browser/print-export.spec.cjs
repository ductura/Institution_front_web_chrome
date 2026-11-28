const { readFile } = require("node:fs/promises");
const { expect, test } = require("@playwright/test");

const fixture = "/__fixture/print-export";
const docxType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const docxPath = "/api/v1/works/demo-rad/export?format=docx&versionId=42";
const snapshotSha256 = "1234567890ab" + "c".repeat(52);

test.beforeEach(async ({ page }) => {
  await page.route((url) => url.pathname === fixture, (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html lang="hr"><meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Pregled ispisa</title><div id="app"></div>
      <script type="module" src="/src/components/editor/print-export/browser/fixture.spec.tsx"></script></html>`,
  }));
});

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

test("the preview can retry and DOCX downloads the file returned by the client", async ({ page }) => {
  let previews = 0;
  let downloads = 0;
  await page.route("**/__fixture/export.pdf", (route) => ++previews === 1
    ? route.fulfill({ status: 503 })
    : route.fulfill({ contentType: "application/pdf", body: onePagePdf() }));
  await page.route((url) => url.pathname + url.search === docxPath, (route) => ++downloads === 1
    ? route.fulfill({ contentType: "text/html", body: "<p>Izmišljena pogreška</p>" })
    : route.fulfill({
      contentType: docxType, headers: { "X-Export-Snapshot-Sha256": snapshotSha256 },
      body: "Izmišljeni seminarski rad",
    }));

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

  const word = dialog.getByRole("button", { name: "Preuzmi DOCX" });
  await word.click();
  await expect(dialog.getByRole("alert")).toContainText("Preuzimanje rada nije uspjelo");
  const downloadPromise = page.waitForEvent("download");
  await word.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Izmišljeni rad.docx");
  expect(await readFile(await download.path(), "utf8")).toBe("Izmišljeni seminarski rad");
  await expect(dialog.getByRole("status")).toHaveText("Otisak izvoza: 1234567890ab…");
  const previewUrl = await preview.getAttribute("src");
  await dialog.getByRole("button", { name: "Zatvori" }).click();
  await expect(opener).toBeFocused();
  expect(await page.evaluate((url) => fetch(url).then(() => true, () => false), previewUrl)).toBe(false);
});

test("the DOCX client sends the saved revision, shows progress and maps 404 and 422", async ({ page }) => {
  let respond;
  const pending = new Promise((resolve) => { respond = resolve; });
  let calls = 0;
  await page.route("**/api/v1/works/demo-rad/versions", (route) => route.fulfill({
    json: {
      versions: [
        { kind: "checkpoint", revision: 42, savedMinute: "2026-11-21T08:10:00.000Z" },
        { kind: "checkpoint", revision: 41, savedMinute: "2026-11-20T08:10:00.000Z" },
      ],
      nextBeforeRevision: null,
    },
  }));
  await page.route((url) => url.pathname.endsWith("/export"), async (route) => {
    const { pathname, search } = new URL(route.request().url());
    expect(pathname + search).toBe(docxPath);
    expect(route.request().method()).toBe("GET");
    expect(route.request().headers().accept).toBe(docxType);
    calls += 1;
    await route.fulfill({ status: calls === 1 ? await pending : 422 });
  });
  try {
    await page.goto(`${fixture}?docx`);
    await page.getByRole("button", { name: "Pregled ispisa" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("PDF — Uskoro")).toBeVisible();
    await expect(dialog.getByText(/Verzija na poslužitelju od 21\.\s*11\.\s*2026\./)).toBeVisible();
    const button = dialog.getByRole("button", { name: "Preuzmi DOCX" });
    await button.click();
    const busy = dialog.getByRole("button", { name: "Preuzimam DOCX…" });
    await expect(busy).toBeDisabled();
    await expect(busy).toHaveAttribute("aria-busy", "true");
    respond(404);
    await expect(dialog.getByRole("alert")).toHaveText("Rad ili verzija na poslužitelju nisu dostupni.");
    await button.click();
    await expect(dialog.getByRole("alert")).toHaveText("Zahtjev za izvoz nije valjan.");
    expect(calls).toBe(2);
  } finally {
    respond(404);
  }
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
