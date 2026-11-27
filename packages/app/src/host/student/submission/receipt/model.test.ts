import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import type { ReceiptRead } from "../../../../../../../src/components/predaja/ReceiptPanel";
import ReceiptScreen from "./ReceiptScreen";
import { isFingerprint, receiptView, when, zoned } from "./model";

const HEX = "0123456789abcdef".repeat(4);
const receipt = (afterDeadline: boolean, evidenceRecord = "continuous"): ReceiptRead => ({
  kind: "potvrdeno",
  receipt: { payload: {
    submissionId: "5b1f0c7e-3d2a-4c8e-9a41-0f6e2d7b8c13", requestedAt: "2026-11-12T20:15:00.123456Z", dueAt: "2026-11-12T20:02:00.000000Z",
    signedAt: "2026-11-12T20:16:00.000000Z", afterDeadline, evidenceRecord, artifactSha256: HEX, revision: 3, assignmentVersion: 1,
  } },
} as never);
const html = (read: ReceiptRead) => renderToStaticMarkup(createElement(ReceiptScreen, { read, retryHref: "/r", workHref: "/w", homeHref: "/" }));

it("zone and time are Zagreb's, with the offset", () => {
  expect(zoned("2026-11-12T20:15:00Z")).toBe("12. 11. 2026. u 21:15 (UTC+1)");
  expect(zoned("2026-07-12T20:15:00Z")).toBe("12. 7. 2026. u 22:15 (UTC+2)");
  expect(when("2026-11-12T20:15:00Z")).toBe("12. 11. 2026. u 21:15");
});

it("puno: title, rows, UTC times in words and the fingerprint only copied, never shown", () => {
  const v = receiptView(receipt(false));
  expect(v.kind === "potvrdeno" && v.title).toBe("Predano 12. 11. 2026. u 21:15");
  const out = html(receipt(false));
  expect(out).toContain("Vrijeme predaje");
  expect(out).toContain("12. 11. 2026. u 21:15 (UTC+1)");
  // S-08: the UTC block gives the same instants in words, not as ISO text, and no SHA-256 string is shown.
  expect(out).toContain("Točna vremena iz potvrde (UTC)");
  expect(out).toContain("Vrijeme predaje 12. studenoga 2026. u 20:15");
  expect(out).toContain("Rok 12. studenoga 2026. u 20:02");
  expect(out).not.toContain("2026-11-12T20:15:00.123456Z");
  expect(out).not.toContain(HEX);
  expect(out).not.toContain("0123 4567");
  expect(out).toContain("Otisak predanog teksta");
  expect(out).toContain("Otisak u međuspremnik");
  expect(out).toContain("Preuzmi zapis (PDF s QR kodom)");
  expect(out).toContain("Na početnu");
  expect(out).toContain('aria-expanded="false"');
  expect(out).not.toContain("Zapis ima praznine.");
  expect(isFingerprint(HEX)).toBe(true);
  expect(isFingerprint("xyz")).toBe(false);
});

it("nakonroka and praznine add only their own words", () => {
  expect(html(receipt(true))).toContain(", nakon roka");
  expect(html(receipt(false, "with_gaps"))).toContain("Zapis ima praznine.");
});

it("ceka, prazno, ucitavanje and greska say what the prototype says", () => {
  expect(html({ kind: "ceka", revision: 2, requestedAt: "2026-11-12T20:15:00Z" })).toContain("Predaja u obradi");
  expect(html({ kind: "ceka", revision: 2, requestedAt: "2026-11-12T20:15:00Z" })).toContain("još nije zabilježeno");
  expect(html({ kind: "none" })).toContain("Ovaj rad još nije predan, pa potvrde nema.");
  expect(html({ kind: "loading" })).toContain("Učitavam potvrdu s poslužitelja.");
  expect(html({ kind: "error" })).toContain("Ako je rad predan, predaja i vrijeme predaje time se ne mijenjaju.");
});

it("K5: the load error is a role=alert frame in the error colour with a link, never an outlined button", () => {
  const out = html({ kind: "error" });
  expect(out).toMatch(/role="alert"[^>]*>.*Potvrdu trenutačno nije moguće učitati/s);
  expect(out).toContain('href="/r"');
  expect(out).toContain("Pokušaj ponovno");
  expect(out).not.toContain("btn secondary");
});

it("a pending receipt holds its UTC time in words, and leaves out a value that is no instant", () => {
  const v = receiptView({ kind: "ceka", revision: 2, requestedAt: "2026-11-27T14:32:00Z" });
  expect(v.kind === "ceka" && v.utc).toEqual([{ id: "requestedAt", label: "Vrijeme predaje", value: "27. studenoga 2026. u 14:32" }]);
  const bad = receiptView({ kind: "ceka", revision: 2, requestedAt: "nije vrijeme" });
  expect(bad.kind === "ceka" && bad.utc).toEqual([]);
});
it("verification is stated as unavailable and links nowhere", () => {
  expect(html(receipt(false))).toContain("Provjera potvrde još nije dostupna.");
});
