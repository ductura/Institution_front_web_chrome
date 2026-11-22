import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import type { ReceiptRead } from "../../../../../../../src/components/predaja/ReceiptPanel";
import ReceiptScreen from "./ReceiptScreen";
import { fingerprintGroups, receiptView, when, zoned } from "./model";

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

it("puno: title, rows, UTC values and the fingerprint in groups of four", () => {
  const v = receiptView(receipt(false));
  expect(v.kind === "potvrdeno" && v.title).toBe("Predano 12. 11. 2026. u 21:15");
  const out = html(receipt(false));
  expect(out).toContain("Vrijeme predaje");
  expect(out).toContain("12. 11. 2026. u 21:15 (UTC+1)");
  expect(out).toContain("2026-11-12T20:15:00.123456Z");
  expect(out).toContain("Otisak predanog teksta");
  expect(out).toContain("Kopiraj otisak");
  expect(out).toContain("Preuzmi zapis (PDF s QR kodom)");
  expect(out).toContain("Na početnu");
  expect(out).toContain('aria-expanded="false"');
  expect(out).not.toContain("Zapis ima praznine.");
  expect(fingerprintGroups(HEX)?.length).toBe(16);
  expect(fingerprintGroups("xyz")).toBeNull();
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

it("verification is stated as unavailable and links nowhere", () => {
  expect(html(receipt(false))).toContain("Provjera potvrde još nije dostupna.");
});
