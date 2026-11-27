// WEB-1220: the entry-method share on the student's step 5 and the teacher's N-07.
import { SHARE_CATEGORIES, shareIsConsistent } from "@ductura/ui";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ProvenancePort } from "../../client/provenance";
import { screenProvenance, VECTOR_9_1 } from "../../client/provenance-fake";
import { provenanceShareHr } from "../../lib/i18n/messages.hr";
import { findForbiddenTerms } from "../../../scripts/forbidden-terms/terms";

import { ProvenancePanel, readProvenance } from "./ProvenancePanel";

const NOTICE = "Prikazuje samo kako je tekst unesen. Ne pokazuje tko je autor teksta.";
const render = async (port: ProvenancePort, id: string) =>
  renderToStaticMarkup(<ProvenancePanel read={await readProvenance(port, id)} />);
const page = (path: string) => readFileSync(new URL(`../../app/${path}`, import.meta.url), "utf8");

describe("WEB-1220 provenance panel", () => {
  it("shows the notice beside the share and beside the marks", async () => {
    const html = await render(screenProvenance, "rad-izmisljeni-1");
    expect(provenanceShareHr.notice).toBe(NOTICE);
    expect(html.split(NOTICE)).toHaveLength(3);
    for (const percent of ["53 %", "18 %", "17 %", "9 %", "3 %"]) expect(html).toContain(percent);
    expect(html).toContain("<mark");
  });

  it("S-08 K5: a failed read is a role=alert frame without a retry link or button, as on N-04", async () => {
    const failing: ProvenancePort = { read: async () => { throw new Error("izmišljena greška"); } };
    const html = await render(failing, "rad-izmisljeni-1");
    expect(html).toContain('role="alert"');
    expect(html).toContain(provenanceShareHr.error);
    expect(html).not.toContain(provenanceShareHr.retry);
    expect(html).not.toContain("<button");
  });

  it("renders the same view for the student's and the teacher's screen", async () => {
    const student = await render(screenProvenance, "rad-izmisljeni-1");
    const teacher = await render(screenProvenance, "doc-izmisljeni-2");
    // useId differs only by render order; compare without the generated ids.
    const strip = (html: string) => html.replace(/(id|aria-describedby)="[^"]*"/g, "$1=\"\"");
    expect(strip(student)).toBe(strip(teacher));
  });

  it("holds a fake record the view accepts, in the view's category order", () => {
    expect(VECTOR_9_1.kind === "ready" && shareIsConsistent(VECTOR_9_1.share)).toBe(true);
    expect(VECTOR_9_1.kind === "ready" && VECTOR_9_1.share.categories.map((c) => c.category)).toEqual([...SHARE_CATEGORIES]);
  });

  it("has labels with no forbidden term", () => {
    expect(findForbiddenTerms(JSON.stringify(provenanceShareHr))).toEqual([]);
    // The term list folds its patterns on first use, which is slow on a loaded machine.
  }, 60_000);

  it("offers no action on a ready record", async () => {
    expect(await render(screenProvenance, "rad-izmisljeni-1")).not.toContain("<button");
  });

  it("reads a failing port as the error variant", async () => {
    const failing: ProvenancePort = { read: () => Promise.reject(new Error("izmišljeni kvar")) };
    const html = await render(failing, "x");
    expect(html).toContain(provenanceShareHr.error);
    expect(html).not.toContain("%");
  });

  it("is mounted on both submission screens from the same port, with no role", () => {
    for (const path of ["rad/[assignmentId]/predaja/potvrda/page.tsx", "nastavnik/rad/[id]/predaja/page.tsx"]) {
      const source = page(path);
      expect(source).toContain("const PROVENANCE = screenProvenance;");
      expect(source).toContain("<ProvenancePanel read={provenance} />");
    }
  });
});
