// DAN-913-2: adapted from Ductus src/components/student/access-log-view.test.ts
// (DAN-294). The rows are wire entries of student.access-log.get, so an
// unknown role or surface arrives as "unknown". Invented names and ids only.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messagesHr } from "../../../locales/hr.ts";
import { findForbiddenTerms } from "../../../scripts/forbidden-terms/terms.ts";

import { accessLogDaysOf, type AccessLogEntry } from "./access-log-days";
import AccessLogView, { dayHeading, readerLabel, type AccessLogViewState } from "./AccessLogView";

const a = messagesHr.accessLog;
const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const entry = (n: number, at: string, over: Partial<AccessLogEntry> = {}): AccessLogEntry => ({
  id: id(n), at, role: "mentor", surface: "live_view", reader: { givenName: "Nastavnik", familyName: "B" }, ...over,
});
const render = (view: AccessLogViewState) => renderToStaticMarkup(createElement(AccessLogView, { view }));
const html = (entries: AccessLogEntry[], olderHref: string | null = null, newestHref: string | null = null) =>
  render({ kind: "days", days: accessLogDaysOf(entries), olderHref, newestHref });

describe("DAN-913-2 access log view", () => {
  it("error: an alert and a retry link, no list", () => {
    const out = render({ kind: "unavailable", retryHref: "/rad/x/dnevnik-pristupa" });
    expect(out).toContain(`role="alert">${a.unavailable}`);
    expect(out).toContain(`href="/rad/x/dnevnik-pristupa">${a.retry}</a>`);
    expect(out).not.toContain("<ul");
  });

  it("an empty continuation says no older openings, never that the log is empty", () => {
    const out = html([], null, "/x");
    expect(out).toContain(a.noOlder);
    expect(out).not.toContain(a.empty);
    expect(out).toContain(`href="/x">${a.newest}</a>`);
    expect(html([])).not.toContain(a.noOlder);
  });

  it("empty: the empty note, no list and no older link", () => {
    const out = html([], "/x?prije=a&zapis=b");
    expect(out).toContain(a.empty);
    expect(out).not.toContain("<ul");
    expect(out).not.toContain(a.older);
  });

  it("each opening in one window is its own row; nothing counted, summed or timed", () => {
    const out = html([entry(1, "2026-11-10T13:10:00.000Z"), entry(2, "2026-11-10T13:10:00.000Z"), entry(3, "2026-11-10T13:10:00.000Z")]);
    expect(out.match(/<li /g)).toHaveLength(3);
    expect(out).not.toMatch(/\b[0-9]+\s*(puta|posjet|otvaranj|minuta ukupno|min\b|h\b)/i);
    expect(out).not.toMatch(/ukupno|trajanje|broj/i);
  });

  it("filled: one section per day, newest first, each row time, who and what", () => {
    const out = html([
      entry(1, "2026-11-09T10:40:00.000Z", { role: "teacher", reader: { givenName: "Nastavnik", familyName: "C" }, surface: "process_summary" }),
      entry(2, "2026-11-10T13:10:00.000Z"),
    ]);
    expect(out.indexOf("Utorak, 10. 11. 2026.")).toBeLessThan(out.indexOf("Ponedjeljak, 9. 11. 2026."));
    expect(out).toMatch(/<time class="[^"]+" dateTime="2026-11-10T13:10:00.000Z">14:10–14:15<\/time>/);
    expect(out).toContain(`Nastavnik B · ${a.roles.mentor}`);
    expect(out).toContain(`Nastavnik C · ${a.roles.teacher}`);
    expect(out).toContain(a.surfaces.process_summary);
    expect(out.match(/<li /g)).toHaveLength(2);
    expect(out).toMatch(/<section[^>]*aria-labelledby="dan-2026-11-10"/);
  });

  it("a reader without a name is the role alone; an unknown role or surface stays visible", () => {
    const out = html([
      entry(1, "2026-11-10T13:10:00.000Z", { reader: null, role: "seminar_teacher" }),
      entry(2, "2026-11-10T13:05:00.000Z", { role: "unknown", surface: "unknown" }),
    ]);
    expect(out).toContain(`<span>${a.roleAlone.seminar_teacher}</span>`);
    expect(out).toContain(`Nastavnik B · ${a.roles.unknown}`);
    expect(out).toContain(a.surfaces.unknown);
  });

  it("the older link is a plain link to the given address, only when given; newest after it", () => {
    const one = [entry(1, "2026-11-10T13:10:00.000Z")];
    expect(html(one, "/x?prije=a&zapis=b")).toMatch(new RegExp(`<a class="[^"]+" href="/x\\?prije=a&amp;zapis=b">${a.older}</a>`));
    expect(html(one)).not.toContain(a.older);
    const both = html(one, "/x?prije=a&zapis=b", "/x");
    expect(both).toContain(`href="/x">${a.newest}</a>`);
    expect(both.indexOf(a.older)).toBeLessThan(both.indexOf(a.newest));
    expect(html(one)).not.toContain(a.newest);
  });

  it("on the autumn change two windows with one Zagreb wall clock keep distinct instants", () => {
    const out = html([entry(1, "2026-10-25T00:00:00.000Z"), entry(2, "2026-10-25T01:00:00.000Z")]);
    expect(out.match(/>02:00–02:05</g)).toHaveLength(2);
    expect(out).toContain('dateTime="2026-10-25T00:00:00.000Z"');
    expect(out).toContain('dateTime="2026-10-25T01:00:00.000Z"');
  });

  it("headings and labels", () => {
    expect(dayHeading(accessLogDaysOf([entry(1, "2026-03-29T00:55:00.000Z")])[0]!)).toBe("Nedjelja, 29. 3. 2026.");
    const [row] = accessLogDaysOf([entry(1, "2026-11-10T13:10:00.000Z", { reader: null })])[0]!.entries;
    expect(readerLabel(row!)).toBe(a.roleAlone.mentor);
  });

  it("no catalogue text of the screen uses a forbidden term", () => {
    expect(findForbiddenTerms(JSON.stringify(a))).toEqual([]);
    expect(findForbiddenTerms(html([entry(1, "2026-11-10T13:10:00.000Z")], "/x"))).toEqual([]);
  });
});
