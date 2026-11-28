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

describe("NZ-16 option title and focus", () => {
  const NOW = Date.parse("2026-11-24T10:00:00Z");
  it("says the kind of work and a passed deadline in the option", async () => {
    const { choiceLabel } = await import("./model");
    expect(choiceLabel({ id: "a", title: "Kućno kompostiranje", workType: "essay", dueAt: "2026-11-01T22:59:00Z" }, NOW))
      .toBe("Kućno kompostiranje, Esej, rok je prošao");
    expect(choiceLabel({ id: "a", title: "Prikaz članka", workType: "seminar_paper", dueAt: "2099-01-01T00:00:00Z" }, NOW))
      .toBe("Prikaz članka, Seminarski rad");
    expect(choiceLabel({ id: "a", title: null }, NOW)).toBe("Naziv zadatka nije dostupan");
    expect(choiceLabel({ id: "a", title: "X", workType: "nepoznato", dueAt: "sutra" }, NOW)).toBe("X");
  });
  it("names all seven kinds of work of the contract", async () => {
    const { choiceLabel } = await import("./model");
    const kinds = ["short_paper", "essay", "seminar_paper", "bachelor_thesis", "master_thesis", "specialist_thesis", "doctoral_thesis"];
    const labels = kinds.map((workType) => choiceLabel({ id: "a", title: "X", workType, dueAt: "2099-01-01T00:00:00Z" }, NOW));
    expect(labels).toEqual(["X, Podnesak", "X, Esej", "X, Seminarski rad", "X, Završni rad", "X, Diplomski rad",
      "X, Specijalistički rad", "X, Doktorski rad"]);
  });
  it("carries the wish for focus only in the address of the chosen page", async () => {
    const { merlinHref, wantsChooserFocus } = await import("./model");
    expect(merlinHref("a1", true)).toBe("/nastavnik/zadatak/a1/merlin?izbor=1");
    expect(wantsChooserFocus("?izbor=1")).toBe(true);
    expect(wantsChooserFocus("")).toBe(false);
    expect(wantsChooserFocus("?izbor=0")).toBe(false);
  });
});
