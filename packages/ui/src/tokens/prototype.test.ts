import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// The prototype parity layer (VIZ-0): docs/prototip/ (Ductura_student.html,
// Ductura_nastavnik.html, editor/editor.css; INVENTAR-editor.md §1.5–1.8).
const read = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
const ENTRY = read("tokens.css");
const LAYER = read("prototype.css");
const GLOBALS = read("globals.css");

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

const DARK = ":root";
const LIGHT = ':root[data-theme="light"]:not(:has(#prijava-kartica, #pocetna-naslov))';

describe("prototype.css: the prototype parity layer over globals.css", () => {
  it("loads after the ported tokens, so its rules win", () => {
    const imports = ENTRY.split("\n").filter((line) => line.startsWith("@import"));
    expect(imports).toEqual(['@import "./globals.css";', '@import "./prototype.css";']);
  });

  it("has the four origin colours of editor v0.27 in both themes, as marks (3:1 on the ground)", () => {
    const pairs = { "--p-typed": ["#9bbf9a", "#4f7d4e"], "--p-ai": ["#d9a26a", "#a8642a"], "--p-match": ["#d7c069", "#8a7420"], "--p-imp": ["#b7a4d6", "#6d55a3"] };
    for (const [name, [dark, light]] of Object.entries(pairs)) {
      expect(token(rule(LAYER, DARK), name)).toBe(dark);
      expect(token(rule(LAYER, LIGHT), name)).toBe(light);
      expect(contrast(dark!, token(rule(GLOBALS, DARK), "--ground"))).toBeGreaterThanOrEqual(3);
      expect(contrast(light!, token(rule(GLOBALS, LIGHT), "--ground"))).toBeGreaterThanOrEqual(3);
    }
  });

  it("names the prototype's measures: 13.5 px body, 12.5 px meta, 44 px targets, 64 px rail, 10 px cards", () => {
    const root = rule(LAYER, DARK);
    expect(token(root, "--fs-ui")).toBe("13.5px");
    expect(token(root, "--fs-sm")).toBe("12.5px");
    expect(token(root, "--target")).toBe("44px");
    expect(token(root, "--target-dense")).toBe("32px");
    expect(token(root, "--side-w")).toBe("64px");
    expect(token(root, "--radius-card")).toBe("10px");
  });

  it("keeps the package's 4 px spacing steps that pages already use", () => {
    const root = rule(LAYER, DARK);
    expect(["--space-1", "--space-2", "--space-3", "--space-4"].map((name) => token(root, name))).toEqual(["4px", "8px", "12px", "16px"]);
  });

  it("gives the student and the teacher their own page frame and error mark", () => {
    const root = rule(LAYER, DARK);
    const teacher = rule(LAYER, '[data-shell-role="teacher"]');
    expect([token(root, "--main-w"), token(teacher, "--main-w")]).toEqual(["880px", "960px"]);
    expect([token(root, "--main-narrow-w"), token(teacher, "--main-narrow-w")]).toEqual(["640px", "680px"]);
    expect([token(root, "--dialog-w"), token(teacher, "--dialog-w")]).toEqual(["480px", "520px"]);
    expect(token(teacher, "--field-invalid")).toBe("var(--warn)");
    expect(token(teacher, "--err-ink")).toBe("currentcolor");
    // Undefined at the root, so the sheet's own --error is used there (resolved where it is used).
    expect(root).not.toMatch(/--err-ink:|--field-invalid:/);
  });

  it("writes the prototype's shared classes with the prototype's names", () => {
    for (const selector of [".btn", ".btn.secondary", ".btn.ghost", ".btn.small", ".btn.dense", ".input", ".field", ".err", ".card", ".item,", ".panel", ".tag", ".skel", ".tbl", ".acts", ".pagehead"]) {
      expect(LAYER.split("\n").some((line) => line === `${selector} {` || line === selector)).toBe(true);
    }
  });
});
