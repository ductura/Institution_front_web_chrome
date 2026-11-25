import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";

import vectors from "@/client/migration-contract-vectors.generated.json" with { type: "json" };
import type { AnalysisCatalogue } from "../api/read";
import type { Dataset } from "./build-request";
import { buildRequest } from "./build-request";
import { ChooseAnalysis, reasonText, toggle } from "./ChooseAnalysis";
import { analysisTitles, chooseMessages as t } from "./messages.hr";

type Vector = { route: string; response: { body?: unknown } };
const catalogue = (vectors as Vector[]).find((entry) => entry.route === "analysis.catalogue.get" && entry.response.body !== undefined)?.response.body as AnalysisCatalogue;
const dataset: Dataset = { columns: [{ name: "Skupina", kind: "category" }, { name: "Visina", kind: "numeric" }], rows: [["A", 1], ["B", 2]] };

describe("ChooseAnalysis", () => {
  const html = renderToStaticMarkup(createElement(ChooseAnalysis, { catalogue, dataset, onChoose: () => undefined }));

  it("lists every analysis of the catalogue under its Croatian title, from the shared Select", () => {
    for (const entry of catalogue.analyses) expect(html).toContain(analysisTitles[entry.id].title);
    expect(html).toContain("<select");
  });

  it("starts with “Izračunaj” disabled and says why", () => {
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Izračunaj<\/button>/);
    expect(html).toContain(t.reasons.noAnalysis);
  });

  it("every analysis has a title and no title ranks people", () => {
    for (const entry of catalogue.analyses) expect(analysisTitles[entry.id].title.length).toBeGreaterThan(0);
    expect(JSON.stringify(analysisTitles) + JSON.stringify(t)).not.toMatch(/rang|ocjen|najbolj|najlošij/i);
  });

  it("the reason text fills in numbers and names, and is null for a buildable choice", () => {
    expect(reasonText(buildRequest(dataset, { analysisId: "correlation", variables: ["Visina"] }, catalogue))).toBe("Odaberite barem 2 stupca (1 odabrano).");
    expect(reasonText(buildRequest(dataset, { analysisId: "descriptive", variables: ["Skupina"] }, catalogue))).toBe("Stupac “Skupina” nije vrste koju analiza prima.");
    expect(reasonText(buildRequest(dataset, { analysisId: "descriptive", variables: ["Visina"] }, catalogue))).toBeNull();
  });

  it("toggle adds, removes and leaves the old list alone", () => {
    const before = ["a"];
    expect(toggle(before, "b")).toEqual(["a", "b"]);
    expect(toggle(["a", "b"], "a")).toEqual(["b"]);
    expect(before).toEqual(["a"]);
  });
});

describe("texts", () => {
  it("hold no forbidden term (PRODUCT §5)", () => {
    const flat = (value: unknown): string[] => (typeof value === "string" ? [value] : value !== null && typeof value === "object" ? Object.values(value).flatMap(flat) : []);
    for (const text of [...flat(t), ...flat(analysisTitles)]) expect(findForbiddenTerms(text, "hr")).toEqual([]);
  });
});
