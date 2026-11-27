import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../scripts/forbidden-terms/terms.ts";
import { packageView, type MerlinRow } from "../../../client/merlin-export.ts";
import { messagesHr } from "../../../lib/i18n/messages.hr.ts";

import { merlinHref } from "./links.ts";
import MerlinExport, { canDownload, reasonLines, statusLines, type ExportStatus } from "./MerlinExport.tsx";

// Every id, name, date and digest below is invented.
const t = messagesHr.merlinExport;
const A = "00000000-0000-4000-8000-0000000000a1";
const P = "00000000-0000-4000-8000-0000000000b1";
const ZIP = "3f9a1c0e5b7d2a4c6e8f0a1b3c5d7e9f1a2b3c4d5e6f708192a3b4c5d6e7f809";
const EXPIRES = "2026-11-22T09:15:00.000Z";
const NONE = { submittedMinute: null, afterDeadline: null, pdfName: null, pdfSha256: null, docxName: null, docxSha256: null };
const ROWS: MerlinRow[] = [
  { familyName: "Anić", givenName: "Demo", submitted: true, submittedMinute: "2026-12-20T21:14:00.000Z", afterDeadline: false,
    pdfName: "anic-demo-000000e1.pdf", pdfSha256: "a".repeat(64), docxName: "anic-demo-000000e1.docx", docxSha256: "b".repeat(64) },
  { familyName: "Čolić", givenName: "Izmišljeni", submitted: false, ...NONE },
  { familyName: "Šimić", givenName: "Izmišljena", submitted: false, ...NONE },
  { familyName: null, givenName: null, submitted: true, submittedMinute: "2026-12-28T08:02:00.000Z", afterDeadline: true,
    pdfName: "student-000000e3.pdf", pdfSha256: "c".repeat(64), docxName: "student-000000e3.docx", docxSha256: "d".repeat(64) },
];
const READY = { id: P, state: "ready" as const, downloadPath: `/api/v1/teacher/assignments/${A}/merlin/packages/${P}/download`, expiresAt: EXPIRES, sha256: ZIP };

function render(rows: readonly MerlinRow[]) {
  return renderToStaticMarkup(<MerlinExport assignmentId={A} roster={{ kind: "ready", rows, extensionReasons: [] }} />);
}

describe("MerlinExport (WEB-1114)", () => {
  it("previews the rows in the server's order, the CSV's, without sorting them", () => {
    const markup = render(ROWS);
    const order = ["Anić", "Čolić", "Šimić", t.unnamed].map((name) => markup.indexOf(`>${name}<`));
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const reversed = render([...ROWS].reverse());
    const back = [t.unnamed, "Šimić", "Čolić", "Anić"].map((name) => reversed.indexOf(`>${name}<`));
    expect([...back].sort((a, b) => a - b)).toEqual(back);
  });

  it("shows the columns of the CSV in its order (D-286)", () => {
    const markup = render(ROWS);
    const columns = Object.values(t.columns).map((header) => markup.indexOf(header));
    expect(columns.every((at) => at > 0)).toBe(true);
    expect([...columns].sort((a, b) => a - b)).toEqual(columns);
    expect(markup).toContain("anic-demo-000000e1.docx");
    // Design alignment 27. 11. 2026. (A5): the fingerprints stay in the CSV, not on screen.
    expect(markup).not.toContain("d".repeat(64));
    expect(markup).not.toContain("SHA-256");
  });

  it("says a missing given name in words, as the family name (design alignment 27. 11. 2026.)", () => {
    const markup = render(ROWS.slice(3));
    expect(markup.split(`>${t.unnamed}<`).length - 1).toBe(2);
    expect(markup).not.toContain(`>${t.none}<`);
  });

  it("offers the package only when a work was submitted, and the CSV always", () => {
    expect(render(ROWS)).toContain(t.prepare);
    const none = render(ROWS.filter((r) => !r.submitted));
    expect(none).not.toContain(t.prepare);
    expect(none).toContain(t.noSubmissionsTitle);
    expect(none).toContain(t.csv);
  });

  it("says an unavailable roster as such, never as no students", () => {
    const markup = renderToStaticMarkup(<MerlinExport assignmentId={A} roster={{ kind: "unavailable" }} />);
    expect(markup).toContain(t.unavailable);
    expect(markup).not.toContain(t.empty);
    // Design alignment 27. 11. 2026. (D3): the alert box, with the link to try again under it.
    expect(markup).toMatch(new RegExp(`<p role="alert"[^>]*>[^<]*</p><p[^>]*><a[^>]*href="${merlinHref(A)}"[^>]*>${t.retry}</a>`));
  });

  it("says the package is being prepared while it is queued, without a download", () => {
    const status: ExportStatus = { kind: "view", view: packageView({ id: P, state: "queued" }, 0) };
    expect(statusLines(status)).toEqual({ tone: "status", lines: [t.preparing] });
    expect(statusLines({ kind: "pending" })).toEqual({ tone: "status", lines: [t.preparing] });
    expect(canDownload(status)).toBe(false);
  });

  it("allows the download only for a ready package before its expiry, with its expiry said", () => {
    const ready: ExportStatus = { kind: "view", view: packageView(READY, Date.parse(EXPIRES) - 1) };
    expect(canDownload(ready)).toBe(true);
    expect(statusLines(ready)?.lines[1]).toBe("Jedan paket (.zip) za ovaj zadatak. Poveznica vrijedi 24 h, do 22. studenoga 2026. u 10:15.");
    const expired: ExportStatus = { kind: "view", view: packageView(READY, Date.parse(EXPIRES)) };
    expect(canDownload(expired)).toBe(false);
    expect(statusLines(expired)).toEqual({ tone: "alert", lines: ["Poveznica za preuzimanje istekla je 22. studenoga 2026. u 10:15. Pripremite novi paket."] });
    for (const status of [{ kind: "none" }, { kind: "unknown" }, { kind: "notFound" }, { kind: "view", view: { kind: "neuspjeh" } }] as ExportStatus[]) {
      expect(canDownload(status)).toBe(false);
    }
  });

  it("copies the server's fingerprint of the ZIP exactly: 64 characters, no spaces", () => {
    const ready: ExportStatus = { kind: "view", view: packageView(READY, Date.parse(EXPIRES) - 1) };
    expect(canDownload(ready) ? ready.view.sha256 : null).toBe(ZIP);
  });

  it("lists the caller's own extension reasons with their scope", () => {
    expect(reasonLines([
      { studentId: null, dueAt: "2026-12-27T23:00:00.000Z", reasonId: "all" },
      { studentId: "00000000-0000-4000-8000-0000000000e3", dueAt: "2026-12-27T23:00:00.000Z", reasonId: "justified" },
    ])).toEqual([
      "Rok do 28. prosinca 2026. u 00:00: Produljenje za sve (svi studenti)",
      "Rok do 28. prosinca 2026. u 00:00: Opravdan razlog (jedan student)",
    ]);
  });

  it("links the page of an assignment", () => {
    expect(merlinHref(A)).toBe(`/nastavnik/zadatak/${A}/merlin`);
  });

  it("uses no forbidden term (PRODUCT §5)", () => {
    const all = (v: unknown): string[] => (typeof v === "string" ? [v] : Object.values(v as object).flatMap(all));
    expect(findForbiddenTerms(all(t).join("\n"))).toEqual([]);
  });
});
