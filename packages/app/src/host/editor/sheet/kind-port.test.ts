// WEB-V14-SHEET-PAGE: which editor a work opens in. Invented ids.
import { describe, expect, it } from "vitest";

import { kindOfRow, pageKindOf } from "./kind-port";

const id = "8c7b6a5d-4e3f-4b2a-8d9c-6e5f4a3b2c01";
const answer = (row: object) => ({ ok: true, body: { courses: [{ assignments: [{ id, ...row }] }] } });

describe("kindOfRow: workKind ?? documentKind ?? text", () => {
  it("prefers workKind, then documentKind, else text", () => {
    expect(kindOfRow({ workKind: "spreadsheet", documentKind: "text" })).toBe("spreadsheet");
    expect(kindOfRow({ documentKind: "slides" })).toBe("slides");
    expect(kindOfRow({})).toBe("text");
  });
  it("a value it does not know is unreadable, never text", () => {
    expect(kindOfRow({ workKind: "video" })).toBe("unreadable");
    expect(kindOfRow({ documentKind: 7 })).toBe("unreadable");
  });
});

describe("pageKindOf", () => {
  it("reads the row of this assignment only (ids compare lower case)", () => {
    expect(pageKindOf(answer({ workKind: "spreadsheet" }), id)).toBe("spreadsheet");
    expect(pageKindOf(answer({ workKind: "spreadsheet" }), "00000000-0000-4000-8000-000000000000")).toBe("text");
  });
  it("a failed read is unreadable (nedostupno), not text", () => {
    expect(pageKindOf({ ok: false }, id)).toBe("unreadable");
    expect(pageKindOf({ ok: true, body: null }, id)).toBe("text");
  });
});
