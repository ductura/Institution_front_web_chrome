import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messagesHr } from "@/lib/i18n/messages.hr";

import LiveWorkView, { isWorkId, liveWorkHref, submissionHref, SUMMARY_ANCHOR, type LiveWorkFrame } from "./LiveWorkView";

const t = messagesHr.teacherLiveWork;

// Invented work and people (demo-*); no real student data.
const FRAME: LiveWorkFrame = {
  studentName: "Demo Studentica",
  assignmentTitle: "Izmišljeni seminar: javne politike",
  submitted: false,
  previousId: "demo-rad-1",
  nextId: "demo-rad-3",
};

const render = (props: Partial<Parameters<typeof LiveWorkView>[0]> = {}) =>
  renderToStaticMarkup(h(LiveWorkView, {
    documentId: "demo-rad-2", frame: FRAME, recordState: "complete", text: h("p", null, "TEKST"), ...props,
  }));

describe("LiveWorkView (WEB-34, N-06)", () => {
  it("shows the student, the assignment, the neighbours and the text slot", () => {
    const html = render();
    expect(html).toContain("<h1>Demo Studentica</h1>");
    expect(html).toContain("Izmišljeni seminar: javne politike");
    expect(html).toContain(`href="/nastavnik/rad/demo-rad-1" rel="prev"`);
    expect(html).toContain(`href="/nastavnik/rad/demo-rad-3" rel="next"`);
    expect(html).toContain("<p>TEKST</p>");
  });

  it("shows the not-submitted bar without any link and no link to the submission", () => {
    const html = render();
    const bar = /<p[^>]*data-bar="not-submitted"[^>]*>(.*?)<\/p>/.exec(html);
    expect(bar?.[1]).toBe(t.notSubmitted);
    expect(html).not.toContain("/predaja");
  });

  it("links to N-07 only once the work is submitted, and drops the not-submitted bar", () => {
    const html = render({ frame: { ...FRAME, submitted: true } });
    expect(html).toContain(`href="/nastavnik/rad/demo-rad-2/predaja"`);
    expect(html).not.toContain('data-bar="not-submitted"');
  });

  it("shows the gap bar with a link to the summary only when the summary says has_gaps (C-18)", () => {
    expect(render()).not.toContain('data-bar="gaps"');
    expect(render({ recordState: null })).not.toContain('data-bar="gaps"');
    const html = render({ recordState: "has_gaps" });
    expect(html).toContain(t.gaps);
    expect(html).toContain(`href="#${SUMMARY_ANCHOR}"`);
    expect(html).toContain(`id="${SUMMARY_ANCHOR}"`);
  });

  it("without a frame shows only the context title and the text, never a guessed state", () => {
    const html = render({ frame: null, recordState: null });
    expect(html).toContain(`<h1>${t.untitled}</h1>`);
    expect(html).not.toContain("data-bar");
    expect(html).not.toContain("<nav");
  });

  it("leaves out a neighbour it has no id for, and the name it does not have is never invented", () => {
    const html = render({ frame: { ...FRAME, studentName: null, previousId: null, nextId: ".." } });
    expect(html).toContain(`<h1>${t.untitled}</h1>`);
    expect(html).not.toContain("<nav");
  });

  it("offers neither a revision request nor a deadline extension (waves 8 and 11)", () => {
    const html = render({ recordState: "has_gaps" }).toLowerCase();
    expect(html).not.toContain("dorad");
    expect(html).not.toContain("produlj");
  });
});

describe("work links", () => {
  it("encodes the id and refuses ids no route could read", () => {
    expect(liveWorkHref("a b/c")).toBe("/nastavnik/rad/a%20b%2Fc");
    expect(submissionHref("x")).toBe("/nastavnik/rad/x/predaja");
    for (const bad of ["", " x", ".", "..", "a\u0000b", "x".repeat(257), 7, null]) {
      expect(isWorkId(bad)).toBe(false);
      expect(liveWorkHref(bad)).toBeNull();
      expect(submissionHref(bad)).toBeNull();
    }
    expect(isWorkId("č".repeat(256))).toBe(true);
  });
});
