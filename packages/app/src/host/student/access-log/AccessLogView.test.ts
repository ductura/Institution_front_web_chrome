// WEB-2113: the host's copy of the access log view draws the same text as
// src/components/student/access-log-view.test.ts expects of the shared one.
// Invented names and ids only.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { studentHostHr } from "../i18n/messages.hr";
import { AccessLogDays, AccessLogUnavailable, dayHeading, readerLabel } from "./AccessLogView";
import { accessLogDaysOf, type AccessLogEntry } from "./days";

const a = studentHostHr.accessLog;
const entry = (over: Partial<AccessLogEntry> = {}): AccessLogEntry => ({
  id: "00000000-0000-4000-8000-000000000001", at: "2026-11-09T10:02:00.000Z", role: "mentor", surface: "live_view",
  reader: { givenName: "Nastavnik", familyName: "B" }, ...over,
});

describe("AccessLogView (host copy)", () => {
  it("heads a day with the Zagreb weekday and date, and names the reader with the role", () => {
    const [day] = accessLogDaysOf([entry()]);
    expect(dayHeading(day!)).toBe("Ponedjeljak, 9. 11. 2026.");
    expect(readerLabel(day!.entries[0]!)).toBe("Nastavnik B · mentor");
    expect(readerLabel({ ...day!.entries[0]!, reader: null })).toBe("Mentor");
  });

  it("draws a row with its window, reader and surface, and the older link only when given", () => {
    const html = renderToStaticMarkup(createElement(AccessLogDays, { days: accessLogDaysOf([entry()]), olderHref: "/x?prije=1" }));
    expect(html).toContain("Nastavnik B · mentor");
    expect(html).toContain(a.surfaces.live_view);
    expect(html).toContain(a.older);
    expect(renderToStaticMarkup(createElement(AccessLogDays, { days: accessLogDaysOf([entry()]), olderHref: null }))).not.toContain(a.older);
  });

  it("says empty, no older openings and unavailable in their own words", () => {
    expect(renderToStaticMarkup(createElement(AccessLogDays, { days: [], olderHref: null }))).toContain(a.empty);
    const continued = renderToStaticMarkup(createElement(AccessLogDays, { days: [], olderHref: null, newestHref: "/x" }));
    expect(continued).toContain(a.noOlder);
    expect(continued).toContain(a.newest);
    const down = renderToStaticMarkup(createElement(AccessLogUnavailable, { retryHref: "/x" }));
    expect(down).toContain(a.unavailable);
    expect(down).toContain(a.retry);
  });
});
