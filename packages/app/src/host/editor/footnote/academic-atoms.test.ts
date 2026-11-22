import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { atomAvailability, crossReferenceTargets, crossReferenceText, insertItems } from "./academic-atoms";
import { CrossReferencePicker } from "./CrossReferencePicker";
import { academicAtomsHr as t } from "./messages.hr";

const ready = { confirmedVersion: 3, schemaHasAtoms: true, editable: true };

describe("atomAvailability", () => {
  it("is unavailable while the server has not confirmed the work's schema", () => {
    expect(atomAvailability({ ...ready, confirmedVersion: null })).toEqual({ kind: "unavailable", reason: "unconfirmed" });
    expect(atomAvailability({ ...ready, confirmedVersion: 2 })).toEqual({ kind: "unavailable", reason: "unconfirmed" });
  });
  it("is unavailable when the mounted editor lacks the atoms, even with v3 confirmed", () => {
    expect(atomAvailability({ ...ready, schemaHasAtoms: false }).kind).toBe("unavailable");
  });
  it("is available on a confirmed v3 or v4 work, and read-only otherwise", () => {
    expect(atomAvailability(ready).kind).toBe("available");
    expect(atomAvailability({ ...ready, confirmedVersion: 4 }).kind).toBe("available");
    expect(atomAvailability({ ...ready, editable: false })).toEqual({ kind: "unavailable", reason: "readOnly" });
  });
});

describe("insertItems", () => {
  it("lists Fusnota and Unakrsna referenca with the prototype hints", () => {
    const items = insertItems({ kind: "available" }, vi.fn());
    expect(items.map((i) => [i.label, i.hint])).toEqual([
      [t.footnote, t.footnoteHint],
      [t.crossReference, t.crossReferenceHint],
    ]);
  });
  it("draws the reason and opens nothing while unavailable", () => {
    const open = vi.fn();
    const items = insertItems({ kind: "unavailable", reason: "unconfirmed" }, open);
    for (const item of items) item.onSelect();
    expect(open).not.toHaveBeenCalled();
    expect(items.every((i) => i.disabled && i.note === t.unconfirmed)).toBe(true);
  });
  it("opens the dialog of the item when available", () => {
    const open = vi.fn();
    insertItems({ kind: "available" }, open)[1]!.onSelect();
    expect(open).toHaveBeenCalledWith("crossReference");
  });
});

describe("crossReferenceTargets", () => {
  const chapters = [
    { id: "h1", number: "1", title: "Uvod" },
    { id: null, number: "2", title: "Novo" },
  ];
  const blocks = [
    { type: "paragraph", id: "p1" },
    { type: "table", id: "t1", title: "Uzorak" },
    { type: "image", id: null },
    { type: "image", id: "i2", title: " Shema " },
    { type: "table", id: "t2" },
  ];
  it("adds the exhibits, numbered per kind, to the chapters", () => {
    const targets = crossReferenceTargets(chapters, blocks);
    expect(targets.chapters).toEqual([{ id: "h1", label: "1", title: "Uvod" }]);
    expect(targets.exhibits).toEqual([
      { id: "t1", label: "Tablica 1", title: "Uzorak" },
      { id: "i2", label: "Slika 2", title: "Shema" },
      { id: "t2", label: "Tablica 2", title: "" },
    ]);
  });
  it("labels a reference by its target or says the target is gone", () => {
    const targets = crossReferenceTargets(chapters, blocks);
    expect(crossReferenceText("i2", targets)).toEqual({ found: true, label: "Slika 2" });
    expect(crossReferenceText("gone", targets)).toEqual({ found: false, note: t.missing });
  });
});

describe("CrossReferencePicker", () => {
  it("draws Poglavlja and Prikazi", () => {
    const targets = crossReferenceTargets([{ id: "h1", number: "1", title: "Uvod" }], [{ type: "image", id: "i1", title: "Shema" }]);
    const html = renderToStaticMarkup(createElement(CrossReferencePicker, { targets, onPick: vi.fn() }));
    expect(html).toContain(t.chapters);
    expect(html).toContain(t.exhibits);
    expect(html).toContain("Slika 1 Shema");
  });
  it("says there is nothing to point to", () => {
    const html = renderToStaticMarkup(createElement(CrossReferencePicker, { targets: { chapters: [], exhibits: [] }, onPick: vi.fn() }));
    expect(html).toContain(t.noTargets);
    expect(html).not.toContain(t.exhibits);
  });
});
