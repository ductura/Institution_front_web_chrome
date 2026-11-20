import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readTheme, THEME_KEY, toggleTheme } from "../../shell/theme";
import { setSheetTheme } from "../../shell/useSheetTheme";
import { readSheetTheme, SHEET_THEME_KEY } from "../../../lib/ui/sheet-theme";
import EditorPage from "../EditorPage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("editor sheet theme", () => {
  it("renders a white sheet before the browser reads preferences", () => {
    const html = renderToStaticMarkup(createElement(EditorPage, {
      course: null,
      title: "Izmišljeni rad",
      status: null,
      children: null,
    }));

    expect(html).toMatch(/<article class="sheet [^"]*" data-sheet-theme="light"/);
  });

  it("stores changes separately from the shell theme in both directions", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    const attributes = new Map<string, string>();
    const root = {
      getAttribute: (name: string) => attributes.get(name) ?? null,
      setAttribute: (name: string, value: string) => { attributes.set(name, value); },
    };
    vi.stubGlobal("window", { localStorage: storage });

    toggleTheme(root, storage);
    expect(readTheme(storage)).toBe("light");
    expect(readSheetTheme(storage)).toBe("light");

    setSheetTheme("dark");
    expect(values.get(SHEET_THEME_KEY)).toBe("dark");
    expect(values.get(THEME_KEY)).toBe("light");
    expect(root.getAttribute("data-theme")).toBe("light");

    toggleTheme(root, storage);
    expect(readTheme(storage)).toBe("dark");
    expect(readSheetTheme(storage)).toBe("dark");

    setSheetTheme("light");
    expect(readTheme(storage)).toBe("dark");
    expect(readSheetTheme(storage)).toBe("light");
  });

  it("accepts changes when the browser blocks access to localStorage", () => {
    vi.stubGlobal("window", {
      get localStorage() { throw new DOMException("Storage disabled", "SecurityError"); },
    });

    expect(() => setSheetTheme("dark")).not.toThrow();
    expect(() => setSheetTheme("light")).not.toThrow();
  });
});
