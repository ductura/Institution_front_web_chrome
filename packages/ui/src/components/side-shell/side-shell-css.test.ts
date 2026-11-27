import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "SideShell.module.css"), "utf8");
const narrow = css.slice(css.indexOf("@media (max-width: 799.98px)"), css.indexOf("@media (max-width: 640px)"));

describe("STU-R07 / P-13: below 800 px the bell and Odjava need no menu", () => {
  it("keeps the foot displayed while closed", () => {
    expect(narrow).not.toMatch(/\.nav,\s*\.foot\s*\{/);
    expect(narrow).toMatch(/\.foot\s*\{[^}]*display:\s*flex/);
  });
  it("hides only the context, quiet links and theme button until the menu opens", () => {
    const hidden = narrow.match(/\.foot > :is\(([^)]*)\)\s*\{\s*display:\s*none/);
    expect(hidden?.[1]).toBe(".context, .quiet, .footButton");
    expect(hidden?.[1]).not.toMatch(/tools|account/);
  });
});
