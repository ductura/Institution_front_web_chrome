import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DEFAULT_INTERFACE_LOCALE, INTERFACE_LOCALES } from "./interface-locale";

// The application's language registry (ported from Ductus src/lib/i18n/locale.ts).
const APP_LOCALE = new URL("../../../../src/components/i18n/locale.ts", import.meta.url);

describe("interface-locale adapter", () => {
  it("keeps the Ductus list: Croatian first and default, English second", () => {
    expect(INTERFACE_LOCALES).toEqual(["hr", "en"]);
    expect(DEFAULT_INTERFACE_LOCALE).toBe("hr");
    expect(Object.isFrozen(INTERFACE_LOCALES)).toBe(true);
  });

  it("names exactly the catalogues the application registers", () => {
    const source = readFileSync(APP_LOCALE, "utf8");
    const registry = /const CATALOGUES = \{([^}]*)\}/.exec(source);
    expect(registry).not.toBeNull();
    const keys = [...(registry?.[1] ?? "").matchAll(/(\w+)\s*:/g)].map((match) => match[1]);
    expect(keys).toEqual([...INTERFACE_LOCALES]);
    expect(source).toContain(`DEFAULT_INTERFACE_LOCALE: InterfaceLocale = "${DEFAULT_INTERFACE_LOCALE}"`);
  });
});
