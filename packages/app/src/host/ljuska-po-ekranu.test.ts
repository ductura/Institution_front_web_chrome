import { describe, expect, it } from "vitest";

import { PAGES } from "../routes";
import { SCREEN_FRAMES, frameOf, isNarrow, withoutShell } from "./ljuska-po-ekranu";

describe("frame per screen (prototype shell: side | none, narrow)", () => {
  it("names only routes the app has", () => {
    const known = new Set(PAGES.map((page) => page.path));
    for (const frame of SCREEN_FRAMES) expect(known.has(frame.path) || frame.path === "/nastavnik", frame.path).toBe(true);
  });

  it("leaves the shell out only where the prototype says none and the page draws its own frame", () => {
    expect(withoutShell("/rad/abc", "student")).toBe(true);
    expect(withoutShell("/rad/abc/predaja/pregled", "student")).toBe(false);
    expect(withoutShell("/zadaci", "student")).toBe(false);
    expect(withoutShell("/nastavnik/rad/5", "teacher")).toBe(false);
    expect(withoutShell("/rad/abc", null)).toBe(false);
  });

  it("marks the narrow screens of both prototypes", () => {
    expect(isNarrow("/upis", "student")).toBe(true);
    expect(isNarrow("/zadatak/7", "student")).toBe(true);
    expect(isNarrow("/nastavnik/zadatak/novi", "teacher")).toBe(true);
    expect(isNarrow("/nastavnik/zadatak/3/produljenje", "teacher")).toBe(true);
    expect(isNarrow("/zadaci", "student")).toBe(false);
    expect(frameOf("/nema", "student")).toBeNull();
  });
});
