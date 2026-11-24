// NF-3 PR-13 (E-11b, E-11e): the reason a withdrawal is not possible and what comes after one.
// The button still follows the server's `withdrawable` alone; the deadline only words the text.
import { describe, expect, it } from "vitest";

import { withdrawView } from "./model";

const NOW = Date.parse("2026-12-10T12:00:00.000Z");
const FUTURE = "2026-12-20T22:59:00.000Z";
const PAST = "2026-12-01T22:59:00.000Z";
const open = { withdrawable: true, receipts: [] };
const shut = { withdrawable: false, receipts: [] };
const ctx = (over: Partial<Parameters<typeof withdrawView>[1]> = {}) => ({ allowed: true, deadline: FUTURE, withdrawn: false, now: NOW, ...over });

describe("withdrawView (PR-13)", () => {
  it("puts the deadline beside the button and in the dialog", () => {
    expect(withdrawView(open, ctx())).toEqual({
      kind: "open",
      lead: "Dok rok traje, predaju možete povući i predati ponovno. Rok: 20. 12. 2026. u 23:59.",
      explainDue: "Dok rok traje, rad možete ponovno mijenjati i predati iznova. Rok: 20. 12. 2026. u 23:59.",
    });
    expect(withdrawView(open, ctx({ deadline: null }))).toEqual({ kind: "open", lead: "Dok rok traje, predaju možete povući i predati ponovno.", explainDue: null });
  });

  it("follows the server even when the client's clock says the deadline passed", () => {
    expect(withdrawView(open, ctx({ deadline: PAST })).kind).toBe("open");
  });

  it("names only the reasons the client knows", () => {
    expect(withdrawView(shut, ctx({ allowed: false }))).toEqual({ kind: "closed", reason: "Nastavnik ili fakultet ne dopušta povlačenje za ovaj zadatak." });
    expect(withdrawView(shut, ctx({ deadline: PAST }))).toEqual({ kind: "closed", reason: "Povlačenje predaje više nije moguće: rok je istekao 1. 12. 2026. u 23:59." });
    // Neither switched off nor late: the general sentence, no guess.
    expect(withdrawView(shut, ctx())).toEqual({ kind: "closed", reason: "Povlačenje predaje više nije moguće." });
    expect(withdrawView(shut, ctx({ allowed: null, deadline: null }))).toEqual({ kind: "closed", reason: "Povlačenje predaje više nije moguće." });
  });

  it("after a withdrawal says until when the work can change, whatever the switch now says", () => {
    expect(withdrawView(shut, ctx({ withdrawn: true, allowed: false }))).toEqual({ kind: "withdrawn", next: "Rad možete ponovno mijenjati do 20. 12. 2026. u 23:59. Zatim ga predajte iznova." });
    expect(withdrawView(shut, ctx({ withdrawn: true, deadline: null }))).toEqual({ kind: "withdrawn", next: "Rad možete ponovno mijenjati i predati iznova dok rok traje." });
    expect(withdrawView(shut, ctx({ withdrawn: true, deadline: PAST }))).toEqual({ kind: "withdrawn", next: "Rok je istekao 1. 12. 2026. u 23:59." });
  });
});
