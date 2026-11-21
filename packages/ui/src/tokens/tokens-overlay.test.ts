import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
const OVERLAY = read("tokens.css");
const GLOBALS = read("globals.css");

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(css: string, selector: string): string {
  const lines = css.split("\n");
  const start = lines.findIndex((line) => line.trim() === `${selector} {`);
  if (start === -1) throw new Error(`no rule for ${selector}`);
  const rest = lines.slice(start + 1);
  return rest.slice(0, rest.findIndex((line) => line.trim() === "}")).join("\n");
}

function token(block: string, name: string): string {
  const line = block.split("\n").find((l) => l.trim().startsWith(`${name}:`));
  if (!line) throw new Error(`no ${name}`);
  return line.slice(line.indexOf(":") + 1).replace(";", "").trim().toLowerCase();
}

function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("tokens.css: the published entry point over the ported globals.css", () => {
  it("loads the ported tokens first, so local rules win", () => {
    expect(OVERLAY.trimStart().replace(/\/\*[\s\S]*?\*\/\s*/, "").startsWith('@import "./globals.css";')).toBe(true);
  });

  it("each sheet carries its own error text, so a dark shell never puts light error text on the paper", () => {
    for (const selector of [".sheet", '.sheet[data-sheet-theme="light"]']) {
      const error = token(rule(OVERLAY, selector), "--error");
      const sheet = rule(GLOBALS, selector);
      expect(contrast(error, token(sheet, "--sheet"))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(error, token(sheet, "--error-soft"))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
