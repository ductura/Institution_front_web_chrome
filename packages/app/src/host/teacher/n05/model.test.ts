import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { bySurname, fullName } from "../../../../../../src/components/teacher/fast-path";
import { DEMO_FAST_PATH } from "../../../../../../src/lib/i18n/demo-fast-path.hr";

import { FastPathBody } from "./FastPathPage";
import { fastPathHostText as t } from "./messages.hr";
import { assignmentOf, detailLines, fastPathRead, stateText } from "./model";

const started = DEMO_FAST_PATH.find((s) => s.record !== null && s.record.pastesWithoutSource > 0)!;
const clean = DEMO_FAST_PATH.find((s) => s.record !== null && s.record.pastesWithoutSource === 0)!;
const render = (students: typeof DEMO_FAST_PATH) =>
  renderToStaticMarkup(createElement(FastPathBody, { students, hrefOf: (path: string) => `/demo${path}` }));

describe("N-05 fast path read", () => {
  it("maps every answer of readFastPath to the host page's read", () => {
    expect(fastPathRead({ kind: "ok", students: DEMO_FAST_PATH })).toEqual({ kind: "ready", value: DEMO_FAST_PATH });
    expect(fastPathRead({ kind: "signedOut" })).toEqual({ kind: "signedOut" });
    expect(fastPathRead({ kind: "forbidden" })).toEqual({ kind: "notTeacher" });
    expect(fastPathRead({ kind: "unavailable" })).toEqual({ kind: "unavailable" });
  });

  it("reads the assignment from ?zadatak= and ignores a blank one", () => {
    expect(assignmentOf(" a1 ")).toBe("a1");
    expect(assignmentOf("  ")).toBeNull();
    expect(assignmentOf(null)).toBeNull();
  });
});

describe("N-05 fast path details", () => {
  it("names the state as a word only, without the dot", () => {
    expect(DEMO_FAST_PATH.map(stateText)).toEqual(DEMO_FAST_PATH.map((s) => t.work[s.work]));
    expect(DEMO_FAST_PATH.map(stateText).join(" ")).not.toMatch(/[●•]/);
  });

  it("lists Stanje, Zadnja promjena, Lijepljenja bez izvora and Stanje zapisa in that order", () => {
    const lines = detailLines(started, started.record!);
    expect(lines.map((l) => l.key)).toEqual(["state", "lastChange", "pastes", "record"]);
    expect(lines.map((l) => l.label).slice(0, 3)).toEqual([t.lines.state, t.lines.lastChange, t.lines.pastes]);
    expect(lines[2]!.value).toBe(t.pastesSome);
    expect(detailLines(clean, clean.record!)[2]!.value).toBe(t.pastesNone);
  });
});

describe("N-05 fast path body", () => {
  it("says there are no works when the assignment has none", () => {
    const html = render([]);
    expect(html).toContain(t.emptyTitle);
    expect(html).toContain(t.emptyText);
  });

  it("opens the first student by surname and links the live work through the host base", () => {
    const html = render(DEMO_FAST_PATH);
    const order = bySurname(DEMO_FAST_PATH).map(fullName);
    expect(order.map((n) => html.indexOf(n)).every((i) => i >= 0)).toBe(true);
    expect(html.indexOf(order[0]!)).toBeLessThan(html.indexOf(order[1]!));
    expect(html).toContain('href="/demo/');
  });

  it("says a work not yet started has no text and no summary", () => {
    const html = render(DEMO_FAST_PATH.filter((s) => s.record === null));
    expect(html).toContain(t.notStarted);
    expect(html).not.toContain(t.lines.pastes);
  });
});
