// WEB-33 (N-17): the teacher's overview of one assignment, over invented rows
// only (TODO(ugovor): the shape of teacher.assignment-overview.get until 3.2.0).
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../scripts/forbidden-terms/terms.ts";
import type { OverviewRow } from "@/client/teacher-reads";
import { messagesHr } from "@/lib/i18n/messages.hr";

import AssignmentOverview, { overviewColumns, submissionHref } from "./AssignmentOverview";

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

const render = (rows: readonly OverviewRow[]) =>
  renderToStaticMarkup(h(AssignmentOverview, { assignmentId: A, assignmentTitle: "Izmišljeni zadatak", rows }));
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
    expect(cells(html, "/predaja/" + S(4))).toEqual([`${t.noName} · ${t.noGroup}`, "✓ Predano", "1. studenoga 2026. u 09:00", "Ne", "… Čeka potvrdu", ""]);
  });

  it("leads each row to N-07 by assignment and student, and refuses ids no route could read", () => {
    const html = render(ROWS);
    expect(html).toContain(`href="/nastavnik/zadatak/${A}/predaja/${S(2)}"`);
    expect(submissionHref(A.toUpperCase(), S(1))).toBe(`/nastavnik/zadatak/${A}/predaja/${S(1)}`);
    expect(submissionHref(A, "../x")).toBeNull();
    expect(submissionHref("x", S(1))).toBeNull();
    expect(text(render([row(5, { studentId: "nije-uuid" })]))).toContain("Izmišljena Osoba 5");
    expect(render([row(5, { studentId: "nije-uuid" })])).not.toContain("<a ");
  });

  it("sorts by submission time on its instant, rows without a time last", () => {
    const column = overviewColumns(A).find((c) => c.id === "submittedAt");
    const keys = ROWS.map((r) => column?.sortValue?.(r));
    expect(keys[0]).toBeNull();
    expect((keys[3] as Date).toISOString()).toBe("2026-11-01T08:00:00.000Z");
    expect(render(ROWS)).toContain('<button type="button"');
    // Only name and time sort: state, record and revision are no ranking (§5 rule 2).
    expect(overviewColumns(A).filter((c) => c.sortValue).map((c) => c.id)).toEqual(["student", "submittedAt"]);
  });

  it("shows the empty row when the assignment has no students", () => {
    expect(text(render([]))).toContain(t.noStudents);
  });

  it("uses no forbidden term", () => {
    expect(findForbiddenTerms(JSON.stringify(t))).toEqual([]);
    expect(findForbiddenTerms(text(render(ROWS)))).toEqual([]);
  });
});
