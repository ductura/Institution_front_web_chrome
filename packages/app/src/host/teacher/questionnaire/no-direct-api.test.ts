import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WEB-V18-UPITNIK-AUTOR: the screens reach the server only through the port over the contract client,
// never through a network primitive or an API URL of their own, and the page really mounts them.
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b|as unknown as/;

describe("questionnaire author module", () => {
  it("source files hold no network primitive, no API URL and no type bypass", () => {
    const files = readdirSync(import.meta.dirname).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const file of files) expect({ file, hit: FORBIDDEN.test(readFileSync(join(import.meta.dirname, file), "utf8")) }).toEqual({ file, hit: false });
  });

  it("is mounted under each course card of 'Moji kolegiji'", () => {
    const pages = readFileSync(join(import.meta.dirname, "../../pages.tsx"), "utf8");
    expect(pages).toContain('from "./teacher/questionnaire/Questionnaires"');
    expect(pages).toMatch(/<CourseQuestionnaires courseId=\{course\.id\} courseName=\{course\.name\} \/>/);
  });
});
