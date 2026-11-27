// ED-71: "Sadržaj na listu" is kept per person (journal scope) and work, in this browser.
import { beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { readSheetToc, resetSheetTocForTest, setSheetToc, sheetTocKey, sheetTocKeyOf, subscribeSheetToc } from "./sheet-toc";
import { SheetTocBox } from "./SheetToc";

const SCOPE_A = "a".repeat(64);
const SCOPE_B = "b".repeat(64);
const memory = () => {
  const kept = new Map<string, string>();
  return { kept, getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v) };
};

beforeEach(() => resetSheetTocForTest());

describe("sheet-toc key", () => {
  it("is the person's and the work's, the same from the toolbar's work-parts key", () => {
    const workParts = `ductura.editor.work-parts:${JSON.stringify([SCOPE_A, "doc-1"])}`;
    expect(sheetTocKeyOf(workParts)).toBe(sheetTocKey(SCOPE_A, "doc-1"));
    expect(sheetTocKey(SCOPE_A, "doc-1")).not.toBe(sheetTocKey(SCOPE_B, "doc-1"));
    expect(sheetTocKey(SCOPE_A, "doc-1")).not.toBe(sheetTocKey(SCOPE_A, "doc-2"));
    expect(sheetTocKeyOf("something-else")).toBeNull();
  });
});

describe("sheet-toc store", () => {
  it("is off until turned on, keeps the choice and tells its listeners", () => {
    const store = memory();
    const key = sheetTocKey(SCOPE_A, "doc-1");
    let told = 0;
    const stop = subscribeSheetToc(() => { told += 1; });
    expect(readSheetToc(key, () => store)).toBe(false);
    expect(setSheetToc(key, true, () => store)).toBe(true);
    expect(store.kept.get(key)).toBe("on");
    expect(readSheetToc(key, () => store)).toBe(true);
    expect(told).toBe(1);
    stop();
    setSheetToc(key, false, () => store);
    expect(told).toBe(1);
    expect(store.kept.get(key)).toBe("off");
  });

  it("reads a kept choice after a reload, and another person's never", () => {
    const store = memory();
    store.setItem(sheetTocKey(SCOPE_A, "doc-1"), "on");
    expect(readSheetToc(sheetTocKey(SCOPE_A, "doc-1"), () => store)).toBe(true);
    expect(readSheetToc(sheetTocKey(SCOPE_B, "doc-1"), () => store)).toBe(false);
  });

  it("still switches on this page when storage is blocked, and does nothing without a key", () => {
    const blocked = () => { throw new Error("blocked"); };
    const key = sheetTocKey(SCOPE_A, "doc-1");
    expect(readSheetToc(key, blocked)).toBe(false);
    expect(setSheetToc(key, true, blocked)).toBe(true);
    expect(readSheetToc(key, blocked)).toBe(true);
    expect(readSheetToc(null)).toBe(false);
    expect(setSheetToc(null, true)).toBe(false);
  });
});

describe("SheetTocBox", () => {
  it("lists the numbered headings as buttons, the second level indented", () => {
    const html = renderToStaticMarkup(createElement(SheetTocBox, { onSelect: () => {}, lines: [
      { key: "h1", number: "1", title: "Uvod", level: 1 },
      { key: "h2", number: "1.1", title: "Izmišljeno potpoglavlje", level: 2 },
      { key: "h3", number: "2", title: "", level: 1 },
    ] }));
    expect(html).toContain('aria-label="Sadržaj na listu"');
    expect(html).toContain(">Sadržaj</h2>");
    expect(html.match(/<button type="button"/g)).toHaveLength(3);
    expect(html).toContain(">1.1.</span><span>Izmišljeno potpoglavlje</span>");
    expect(html).toContain(">2.</span><span>Bez naslova</span>");
    expect(html).toContain("Složeno iz naslova.");
    expect(html).not.toContain("·");
  });

  it("says the work has no headings yet", () => {
    const html = renderToStaticMarkup(createElement(SheetTocBox, { onSelect: () => {}, lines: [] }));
    expect(html).toContain("Rad još nema naslova.");
    expect(html).not.toContain("<button");
  });
});
