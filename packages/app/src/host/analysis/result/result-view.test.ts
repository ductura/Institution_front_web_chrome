// @vitest-environment jsdom
// WEB-V15-PRIKAZ-REZULTATA: the result view for each kind. Every name and number is invented.
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import type { AnalysisResponse, AnalysisRunState } from "../api/run";
import { copyFingerprint, frequencyRows, ResultView } from "./ResultView";
import { resultMessages } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DATASET = "0123456789abcdef".repeat(4);
const RESULT = "fedcba9876543210".repeat(4);
const base = { analysisVersion: "1.0.0", datasetSha256: DATASET, resultSha256: RESULT, rowCount: 6 };
const descriptive: AnalysisResponse = {
  ...base, analysisId: "descriptive",
  result: { kind: "descriptive", columns: [
    { name: "visina", n: 5, missing: 1, mean: 12.5, sd: 1.25, median: 12, min: 10, q1: 11, q3: 14, max: 15 },
    { name: "težina", n: 1, missing: 5, mean: 3, sd: null, median: 3, min: 3, q1: 3, q3: 3, max: 3 },
  ] },
};
const frequencies: AnalysisResponse = {
  ...base, analysisId: "frequencies",
  result: { kind: "frequencies", columns: [
    { name: "grad", n: 8, missing: 0, values: [{ value: "Čakovec", count: 3, share: 0.375 }, { value: "Šibenik", count: 2, share: 0.25 }], otherCount: 3 },
  ] },
};
const correlation: AnalysisResponse = {
  ...base, analysisId: "correlation",
  result: { kind: "correlation", pairs: [{ a: "x", b: "y", n: 6, r: -0.5 }, { a: "x", b: "z", n: 2, r: null }, { a: "y", b: "z", n: 6, r: 0.75 }] },
};
const html = (state: AnalysisRunState) => renderToStaticMarkup(createElement(ResultView, { state }));

describe("prikaz po vrsti rezultata", () => {
  it("opisna statistika: tablica, zarez, null je „nije definirano”, otisci i verzija su prikazani", () => {
    const out = html({ kind: "ready", data: descriptive });
    expect(out).toContain("Opisna statistika po stupcima");
    expect(out).toContain("12,5");
    expect(out).toContain("1,25");
    expect(out).toContain("nije definirano");
    expect(out).toContain("1.0.0");
    expect(out).toContain("0123 4567 89ab cdef");
    expect(out).toContain("fedc ba98 7654 3210");
    expect(out).toContain(resultMessages.sampleNote);
    expect(out).not.toMatch(/12\.5|>0<\/td>.*nije definirano/);
  });
  it("učestalosti: po stupcu tablica, ostale vrijednosti u zasebnom retku, udio u postotku", () => {
    const out = html({ kind: "ready", data: frequencies });
    expect(out).toContain("Učestalost vrijednosti za stupac grad");
    expect(out).toContain("Čakovec");
    expect(out).toContain("37,5 %");
    expect(out).toContain(resultMessages.frequencies.other);
    expect(frequencyRows(frequencies.result.kind === "frequencies" ? frequencies.result.columns[0]! : (undefined as never)).map((r) => r.count)).toEqual([3, 2, 3]);
  });
  it("korelacija: popis parova i matrica, null je „nije definirano”", () => {
    const out = html({ kind: "ready", data: correlation });
    expect(out).toContain("Pearsonov koeficijent korelacije po parovima");
    expect(out).toContain("Matrica korelacije");
    expect(out).toContain("\u22120,5");
    expect(out).toContain("0,75");
    expect(out).toContain("nije definirano");
  });
  it("tablice nemaju sortiranje, pa ništa ne rangira", () => {
    for (const data of [descriptive, frequencies, correlation]) expect(html({ kind: "ready", data })).not.toContain("aria-sort");
  });
});

describe("stanja", () => {
  it("učitavanje nije prazno ni greška", () => {
    const out = html({ kind: "loading" });
    expect(out).not.toContain(resultMessages.emptyTitle);
    expect(out).not.toContain(resultMessages.unavailable);
    expect(out).toContain("aria-busy");
  });
  it("503 (nedostupno) nije prazno i nudi ponovni pokušaj", () => {
    const out = html({ kind: "unavailable" });
    expect(out).toContain(resultMessages.unavailable);
    expect(out).not.toContain(resultMessages.emptyTitle);
    expect(renderToStaticMarkup(createElement(ResultView, { state: { kind: "unavailable" }, onRetry: () => undefined }))).toContain(resultMessages.retry);
    expect(out).not.toContain(resultMessages.retry);
  });
  it.each([["off", "off"], ["tooLarge", "tooLarge"], ["invalid", "invalid"], ["failed", "failed"]] as const)("%s ima svoju poruku, ne prazno", (kind, key) => {
    const state: AnalysisRunState = kind === "invalid" ? { kind, code: "invalid_input" } : kind === "failed" ? { kind, status: 500, code: "x" } : { kind };
    const out = html(state);
    expect(out).toContain(resultMessages[key]);
    expect(out).not.toContain(resultMessages.emptyTitle);
  });
  it("uspješan izračun bez stupaca je prazan, ali ne greška", () => {
    const out = html({ kind: "ready", data: { ...descriptive, result: { kind: "descriptive", columns: [] } } });
    expect(out).toContain(resultMessages.emptyTitle);
    expect(out).not.toContain(resultMessages.unavailable);
  });
});

describe("otisak u međuspremnik", () => {
  it("upisuje točno 64 znaka i javlja uspjeh", async () => {
    const writeText = vi.fn(async () => undefined);
    await expect(copyFingerprint(DATASET, { writeText })).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledExactlyOnceWith(DATASET);
  });
  it("neispravan otisak ili odbijen upis nije uspjeh", async () => {
    const writeText = vi.fn(async () => undefined);
    await expect(copyFingerprint("nije otisak", { writeText })).resolves.toBe("failed");
    expect(writeText).not.toHaveBeenCalled();
    await expect(copyFingerprint(DATASET, { writeText: async () => { throw new Error("odbijeno"); } })).resolves.toBe("failed");
    await expect(copyFingerprint(DATASET, undefined)).resolves.toBe("failed");
  });
});

describe("gumb na stranici", () => {
  let host: HTMLDivElement | null = null;
  afterEach(() => { host?.remove(); host = null; });

  async function mount() {
    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => { root.render(createElement(ResultView, { state: { kind: "ready", data: descriptive } })); });
    return host;
  }
  const buttons = () => Array.from(host!.querySelectorAll("button")).filter((b) => b.textContent === resultMessages.copyFingerprint);

  it("stavlja otisak u međuspremnik i tek tada prikazuje „Kopirano u međuspremnik”", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await mount();
    expect(host!.textContent).not.toContain("Kopirano u međuspremnik");
    expect(buttons()).toHaveLength(2);
    await act(async () => { buttons()[0]!.click(); });
    expect(writeText).toHaveBeenCalledWith(DATASET);
    expect(host!.textContent).toContain("Kopirano u međuspremnik");
    await act(async () => { buttons()[1]!.click(); });
    expect(writeText).toHaveBeenLastCalledWith(RESULT);
  });

  it("kad upis padne, potvrde nema", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { throw new Error("x"); } }, configurable: true });
    await mount();
    await act(async () => { buttons()[0]!.click(); });
    expect(host!.textContent).not.toContain("Kopirano u međuspremnik");
    expect(host!.textContent).toContain(resultMessages.copyFailed);
  });
});

describe("tekstovi", () => {
  const strings = (v: unknown): string[] => typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];
  it("nemaju zabranjenih izraza (PRODUCT §5), a potvrda je točno dopuštena rečenica", () => {
    for (const value of strings(resultMessages)) expect(findForbiddenTerms(value, "hr"), value).toEqual([]);
    expect(resultMessages.copied).toBe("Kopirano u međuspremnik");
    expect(findForbiddenTerms("Kopirano u međuspremnik", "hr")).toEqual([]);
    expect(findForbiddenTerms("Kopiraj otisak", "hr")).not.toEqual([]);
  });
  it("prikazani rezultat ne sadrži riječi koje rangiraju ili ocjenjuju", () => {
    for (const data of [descriptive, frequencies, correlation]) {
      expect(html({ kind: "ready", data })).not.toMatch(/rang|ocjen|najbolj|najgor|usporedb/i);
    }
  });
});
