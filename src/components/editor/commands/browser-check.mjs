// Run from the repo root with Node and Playwright Chromium. No local stack is needed.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, expect } from "@playwright/test";
import { copiedFrontAliases } from "../../vitest.alias.ts";

const require = createRequire(new URL("../../../../catalog/package.json", import.meta.url));
const { createServer } = await import(pathToFileURL(require.resolve("vite")));
const entry = "/src/components/editor/commands/EditorCommands.browser.spec.tsx";
const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL("../../../../", import.meta.url)),
  resolve: { alias: copiedFrontAliases },
  oxc: { jsx: { runtime: "automatic" } },
  plugins: [{
    name: "editor-command-fixture",
    resolveId(id) { if (id === "../LocalDocument") return "\0command-fixture-provider"; },
    load(id) {
      if (id === "\0command-fixture-provider") return "export const useLocalEditor = () => null, useLocalSignedOut = () => false;";
    },
    configureServer({ middlewares }) {
      middlewares.use("/commands-test", (_request, response) => {
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(`<!doctype html><html lang="hr"><meta name="viewport" content="width=device-width"><title>Izmišljeni pokus</title><div id="root"></div><script type="module" src="${entry}"></script></html>`);
      });
    },
  }],
  server: { host: "127.0.0.1", port: 0 },
});

let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 640, height: 850 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => process.stderr.write(`${error.stack}\n`));
  page.on("console", (message) => {
    if (message.type() === "error") process.stderr.write(`${message.text()}\n`);
  });
  const violations = [];
  const checkAxe = async (surface) => {
    const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    violations.push(...report.violations.map(({ id, nodes }) => ({ surface, id, targets: nodes.map(({ target }) => target) })));
  };
  await page.goto(new URL("/commands-test", server.resolvedUrls.local[0]).href);
  const editor = page.getByRole("textbox", { name: "Tekst rada" });
  await editor.getByText("Maslina i maslina").click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");

  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Naredbe" });
  await expect(palette).toBeVisible();
  await checkAxe("paleta");
  await palette.getByRole("combobox").fill("Podebljano");
  await page.keyboard.press("Enter");
  await expect(editor.locator("strong")).toHaveText("Maslina i maslina");

  await page.keyboard.press("Control+/");
  await expect(page.getByRole("dialog", { name: "Prečaci" })).toBeVisible();
  await checkAxe("prečaci");
  await page.keyboard.press("Escape");
  await expect(editor).toBeFocused();

  await page.keyboard.press("Shift+F10");
  const menu = page.getByRole("menu", { name: "Izbornik teksta" });
  await expect(menu.getByRole("menuitem", { name: /Podebljano/ })).toBeFocused();
  await checkAxe("izbornik teksta");
  await page.keyboard.press("Escape");
  await expect(editor).toBeFocused();

  await page.keyboard.press("Control+f");
  const query = page.getByRole("searchbox");
  await expect(query).toBeFocused();
  await query.fill("maslina");
  await expect(page.getByText("1 od 2")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByText("2 od 2")).toBeVisible();
  await checkAxe("traka za traženje");
  await page.getByRole("textbox", { name: "Zamijeni s" }).fill("smokva");
  await page.getByRole("button", { name: "Sve", exact: true }).click();
  await expect(editor).toContainText("smokva i smokva");
  await page.keyboard.press("Escape");
  await expect(editor).toBeFocused();
  await page.keyboard.press("Control+z");
  await expect(editor).toContainText("Maslina i maslina");
  expect(violations).toEqual([]);
  process.stdout.write("Editor commands: Chromium and axe passed.\n");
} finally {
  await browser?.close();
  await server.close();
}
