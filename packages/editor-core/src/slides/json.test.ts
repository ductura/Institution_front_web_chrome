import { describe, expect, it } from "vitest";

import { readDocumentKind } from "./index";

// Every value below is invented.
describe("readDocumentKind", () => {
  it("reads both kinds of an open answer", () => {
    expect(readDocumentKind({ documentKind: "slides", slidesSchemaVersion: 1 })).toEqual({
      ok: true,
      kind: "slides",
    });
    expect(readDocumentKind({ documentKind: "text", schemaVersion: 3 })).toEqual({
      ok: true,
      kind: "text",
    });
  });

  it("treats an answer without the field as a text work", () => {
    expect(readDocumentKind({ schemaVersion: 3 })).toEqual({ ok: true, kind: "text" });
  });

  it("refuses a value outside the closed list instead of guessing", () => {
    for (const value of ["", "Slides", "pptx", " slides", null, 1, true, ["slides"], {}]) {
      expect(readDocumentKind({ documentKind: value })).toEqual({ ok: false });
    }
  });

  it("does not read the field through the prototype and refuses a non-object answer", () => {
    expect(readDocumentKind(JSON.parse('{"__proto__":{"documentKind":"slides"}}'))).toEqual({
      ok: true,
      kind: "text",
    });
    expect(readDocumentKind(Object.create({ documentKind: "slides" }))).toEqual({ ok: false });
    for (const value of [null, undefined, "slides", 7, []]) {
      expect(readDocumentKind(value)).toEqual({ ok: false });
    }
  });
});
