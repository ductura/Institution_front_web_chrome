// WEB-2113: the example tests of src/components/student/access-log-days.test.ts for the host's own copy
// (the property tests stay there: fast-check is not a dependency of packages/app).
// DAN-913-1: the access log model, adapted from Ductus
// src/domain/privacy/access-log-days.test.ts (DAN-294). The input is what
// createApi already checked against student.access-log.get, so the classes
// of a malformed row live in the schema, not here. Invented names and ids only.
import { describe, expect, it } from "vitest";

import { accessLogDaysOf, type AccessLogEntry } from "./days";

const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const entry = (n: number, at: string, over: Partial<AccessLogEntry> = {}): AccessLogEntry => ({
  id: id(n), at, role: "mentor", surface: "live_view", reader: { givenName: "Izmišljena", familyName: "Anić" }, ...over,
});
const shape = (entries: AccessLogEntry[]) =>
  accessLogDaysOf(entries).map((d) => [d.key, d.weekday, d.entries.map((r) => `${r.from}–${r.to}`)]);

describe("DAN-913-1 access log days", () => {
  it("an empty log is no day", () => {
    expect(accessLogDaysOf([])).toEqual([]);
  });

  it("entries of one window stay separate rows, never merged or counted", () => {
    const days = accessLogDaysOf([
      entry(1, "2026-11-10T13:10:00.000Z"),
      entry(2, "2026-11-10T13:10:00.000Z", { role: "teacher" }),
      entry(3, "2026-11-10T13:10:00.000Z", { surface: "replay" }),
    ]);
    expect(days).toHaveLength(1);
    expect(days[0]?.entries.map((r) => r.id)).toEqual([id(3), id(2), id(1)]);
    expect(days[0]?.entries.every((r) => r.from === "14:10" && r.to === "14:15")).toBe(true);
  });

  it("the window edges: 14:55–15:00 and 23:55–00:00", () => {
    expect(shape([entry(1, "2026-11-10T13:55:00.000Z"), entry(2, "2026-11-10T22:55:00.000Z")])).toEqual([
      ["2026-11-10", 2, ["23:55–00:00", "14:55–15:00"]],
    ]);
  });

  it("the day changes at midnight in Zagreb, winter and summer", () => {
    expect(shape([entry(1, "2026-11-10T22:55:00.000Z"), entry(2, "2026-11-10T23:00:00.000Z")])).toEqual([
      ["2026-11-11", 3, ["00:00–00:05"]],
      ["2026-11-10", 2, ["23:55–00:00"]],
    ]);
    expect(shape([entry(1, "2026-07-10T21:55:00.000Z"), entry(2, "2026-07-10T22:00:00.000Z")])).toEqual([
      ["2026-07-11", 6, ["00:00–00:05"]],
      ["2026-07-10", 5, ["23:55–00:00"]],
    ]);
  });

  it("the spring and autumn change: wall times as the clock showed them, order by instant", () => {
    expect(shape([entry(1, "2026-03-29T00:55:00.000Z"), entry(2, "2026-03-29T01:00:00.000Z")])).toEqual([
      ["2026-03-29", 0, ["03:00–03:05", "01:55–03:00"]],
    ]);
    // Two windows share the wall clock 02:00 on the autumn change: two rows, the later instant first.
    const autumn = accessLogDaysOf([entry(1, "2026-10-25T00:00:00.000Z"), entry(2, "2026-10-25T01:00:00.000Z")]);
    expect(autumn[0]?.entries.map((r) => [r.id, r.from, r.at])).toEqual([
      [id(2), "02:00", Date.parse("2026-10-25T01:00:00.000Z")],
      [id(1), "02:00", Date.parse("2026-10-25T00:00:00.000Z")],
    ]);
  });

  it("an unknown role or surface and a reader without a name pass through unchanged", () => {
    const [row] = accessLogDaysOf([entry(1, "2026-11-10T13:10:00.000Z", { role: "unknown", surface: "unknown", reader: null })])[0]!.entries;
    expect(row).toMatchObject({ role: "unknown", surface: "unknown", reader: null });
  });

  it("a repeated id is shown once; unordered input comes out newest day and row first", () => {
    const days = accessLogDaysOf([
      entry(1, "2026-11-08T07:00:00.000Z"),
      entry(3, "2026-11-10T13:10:00.000Z"),
      entry(2, "2026-11-10T08:05:00.000Z"),
      entry(3, "2026-11-10T13:10:00.000Z"),
    ]);
    expect(days.map((d) => d.key)).toEqual(["2026-11-10", "2026-11-08"]);
    expect(days.flatMap((d) => d.entries.map((r) => r.id))).toEqual([id(3), id(2), id(1)]);
  });

  it("the weekday of a leap day", () => {
    expect(shape([entry(1, "2028-02-29T10:00:00.000Z")])).toEqual([["2028-02-29", 2, ["11:00–11:05"]]]);
  });
});
