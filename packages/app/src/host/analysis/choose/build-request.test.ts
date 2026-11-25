import { describe, expect, it } from "vitest";

import vectors from "@/client/migration-contract-vectors.generated.json" with { type: "json" };
import type { AnalysisCatalogue } from "../api/read";
import { ANALYSIS_LIMITS } from "../api/limits";
import { buildRequest, eligibleColumns, type Dataset } from "./build-request";

type Vector = { route: string; name: string; response: { body?: unknown } };
const catalogue = (vectors as Vector[]).find((entry) => entry.route === "analysis.catalogue.get" && entry.response.body !== undefined)?.response.body as AnalysisCatalogue;

// Invented data only.
const dataset: Dataset = {
  columns: [{ name: "Skupina", kind: "category" }, { name: "Visina", kind: "numeric" }, { name: "Masa", kind: "numeric" }],
  rows: [["A", 1.5, 2], ["B", 2, null], ["A", 3, 4.5]],
};
const spec = (id: string) => catalogue.analyses.find((entry) => entry.id === id)!;

describe("buildRequest (WEB-V15-ODABIR-ANALIZE)", () => {
  it("has a catalogue to test against", () => {
    expect(catalogue.analyses.map((entry) => entry.id).sort()).toEqual(["correlation", "descriptive", "frequencies"]);
  });

  it("builds the exact body of the contract: five keys, the catalogue's version", () => {
    const built = buildRequest(dataset, { analysisId: "correlation", variables: ["Visina", "Masa"] }, catalogue);
    expect(built.ok && built.request).toEqual({
      analysisId: "correlation", analysisVersion: spec("correlation").version, variables: ["Visina", "Masa"],
      columns: dataset.columns, rows: dataset.rows,
    });
    if (built.ok) expect(Object.keys(built.request).sort()).toEqual(["analysisId", "analysisVersion", "columns", "rows", "variables"]);
  });

  it("is pure and deterministic: equal input, equal output, input untouched, tick order irrelevant", () => {
    const before = JSON.stringify(dataset);
    const one = buildRequest(dataset, { analysisId: "correlation", variables: ["Visina", "Masa"] }, catalogue);
    const two = buildRequest(dataset, { analysisId: "correlation", variables: ["Masa", "Visina"] }, catalogue);
    expect(two).toEqual(one);
    expect(JSON.stringify(dataset)).toBe(before);
    if (one.ok) {
      expect(one.request.rows).not.toBe(dataset.rows);
      expect(one.request.rows[0]).not.toBe(dataset.rows[0]);
    }
  });

  it("never carries an identity: extra properties of the input do not reach the body", () => {
    const dirty = { ...dataset, jmbag: "0000000000", columns: dataset.columns.map((column) => ({ ...column, owner: "x" })) } as Dataset;
    const built = buildRequest(dirty, { analysisId: "descriptive", variables: ["Visina"], user: "x" } as never, catalogue);
    expect(built.ok).toBe(true);
    expect(JSON.stringify(built.ok && built.request)).not.toMatch(/jmbag|owner|user/);
  });

  it("refuses a choice the contract would refuse, so it cannot be sent", () => {
    const refusal = (analysisId: "correlation" | "descriptive" | "frequencies", variables: string[], data = dataset) => {
      const built = buildRequest(data, { analysisId, variables }, catalogue);
      return built.ok ? "ok" : built.reason;
    };
    expect(refusal("correlation", ["Visina"])).toBe("tooFew");
    expect(refusal("correlation", [])).toBe("tooFew");
    expect(refusal("correlation", ["Visina", "Skupina"])).toBe("wrongKind");
    expect(refusal("descriptive", ["Skupina"])).toBe("wrongKind");
    expect(refusal("descriptive", ["Nema"])).toBe("unknownColumn");
    expect(refusal("descriptive", ["Visina", "Visina"])).toBe("duplicate");
    expect(refusal("descriptive", ["Visina"], { ...dataset, rows: [] })).toBe("noRows");
    expect(refusal("frequencies", ["Skupina"])).toBe("ok");
    expect(refusal("frequencies", ["Skupina"], { ...dataset, rows: Array.from({ length: ANALYSIS_LIMITS.maxRows + 1 }, () => ["A", 1, 1]) })).toBe("limits");
    const wide = { columns: Array.from({ length: ANALYSIS_LIMITS.maxColumns + 1 }, (_, i) => ({ name: `s${i}`, kind: "numeric" as const })), rows: [[1]] };
    expect(refusal("descriptive", ["s0"], wide)).toBe("limits");
  });

  it("refuses too many columns for the analysis and a body over the byte limit", () => {
    // The real catalogue allows as many columns as the set may have, so a narrower one is used for "tooMany".
    const narrow = { ...catalogue, analyses: [{ id: "descriptive" as const, version: "1.0.0", variables: { kind: "numeric" as const, min: 1, max: 2 } }] };
    const columns = [1, 2, 3].map((i) => ({ name: `s${i}`, kind: "numeric" as const }));
    const many = buildRequest({ columns, rows: [[1, 2, 3]] }, { analysisId: "descriptive", variables: ["s1", "s2", "s3"] }, narrow);
    expect(many).toMatchObject({ ok: false, reason: "tooMany", max: 2, count: 3 });
    const names = Array.from({ length: 12 }, (_, i) => ({ name: `t${i}`, kind: "category" as const }));
    const long = "x".repeat(ANALYSIS_LIMITS.maxCellLength);
    const big = { columns: names, rows: Array.from({ length: 200 }, () => names.map(() => long)) };
    expect(buildRequest(big, { analysisId: "frequencies", variables: ["t0"] }, catalogue)).toMatchObject({ ok: false, reason: "limits" });
    expect(buildRequest({ ...big, rows: big.rows.slice(0, 20) }, { analysisId: "frequencies", variables: ["t0"] }, catalogue).ok).toBe(true);
  });

  it("an analysis missing from the catalogue is refused", () => {
    expect(buildRequest(dataset, { analysisId: "descriptive", variables: ["Visina"] }, { ...catalogue, analyses: [] })).toEqual({ ok: false, reason: "unknownAnalysis" });
  });

  it("does not offer a column of the wrong kind", () => {
    expect(eligibleColumns(dataset, spec("correlation")).map((c) => c.name)).toEqual(["Visina", "Masa"]);
    expect(eligibleColumns(dataset, spec("descriptive")).map((c) => c.name)).toEqual(["Visina", "Masa"]);
    expect(eligibleColumns(dataset, spec("frequencies")).map((c) => c.name)).toEqual(["Skupina", "Visina", "Masa"]);
  });
});
