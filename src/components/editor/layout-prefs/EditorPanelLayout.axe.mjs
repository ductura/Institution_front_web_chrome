import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

import { axe } from "../../../../e2e/support/axe.js";
import { copiedFrontAliases } from "../../vitest.alias.ts";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const fixture = fileURLToPath(new URL("EditorPanelLayout.fixture.tsx", import.meta.url));
const requireCatalogue = createRequire(new URL("../../../../catalog/package.json", import.meta.url));
const { createServer } = requireCatalogue("vite");
const shell = '<!doctype html><html lang="hr"><meta charset="utf-8"><title>Ductura</title><div id="root"></div>'
  + '<script type="module" src="/src/components/editor/layout-prefs/EditorPanelLayout.fixture.tsx"></script>';
const app = await createServer({
  root, configFile: false, oxc: { jsx: { runtime: "automatic" } },
  server: { host: "127.0.0.1", port: 0, watch: null },
  resolve: { alias: copiedFrontAliases, dedupe: ["react", "react-dom"] },
  plugins: [{
    name: "editor-panel-fixture",
    enforce: "pre",
    resolveId(id) { if (id === "../LocalDocument" || id === "./LocalDocument") return fixture; },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== "/") return next();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(await server.transformIndexHtml("/", shell));
      });
    },
  }],
});

await app.listen();
let browser;
try {
  browser = await chromium.launch({ channel: process.env.DUCTURA_CHROMIUM_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(app.resolvedUrls.local[0]);
  const toggleRail = page.getByRole("button", { name: "Struktura rada", exact: true });
  const customizeLeft = page.getByRole("button", { name: "Prilagodi panel" });
  const customizeRight = page.getByRole("button", { name: "Prilagodi desni panel" });
  const dialog = page.getByRole("dialog");
  const choose = async (open, choice) => {
    await open.click();
    await dialog.getByRole("group", { name: "Raspored", exact: true }).getByRole("button", { name: choice }).click();
    await dialog.getByRole("button", { name: "Gotovo" }).click();
  };

  await expect(page.getByRole("complementary", { name: "Struktura rada" })).toBeVisible();
  await choose(customizeLeft, /^Kartice/);
  await page.getByRole("tab", { name: "Napredak" }).click();
  await expect(page.getByRole("tabpanel", { name: "Napredak" })).toBeVisible();
  await choose(customizeRight, /^Uz tekst/);
  await expect(page.getByRole("heading", { name: "Komentari ovdje" })).toBeVisible();
  await choose(customizeRight, /^Ikone uz rub/);
  await page.getByRole("button", { name: "Izvori", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Bočni panel" })).toHaveCSS("width", "66px");
  await page.reload();
  await expect(page.getByRole("tab", { name: "Napredak" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Izvori", exact: true })).toBeVisible();
  await axe(page);

  for (const width of [1250, 1050, 760, 640]) {
    await page.setViewportSize({ width, height: 900 });
    await toggleRail.click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS("width", "320px");
    if (width === 640) {
      await dialog.getByRole("button", { name: /Teorijski okvir/ }).click();
      await expect(dialog.getByRole("button", { name: /Navike i zajednička pravila/ })).toBeVisible();
    }
    await axe(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(toggleRail).toBeFocused();
  }

  await page.getByRole("button", { name: "Bočni panel", exact: true }).click();
  await expect(dialog).toHaveCSS("height", "684px");
  await customizeRight.click();
  const settings = page.getByRole("dialog", { name: "Prilagodi desni panel" });
  await settings.getByRole("group", { name: "Na mobitelu" }).getByRole("button", { name: "Kartice", exact: true }).click();
  await axe(page);
  await page.keyboard.press("Escape");
  await expect(settings).toHaveCount(0);
  const panel = page.getByRole("dialog", { name: "Bočni panel" });
  await expect(panel).toHaveCSS("width", "380px");
  await page.mouse.click(10, 400);
  await expect(panel).toHaveCount(0);

  await page.keyboard.press("Control+Period");
  await expect(page.getByRole("button", { name: "Izađi iz načina fokusa" })).toBeVisible();
  await expect(toggleRail).toBeHidden();
  await expect(page.getByRole("main")).toBeVisible();
  await axe(page);
  await page.keyboard.press("Escape");
  await expect(toggleRail).toBeVisible();
  console.log("Editor panel layouts, drawers, focus and axe passed in Chromium.");
} finally {
  await browser?.close();
  await app.close();
}
