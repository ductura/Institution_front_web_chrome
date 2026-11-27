// @vitest-environment jsdom
// F4-STU-R11: HostNotice shows "Što se promijenilo" only when the notice carries a previous version; without one the
// reading view stays as it was. Invented notice only.
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";

import type { StudentNoticeRead } from "../../../../../../src/client/student-notice.ts";
import HostNotice from "./HostNotice";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type View = Extract<StudentNoticeRead, { kind: "available" }>["view"];
const view: View = {
  assignmentId: "00000000-0000-4000-8000-000000000001", versionNo: 2, title: "Izmišljeni esej", instructions: "Upute.",
  workType: "essay", evidenceProfile: "basic", opensAt: "2026-01-01T08:00:00.000Z", dueAt: "2099-01-15T22:59:00.000Z",
  aiPolicy: "partially_allowed", aiPurposes: ["proofreading", "literature_search"], wordMin: 1500, wordMax: 2000, acknowledgedAt: null,
};
const previousVersion = {
  versionNo: 1, title: view.title, instructions: view.instructions, workType: "essay" as const, opensAt: view.opensAt,
  dueAt: "2099-01-08T22:59:00.000Z", aiPolicy: "partially_allowed" as const, aiPurposes: ["proofreading" as const],
  evidenceProfile: "basic" as const, wordMin: 1200, wordMax: 1600,
};

beforeEach(() => { document.body.innerHTML = ""; });

function render(shown: View) {
  const host = document.body.appendChild(document.createElement("div"));
  const noop = () => {};
  act(() => {
    createRoot(host).render(createElement(HostNotice, {
      view: shown, timing: "open", editorHref: "/uredivac", backHref: "/", onReload: noop, onOpenWork: noop,
    }));
  });
  return host;
}

describe("HostNotice and the previous version", () => {
  it("shows the table of changes before the notice when the previous version exists", () => {
    const host = render({ ...view, previousVersion });
    const table = host.querySelector("table");
    expect(table?.querySelector("caption")?.textContent).toBe("Što se promijenilo (v1 → v2)");
    expect(table?.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(host.querySelector("form")).not.toBeNull();
  });

  it("keeps the reading view unchanged without a previous version", () => {
    const withTable = render({ ...view, previousVersion });
    withTable.querySelector("table")?.remove();
    const without = render(view);
    expect(without.querySelector("table")).toBeNull();
    expect(without.innerHTML).toBe(withTable.innerHTML);
  });
});
