// @vitest-environment jsdom
// ASIST-S1: the "Što se bilježi" list names the Assistant's conversations only when the Assistant works. Invented data.
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { studentHostHr as t } from "../i18n/messages.hr.ts";
import HostNotice from "./HostNotice";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const base = {
  assignmentId: "00000000-0000-4000-8000-000000000001", versionNo: 1, title: "Izmišljeni zadatak", instructions: "Upute.",
  workType: "essay", evidenceProfile: "basic", opensAt: "2020-01-01T00:00:00.000Z", dueAt: "2099-01-01T00:00:00.000Z",
  aiPolicy: "partially_allowed", aiPurposes: ["proofreading"], wordMin: null, wordMax: null, acknowledgedAt: null,
} as const;

async function textOf(view: Record<string, unknown>) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const props = { view, timing: "open", editorHref: "/x", backHref: "/y", onReload: () => {}, onOpenWork: () => {} };
  await act(async () => { root.render(h(HostNotice, props as never)); });
  const text = host.textContent ?? "";
  act(() => root.unmount());
  return text;
}

describe("HostNotice and the Assistant", () => {
  afterEach(() => { document.body.innerHTML = ""; });
  it("lists the conversations when the Assistant works, also in the summary-only variant", async () => {
    expect(await textOf({ ...base })).toContain(t.student.recordedAssistant);
    expect(await textOf({ ...base, aiSummaryOnly: true })).toContain(t.student.recordedAssistant);
  });
  it("leaves them out when tools are prohibited or no purpose is allowed", async () => {
    expect(await textOf({ ...base, aiPolicy: "prohibited", aiPurposes: [] })).not.toContain(t.student.recordedAssistant);
    expect(await textOf({ ...base, aiPurposes: [] })).not.toContain(t.student.recordedAssistant);
  });
});
