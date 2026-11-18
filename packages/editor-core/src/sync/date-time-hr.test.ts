import { fc, test } from "@fast-check/vitest";
import { describe, expect, it } from "vitest";

import { formatDateTimeHr } from "./date-time-hr";

// The application's Zagreb clock and month names (Ductus src/lib/i18n), loaded
// by URL so the package's type check does not follow into application code.
type AppZagreb = {
  zagrebEpochMs: (text: string) => number | null;
  zagrebWall: (epochMs: number) => { year: number; month: number; day: number; hour: number; minute: number };
};
type AppHr = { MONTHS_GENITIVE_HR: readonly string[] };
const appUrl = (file: string) => new URL(`../../../../src/components/i18n/${file}`, import.meta.url).href;
const zagreb = (await import(appUrl("zagreb.ts"))) as AppZagreb;
const hr = (await import(appUrl("hr.ts"))) as AppHr;

/** Ductus `formatDateTimeHr`, written over the application's clock. */
function appFormat(iso: string): string {
  const epochMs = zagreb.zagrebEpochMs(iso);
  if (epochMs === null) return iso;
  const at = zagreb.zagrebWall(epochMs);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${at.day}. ${hr.MONTHS_GENITIVE_HR[at.month - 1]} ${at.year}. u ${pad(at.hour)}:${pad(at.minute)}`;
}

const pad = (value: number, width = 2) => String(value).padStart(width, "0");

describe("formatDateTimeHr adapter", () => {
  it("writes the Ductus text in Zagreb time, summer and winter", () => {
    expect(formatDateTimeHr("2026-09-19T08:30:00.000Z")).toBe("19. rujna 2026. u 10:30");
    expect(formatDateTimeHr("2026-12-31T23:05:00Z")).toBe("1. siječnja 2027. u 00:05");
    expect(formatDateTimeHr("2026-03-29T00:59:00Z")).toBe("29. ožujka 2026. u 01:59");
    expect(formatDateTimeHr("2026-03-29T01:00:00Z")).toBe("29. ožujka 2026. u 03:00");
    expect(formatDateTimeHr("2026-10-25T00:59:00Z")).toBe("25. listopada 2026. u 02:59");
    expect(formatDateTimeHr("2026-10-25T01:00:00Z")).toBe("25. listopada 2026. u 02:00");
  });

  it("reads a minute with no zone as Zagreb time and keeps what it cannot read", () => {
    expect(formatDateTimeHr("2026-07-01T09:15")).toBe("1. srpnja 2026. u 09:15");
    expect(formatDateTimeHr("2026-03-29T02:30")).toBe("2026-03-29T02:30");
    expect(formatDateTimeHr("2026-02-30T10:00")).toBe("2026-02-30T10:00");
    expect(formatDateTimeHr("kada god")).toBe("kada god");
    expect(formatDateTimeHr("")).toBe("");
  });

  test.prop([fc.integer({ min: Date.UTC(1971, 0, 1), max: Date.UTC(2099, 11, 31) })])(
    "equals the application's clock for any instant",
    (epochMs) => {
      const iso = new Date(epochMs).toISOString();
      expect(formatDateTimeHr(iso)).toBe(appFormat(iso));
    },
  );

  test.prop([
    fc.integer({ min: 1, max: 9999 }),
    fc.integer({ min: 0, max: 13 }),
    fc.integer({ min: 0, max: 32 }),
    fc.integer({ min: 0, max: 24 }),
    fc.integer({ min: 0, max: 60 }),
  ])("equals the application's clock for any Zagreb minute, real or not", (year, month, day, hour, minute) => {
    const local = `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
    expect(formatDateTimeHr(local)).toBe(appFormat(local));
  });

  test.prop([fc.string()])("equals the application's clock for any text", (text) => {
    expect(formatDateTimeHr(text)).toBe(appFormat(text));
  });
});
