// WEB-1502: the table of submissions over invented rows only.
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildRows, viewHref, type TableRow } from "./model";
import SubmissionsTable from "./SubmissionsTable";

const D = (n: number) => `00000000-0000-4000-8000-0000000000d${n}`;
const S = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const sub = (n: number, over: Record<string, unknown> = {}) => ({
  studentId: S(n), documentId: D(n), submitted: true, revision: 2, requestedMinute: "2026-11-02T13:32Z", afterDeadline: false, ...over,
}) as never;
const overview = [{ studentId: S(1), name: "Izmišljena Osoba 1", group: "A" }, { studentId: S(2), name: "Izmišljena Osoba 2", group: null }] as never;

const render = (rows: readonly TableRow[]) =>
  renderToStaticMarkup(h(SubmissionsTable, { assignmentTitle: "Izmišljeni zadatak", rows, href: (p: string) => `/app/web${p}` }));

describe("SubmissionsTable (M7.2)", () => {
  it("shows student, revision, time and the late tag from the server's field", () => {
    const html = render(buildRows([
      sub(1),
      sub(2, { afterDeadline: true }),
      sub(3, { submitted: false, revision: null, requestedMinute: null, afterDeadline: null, documentId: null }),
    ], overview));
    expect(html).toContain("<caption");
    expect(html).toContain("Izmišljena Osoba 1 · grupa A");
    expect(html.match(/data-state="late"/g)?.length).toBe(1);
    expect(html).toContain("Nije predano");
    expect(html).toContain(`href="/app/web/nastavnik/rad/${D(1)}/predaja"`);
    expect(html.match(/Pregled predane verzije/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("never computes lateness: a late minute with afterDeadline false is not tagged", () => {
    const html = render(buildRows([sub(1, { requestedMinute: "2099-01-01T00:00Z", afterDeadline: false })], null));
    expect(html).not.toContain('data-state="late"');
  });

  it("says a missing name instead of inventing one", () => {
    expect(render(buildRows([sub(1)], null))).toContain("Ime nije dostupno");
  });

  it("shows the empty state without submissions", () => {
    expect(render([])).toContain("Za ovaj zadatak još nema predaja.");
  });

  it("links only a submitted work with a safe document id", () => {
    const [row] = buildRows([sub(1)], null);
    expect(viewHref(row!)).toBe(`/nastavnik/rad/${D(1)}/predaja`);
    expect(viewHref({ ...row!, documentId: ".." })).toBeNull();
    expect(viewHref({ ...row!, documentId: null })).toBeNull();
    expect(viewHref({ ...row!, submitted: false })).toBeNull();
  });
});
