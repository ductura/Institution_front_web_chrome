// @vitest-environment jsdom
// F4-STU-R11 (P-16, E-6c): the table of what changed between two versions of the notice. Invented versions only.
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";

import { NoticeChanges, noticeChanges, type ComparedVersion } from "./NoticeChanges";
import { changesText } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const time = (iso: string) => `vrijeme ${iso.slice(0, 10)}`;
const v1: ComparedVersion = { versionNo: 1, dueAt: "2099-01-08T22:59:00.000Z", wordMin: 1200, wordMax: 1600, aiPurposes: ["proofreading"] };
const v2: ComparedVersion = { versionNo: 2, dueAt: "2099-01-15T22:59:00.000Z", wordMin: 1500, wordMax: 2000, aiPurposes: ["proofreading", "literature_search"] };

beforeEach(() => { document.body.innerHTML = ""; });

function render(previous: ComparedVersion, current: ComparedVersion) {
  const host = document.body.appendChild(document.createElement("div"));
  act(() => { createRoot(host).render(createElement(NoticeChanges, { previous, current, time })); });
  return host.querySelector("table")!;
}

describe("noticeChanges", () => {
  it("gives the deadline, the word range and the tool rule of both versions, in the prototype's order", () => {
    const rows = noticeChanges(v1, v2, time);
    expect(rows.map((row) => row.label)).toEqual([changesText.due, changesText.words, changesText.tools]);
    expect(rows[0]).toMatchObject({ before: "vrijeme 2099-01-08", after: "vrijeme 2099-01-15", changed: true });
    expect(rows[1]?.before).not.toBe(rows[1]?.after);
    expect(rows[2]?.before).toBe("Dopušteno: korištenje za lektoriranje i jezičnu provjeru vlastitih pisanih radova.");
    expect(rows[2]?.after).toContain("; pronalaženje znanstvene i stručne literature");
    expect(rows.every((row) => row.changed)).toBe(true);
  });

  it("marks a row unchanged when both versions say the same, and names no tools as not allowed", () => {
    const rows = noticeChanges({ ...v1, aiPurposes: [] }, { ...v2, dueAt: v1.dueAt, aiPurposes: [] }, time);
    expect(rows[0]?.changed).toBe(false);
    expect(rows[2]).toMatchObject({ changed: false });
    expect(rows[2]?.after).toContain("nije dopuštena");
  });
});

describe("NoticeChanges", () => {
  it("is a table with the version numbers in the caption and the headers, and row headers per item", () => {
    const table = render(v1, v2);
    expect(table.querySelector("caption")?.textContent).toBe("Što se promijenilo (v1 → v2)");
    expect([...table.querySelectorAll("thead th")].map((th) => [th.textContent, th.getAttribute("scope")])).toEqual([
      ["Stavka", "col"], ["Bilo (v1)", "col"], ["Sada (v2)", "col"],
    ]);
    expect([...table.querySelectorAll("tbody th[scope=row]")].map((th) => th.textContent)).toEqual(["Rok", "Opseg riječi", "Pravilo uporabe alata"]);
  });

  it("uses the real version numbers, not always v1 and v2", () => {
    const table = render({ ...v1, versionNo: 3 }, { ...v2, versionNo: 4 });
    expect(table.querySelector("caption")?.textContent).toBe("Što se promijenilo (v3 → v4)");
  });
});
