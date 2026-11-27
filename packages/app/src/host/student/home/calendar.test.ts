// F4-STU-R12 (NF-1 P-14): the deadlines file holds only title, course and deadline, in RFC 5545 form.
import { describe, expect, it } from "vitest";

import { deadlinesIcs, exportable, foldLine, icsDate, icsText } from "./calendar";
import type { TaskRow } from "./model";

const row = (over: Partial<TaskRow>): TaskRow => ({
  id: "a1", title: "Izmišljeni esej", course: "Izmišljeni kolegij", kind: "zadatak", dueAt: "2026-12-15T22:59:00.000Z",
  extended: false, originalDueAt: "2026-12-15T22:59:00.000Z", typeLabel: "Esej", practice: false, ...over,
});
const NOW = Date.parse("2026-11-26T08:00:00.000Z");

describe("icsDate", () => {
  it("writes the moment in UTC", () => {
    expect(icsDate(Date.parse("2026-12-15T22:59:00.000Z"))).toBe("20261215T225900Z");
    expect(icsDate(Date.parse("2027-01-05T00:30:00+01:00"))).toBe("20270104T233000Z");
  });
});

describe("icsText", () => {
  it("escapes backslash, semicolon, comma and line breaks", () => {
    expect(icsText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
  });
});

describe("foldLine", () => {
  it("leaves a short line alone", () => {
    expect(foldLine("SUMMARY:kratko")).toBe("SUMMARY:kratko");
  });
  it("folds at 75 octets without splitting a character", () => {
    const folded = foldLine(`SUMMARY:${"č".repeat(60)}`);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(parts.slice(1).every((part) => part.startsWith(" "))).toBe(true);
    expect(parts.map((part, i) => (i === 0 ? part : part.slice(1))).join("")).toBe(`SUMMARY:${"č".repeat(60)}`);
  });
});

describe("deadlinesIcs", () => {
  it("is null when every task is submitted or has no date", () => {
    expect(deadlinesIcs([row({ kind: "predano" }), row({ id: "a2", dueAt: "nije datum" })], NOW)).toBeNull();
    expect(exportable([row({ kind: "predano" })])).toEqual([]);
  });

  it("has one event per open deadline with only title, course and deadline", () => {
    const file = deadlinesIcs([
      row({}),
      row({ id: "a2", title: "Rad, drugi; s točkom", kind: "rad", dueAt: "2027-01-10T10:00:00.000Z", extended: true }),
      row({ id: "a3", kind: "predano" }),
    ], NOW);
    expect(file?.count).toBe(2);
    const text = file?.text ?? "";
    expect(text.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(text.split("\r\n").filter((l) => l === "BEGIN:VEVENT")).toHaveLength(2);
    expect(text).toContain("DTSTART:20261215T225900Z");
    expect(text).toContain("DTSTAMP:20261126T080000Z");
    expect(text).toContain("SUMMARY:Rok: Izmišljeni esej (Izmišljeni kolegij)");
    expect(text).toContain("SUMMARY:Rok: Rad\\, drugi\\; s točkom (Izmišljeni kolegij)");
    expect(text).not.toContain("a3@");
    expect(text).not.toMatch(/DESCRIPTION|ATTENDEE|ORGANIZER|URL:/);
    expect(text.replace(/\r\n/g, "")).not.toContain("\n");
  });
});
