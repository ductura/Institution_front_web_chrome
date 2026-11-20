// WEB-33 (N-17): the teacher's overview of one assignment, over invented rows
// only (TODO(ugovor): the shape of teacher.assignment-overview.get until 3.2.0).
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../scripts/forbidden-terms/terms.ts";
import type { OverviewRow } from "@/client/teacher-reads";
import { messagesHr } from "@/lib/i18n/messages.hr";

import AssignmentOverview, { chooseAssignment, OVERVIEW_COLUMNS, submissionHref } from "./AssignmentOverview";

const t = messagesHr.teacherSummary;
const A = "00000000-0000-4000-8000-0000000000a1";
const S = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

const row = (n: number, over: Partial<OverviewRow> = {}): OverviewRow => ({
  studentId: S(n), name: `Izmišljena Osoba ${n}`, group: "A",
  submitted: false, requestedMinute: null, afterDeadline: false, evidenceRecord: null, ...over,
});
const ROWS: OverviewRow[] = [
  row(1),
  row(2, { group: "B", submitted: true, requestedMinute: "2026-11-02T13:32Z", evidenceRecord: "continuous" }),
  row(3, { submitted: true, requestedMinute: "2026-11-20T09:05Z", afterDeadline: true, evidenceRecord: "with_gaps" }),
  row(4, { name: null, group: null, submitted: true, requestedMinute: "2026-11-01T08:00Z", evidenceRecord: null }),
];

const render = (rows: readonly OverviewRow[] | null, extra: { loading?: boolean; retryHref?: string } = {}) =>
  renderToStaticMarkup(h(AssignmentOverview, { assignmentTitle: "Izmišljeni zadatak", rows, ...extra }));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
/** The cells of the row whose header holds `marker`. */
const cells = (html: string, marker: string) => {
  const tr = html.split("<tr>").find((part) => part.includes(marker)) ?? "";
  return [...tr.matchAll(/<t[hd][^>]*>(.*?)<\/t[hd]>/g)].map((m) => text(m[1] ?? "").trim());
};

describe("AssignmentOverview (N-17)", () => {
  it("has a caption and the six columns, the student as row header", () => {
    const html = render(ROWS);
    expect(html).toContain("<caption");
    expect(text(html)).toContain("Predaje zadatka Izmišljeni zadatak");
    for (const header of Object.values(t.columns)) expect(html).toContain(header);
    expect(html.match(/<th scope="row"/g)?.length).toBe(4);
  });

  it("shows submitted, after the deadline and not submitted", () => {
    const html = render(ROWS);
    expect(cells(html, "Osoba 1")).toEqual(["Izmišljena Osoba 1 · grupa A", "○ Nije predano", "–", "–", "–", ""]);
    expect(cells(html, "Osoba 2")).toEqual(["Izmišljena Osoba 2 · grupa B", "✓ Predano", "2. studenoga 2026. u 14:32", "Ne", "Zapis je cjelovit", ""]);
    expect(cells(html, "Osoba 3")).toEqual(["Izmišljena Osoba 3 · grupa A", "✓ Predano", "20. studenoga 2026. u 10:05", "! Nakon roka", "◌ Praznina u zapisu", ""]);
  });

  it("shows a missing name as missing, never a stand-in, and a receipt not yet bound as waiting", () => {
    const html = render(ROWS);
    expect(cells(html, t.noName)).toEqual([`${t.noName} · ${t.noGroup}`, "✓ Predano", "1. studenoga 2026. u 09:00", "Ne", "… Čeka potvrdu", ""]);
  });

  it("draws no link until N-07 has a teacher route (TODO(N-07))", () => {
    expect(render(ROWS)).not.toContain("<a ");
  });

  it("says a failed read is unavailable, with a retry, and never draws an empty table", () => {
    const html = render(null, { retryHref: "/nastavnik/zbirni?zadatak=x" });
    expect(html).toContain('role="alert"');
    expect(text(html)).toContain(t.unavailable);
    expect(html).toContain('href="/nastavnik/zbirni?zadatak=x"');
    expect(html).not.toContain("<table");
    expect(text(html)).not.toContain(t.noStudents);
  });

  it("is busy while loading, without rows", () => {
    const html = render(null, { loading: true });
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('scope="row"');
  });

  it("chooses the asked assignment only when it is the teacher's, else the first", () => {
    const choices = [{ id: A, title: "Prvi", label: "K · Prvi" }, { id: S(9), title: "Drugi", label: "K · Drugi" }];
    expect(chooseAssignment(choices, S(9))?.title).toBe("Drugi");
    expect(chooseAssignment(choices, "00000000-0000-4000-8000-0000000000ff")?.title).toBe("Prvi");
    expect(chooseAssignment(choices, [S(9), A])?.title).toBe("Prvi");
    expect(chooseAssignment(choices, undefined)?.title).toBe("Prvi");
    expect(chooseAssignment([], A)).toBeNull();
  });

  it("sorts by submission time on its instant, rows without a time last", () => {
    const column = OVERVIEW_COLUMNS.find((c) => c.id === "submittedAt");
    const keys = ROWS.map((r) => column?.sortValue?.(r));
    expect(keys[0]).toBeNull();
    expect((keys[3] as Date).toISOString()).toBe("2026-11-01T08:00:00.000Z");
    expect(render(ROWS)).toContain('<button type="button"');
    // Only name and time sort: state, record and revision are no ranking (§5 rule 2).
    expect(OVERVIEW_COLUMNS.filter((c) => c.sortValue).map((c) => c.id)).toEqual(["student", "submittedAt"]);
  });

  it("shows the empty row when the assignment has no students", () => {
    expect(text(render([]))).toContain(t.noStudents);
  });

  it("uses no forbidden term", () => {
    expect(findForbiddenTerms(JSON.stringify(t))).toEqual([]);
    expect(findForbiddenTerms(text(render(ROWS)))).toEqual([]);
  });
});

describe("row link to N-07 (TODO(ugovor): documentId)", () => {
  const DOC = "doc-izmisljeni-1";
  it("builds /nastavnik/rad/{documentId}/predaja and encodes the id", () => {
    expect(submissionHref({ ...row(2), documentId: DOC })).toBe(`/nastavnik/rad/${DOC}/predaja`);
    expect(submissionHref({ ...row(2), documentId: "a/b" })).toBe("/nastavnik/rad/a%2Fb/predaja");
  });
  it("gives no link without a usable document id", () => {
    expect(submissionHref(row(2))).toBeNull();
    expect(submissionHref({ ...row(2), documentId: ".." })).toBeNull();
    expect(submissionHref({ ...row(2), documentId: " x" })).toBeNull();
  });
  it("links only a submitted row", () => {
    const html = render([
      row(2, { submitted: true, requestedMinute: "2026-11-02T13:32Z", evidenceRecord: "continuous" }) as OverviewRow,
      row(1),
    ].map((r, i) => ({ ...r, documentId: `doc-${i}` })));
    expect(html).toContain('href="/nastavnik/rad/doc-0/predaja"');
    expect(html).not.toContain("doc-1");
  });
});
