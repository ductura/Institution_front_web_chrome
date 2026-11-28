import { describe, expect, it } from "vitest";

import { fallbackKey, groupsOfFour, isSubmittedRead, qrCells, receiptView, shortTime, verifyPath, zonedTime, type ReceiptInput } from "./model";
import { n07Messages as text } from "./messages.hr";

// Invented receipt of an invented work; no real person, text or identifier.
const SHA = "0123456789abcdef".repeat(4);
const SUBMISSION = "00000000-0000-4000-8000-0000000000c7";
const payload = (over: Partial<Record<string, unknown>> = {}) => ({
  receiptSchema: "ductus-submission-receipt-v2", submissionId: SUBMISSION, evidenceDomainId: "d", principalId: "p",
  assignmentId: "a", assignmentVersion: 3, documentId: "doc", evidencePackageId: "e", revision: 2, artifactSha256: SHA,
  evidenceHeadSegmentHash: "h", evidenceRecord: "continuous", requestedAt: "2026-11-05T20:14:07.482Z",
  dueAt: "2026-11-05T22:59:59.000Z", afterDeadline: false, signedAt: "2026-11-05T20:14:09.106Z", ...over,
});
const ready = (submission: unknown, state = "predano"): ReceiptInput =>
  ({ kind: "ready", state, studentName: "Iva Izmišljena", submission } as ReceiptInput);
const signed = (over?: Partial<Record<string, unknown>>) =>
  ready({ kind: "potvrdeno", receipt: { payload: payload(over), payloadDigestSha256: "x", signature: {} } });

describe("N-07 times", () => {
  it("short time and Zagreb offset as the prototype's fmt and zoned", () => {
    expect(shortTime("2026-11-05T20:14:07.482Z")).toBe("5. 11. 2026. u 21:14");
    expect(zonedTime("2026-11-05T20:14:07.482Z")).toBe("5. 11. 2026. u 21:14 (UTC+1)");
    expect(zonedTime("2026-10-21T08:05:00.000Z")).toBe("21. 10. 2026. u 10:05 (UTC+2)");
  });
  it("an unreadable instant is shown as given", () => {
    expect(zonedTime("nije vrijeme")).toBe("nije vrijeme");
  });
});

describe("N-07 receipt view", () => {
  it("loading while reading and while the sign-in is being renewed", () => {
    expect(receiptView(null)).toEqual({ kind: "loading" });
    expect(receiptView({ kind: "signedOut" })).toEqual({ kind: "loading" });
  });
  it("error and not found from the read", () => {
    expect(receiptView({ kind: "unavailable" })).toEqual({ kind: "error" });
    expect(receiptView({ kind: "notFound" })).toEqual({ kind: "notFound" });
  });
  it("puno: title, rows with offsets, one version row, UTC values by their names", () => {
    const v = receiptView(signed());
    if (v.kind !== "submitted") throw new Error(v.kind);
    expect(v.title).toBe("Predano 5. 11. 2026. u 21:14");
    expect(v.rows.map((r) => [r.label, r.value])).toEqual([
      ["Vrijeme predaje", "5. 11. 2026. u 21:14 (UTC+1)"],
      ["Rok", "5. 11. 2026. u 23:59 (UTC+1)"],
      ["Potpisivanje potvrde započelo", "5. 11. 2026. u 21:14 (UTC+1)"],
      ["Verzija", "verzija 2 (predana)"],
    ]);
    expect(v.utc.map((r) => `${r.label} ${r.value}`)).toEqual([
      "requestedAt 2026-11-05T20:14:07.482Z", "dueAt 2026-11-05T22:59:59.000Z", "signedAt 2026-11-05T20:14:09.106Z",
    ]);
    expect(v.groups.split(" ")).toHaveLength(16);
    expect(v.verifyPath).toBe(`/provjera#r=${SUBMISSION}&o=${SHA}`);
  });
  it("nakon roka in the title", () => {
    const v = receiptView(signed({ afterDeadline: true }));
    expect(v.kind === "submitted" && v.title).toBe("Predano 5. 11. 2026. u 21:14, nakon roka");
  });
  it("cjelovit and praznine", () => {
    const whole = receiptView(signed());
    const gaps = receiptView(signed({ evidenceRecord: "with_gaps" }));
    expect(whole.kind === "submitted" && whole.record).toBe("Zapis je cjelovit.");
    expect(gaps.kind === "submitted" && gaps.record).toBe("Zapis ima praznine.");
  });
  it("ceka: recorded, signature pending, no due date invented", () => {
    const v = receiptView(ready({ kind: "ceka", revision: 2, requestedAt: "2026-11-05T20:14:07.482Z" }, "ceka"));
    expect(v).toEqual({
      kind: "pending", title: "Predaja u obradi",
      body: "Predaja je zabilježena 5. 11. 2026. u 21:14. Potpis potvrde još se izdaje; vrijeme predaje se time ne mijenja.",
      rows: [
        { id: "requested", label: "Vrijeme predaje", value: "5. 11. 2026. u 21:14 (UTC+1)" },
        { id: "signed", label: "Potpisivanje potvrde započelo", value: "još nije zabilježeno" },
      ],
    });
  });
  it("prazno only for a work the server calls not submitted", () => {
    const v = receiptView(ready({ kind: "none" }, "nije_predano"));
    expect(v).toEqual({ kind: "notSubmitted", body: "Ovaj rad nije predan, pa potvrde nema. U pisanju, prikaz se osvježava dok student piše." });
    expect(receiptView(ready({ kind: "none" }, "predano"))).toEqual({ kind: "error" });
  });
  it("the Prije predaje panel and the fallback key follow the read", () => {
    expect(isSubmittedRead(ready({ kind: "none" }, "nije_predano"))).toBe(false);
    expect(isSubmittedRead(signed())).toBe(true);
    expect(fallbackKey(receiptView(signed()))).toBe("potvrdeno");
    expect(fallbackKey(receiptView({ kind: "unavailable" }))).toBe("error");
  });
});

describe("N-07 fingerprint, check and QR sample", () => {
  it("groups of four", () => {
    expect(groupsOfFour(SHA)).toBe("0123 4567 89ab cdef ".repeat(4).trim());
  });
  it("no check link for ids that are no code", () => {
    expect(verifyPath("nije-uuid", SHA)).toBeNull();
    expect(verifyPath(SUBMISSION, "abc")).toBeNull();
  });
  it("the QR sample is deterministic and leaves the finder squares free", () => {
    expect(qrCells(SHA)).toBe(qrCells(SHA));
    expect(qrCells(SHA)).not.toBe("");
    expect(qrCells(SHA)).not.toMatch(/M[0-7] [0-7]h/);
    expect(qrCells("abc")).toBe("");
  });
  it("texts as in the prototype", () => {
    expect(text.copy).toBe("Stavi otisak u međuspremnik");
    expect(text.copied).toBe("Otisak je u međuspremniku (64 znaka, bez razmaka).");
  });
});
