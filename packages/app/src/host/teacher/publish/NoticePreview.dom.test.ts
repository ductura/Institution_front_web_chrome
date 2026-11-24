// @vitest-environment jsdom
// NZ-7a on the screen: the block "Ovako će student vidjeti obavijest" shows the allowed purposes of the real closed
// list (AI_PURPOSES), the grouped word range and no student name. Every value here is invented.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { AI_PURPOSES } from "@/components/teacher/assignment-create";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { noticePreviewHr as text } from "./messages.hr";
import { NoticePreview } from "./NoticePreview";
import type { NoticeFields } from "./notice-preview";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const labels = messagesHr.facultyRuleVersions.purposeLabels;
const FIELDS: NoticeFields = {
  versionNo: 3, dueAt: "2027-01-31T22:59:00.000Z", aiPolicy: "partially_allowed",
  aiPurposes: ["transcription", "proofreading"], importAllowed: true, wordMin: 2000, wordMax: 2500,
};

describe("NoticePreview (NZ-7a)", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; });

  const mount = (fields: NoticeFields) => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => root?.render(h(NoticePreview, { fields })));
    const section = host.querySelector("section")!;
    const rows = new Map([...section.querySelectorAll("dl > div")].map((d) => [d.querySelector("dt")!.textContent, d.querySelector("dd")!.textContent]));
    return { section, rows };
  };

  it("is a named region with one row per field, purposes in the order of the article", () => {
    const { section, rows } = mount(FIELDS);
    const heading = document.getElementById(section.getAttribute("aria-labelledby")!)!;
    expect(heading.tagName).toBe("H2");
    expect(heading.textContent).toBe(text.title);
    expect([...rows.keys()]).toEqual([text.due, text.tools, text.scope, text.importing, text.version]);
    expect(rows.get(text.due)).toBe("31. 1. 2027. u 23:59");
    expect(rows.get(text.tools)).toBe(`Asistent je dopušten za: ${labels.proofreading}, ${labels.transcription}`);
    expect(rows.get(text.scope)).toBe("2\u00a0000–2\u00a0500 riječi");
    expect(rows.get(text.importing)).toBe(text.importYes);
    expect(rows.get(text.version)).toBe("3");
  });

  it.each(AI_PURPOSES)("shows %s as allowed when the version allows it (the old map dropped four of five)", (purpose) => {
    const { rows } = mount({ ...FIELDS, aiPurposes: [purpose] });
    expect(rows.get(text.tools)).toBe(`Asistent je dopušten za: ${labels[purpose]}`);
    expect(rows.get(text.tools)).not.toBe(text.toolsNone);
  });

  it("says no assistant for a version that allows none, and no limit in words", () => {
    const { rows } = mount({ ...FIELDS, aiPolicy: "prohibited", aiPurposes: [], wordMin: null, wordMax: null, importAllowed: false });
    expect(rows.get(text.tools)).toBe(text.toolsNone);
    expect(rows.get(text.scope)).toBe(text.noLimit);
    expect(rows.get(text.importing)).toBe(text.importNo);
  });
});
