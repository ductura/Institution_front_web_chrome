import { describe, expect, it } from "vitest";
import { workKindOf } from "./work-kind.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const answer = (...rows: object[]) => ({ ok: true, body: { courses: [{ name: "Kolegij A", assignments: rows }] } });

describe("workKindOf", () => {
  it("a row without documentKind is a text work (an older server)", () => {
    expect(workKindOf(answer({ id: A, title: "Rad" }), A)).toBe("text");
  });
  it("reads slides and text from the assignment's own row, not from another one", () => {
    const rows = answer({ id: A, documentKind: "slides" }, { id: B, documentKind: "text" });
    expect(workKindOf(rows, A)).toBe("slides");
    expect(workKindOf(rows, B)).toBe("text");
  });
  it("matches the id case-insensitively, as the page's read does", () => {
    expect(workKindOf(answer({ id: A.toUpperCase(), documentKind: "slides" }), A)).toBe("slides");
  });
  it("a value the client does not know is unreadable, never guessed as text", () => {
    expect(workKindOf(answer({ id: A, documentKind: "video" }), A)).toBe("unreadable");
    expect(workKindOf(answer({ id: A, documentKind: null }), A)).toBe("unreadable");
  });
  it("an unusable answer or an unknown assignment is text (the page's own read decides what to show)", () => {
    expect(workKindOf({ ok: false }, A)).toBe("text");
    expect(workKindOf({ ok: true, body: {} }, A)).toBe("text");
    expect(workKindOf(answer({ id: B, documentKind: "slides" }), A)).toBe("text");
  });
});
