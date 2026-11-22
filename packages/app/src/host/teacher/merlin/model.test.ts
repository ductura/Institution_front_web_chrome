import { describe, expect, it } from "vitest";
import {
  canDownload, hasSubmitted, merlinHref, reasonLines, rowCells, statusLines, type MerlinRow,
} from "./model";

const SENT: MerlinRow = {
  familyName: "Probić", givenName: "Ana", submitted: true, submittedMinute: "2026-11-05T09:30:00Z", afterDeadline: false,
  pdfName: "probic_esej.pdf", pdfSha256: "a".repeat(64), docxName: "probic_esej.docx", docxSha256: "b".repeat(64),
};
const NONE: MerlinRow = { ...SENT, familyName: null, givenName: null, submitted: false, submittedMinute: null, afterDeadline: null, pdfName: null, pdfSha256: null, docxName: null, docxSha256: null };

describe("N-18 rows", () => {
  it("gives eight cells for a submitted work", () => {
    const cells = rowCells(SENT);
    expect(cells).toHaveLength(8);
    expect(cells.slice(0, 3)).toEqual(["Probić", "Ana", "da"]);
    expect(cells[4]).toBe("ne");
    expect(cells.slice(5)).toEqual(["probic_esej.pdf", "a".repeat(64), "b".repeat(64)]);
  });
  it("says „nema” for a student without a submission", () => {
    expect(rowCells(NONE)).toEqual(["Ime nije dostupno", "nema", "ne", "nema", "nema", "nema", "nema", "nema"]);
  });
  it("finds whether a package has anything to carry", () => {
    expect(hasSubmitted([NONE])).toBe(false);
    expect(hasSubmitted([NONE, SENT])).toBe(true);
  });
});

describe("N-18 status", () => {
  it("says nothing before a request and a status while preparing", () => {
    expect(statusLines({ kind: "none" })).toBeNull();
    expect(statusLines({ kind: "pending" })).toEqual({ tone: "status", lines: ["Paket se priprema. Možete napustiti stranicu; paket ostaje u pripremi."] });
  });
  it("downloads only from a ready view", () => {
    const ready = { kind: "view", view: { kind: "spreman", downloadPath: "/x", expiresAt: "2026-11-06T20:50:00Z", sha256: "c".repeat(64) } } as const;
    expect(canDownload(ready)).toBe(true);
    expect(canDownload({ kind: "view", view: { kind: "istekao", expiresAt: "2026-11-06T20:50:00Z", sha256: "c".repeat(64) } })).toBe(false);
    expect(canDownload({ kind: "none" })).toBe(false);
    expect(statusLines(ready)?.lines[0]).toBe("Paket je spreman.");
  });
  it("alerts on failure, expiry and unknown state", () => {
    expect(statusLines({ kind: "view", view: { kind: "neuspjeh" } })?.tone).toBe("alert");
    expect(statusLines({ kind: "unknown" })?.tone).toBe("alert");
    expect(statusLines({ kind: "notFound" })?.lines).toEqual(["Zadatak više nije dostupan."]);
  });
});

describe("N-18 extension reasons and link", () => {
  it("writes one line per reason with its scope", () => {
    const lines = reasonLines([{ studentId: null, dueAt: "2026-11-10T10:00:00Z", reasonId: "all" }], { all: "Produljenje za sve" });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Produljenje za sve (svi studenti)");
  });
  it("links the assignment page", () => {
    expect(merlinHref("a/b")).toBe("/nastavnik/zadatak/a%2Fb/merlin");
  });
});
